// LUMIERE JSON API, mounted at /api in server.js
const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");

const User = require("../models/User");
const Perfume = require("../models/Perfume");
const Review = require("../models/Review");
const Like = require("../models/Like");
const Follow = require("../models/Follow");
const Group = require("../models/Group");
const GroupMember = require("../models/GroupMember");
const GroupPost = require("../models/GroupPost");
const { seedCatalog } = require("../lib/catalog");
const { seedGroups } = require("../lib/groups");
const chat = require("../lib/chat");
const realtime = require("../lib/realtime");
const Message = require("../models/Message");
const PerformanceVote = require("../models/PerformanceVote");
const ContactRequest = require("../models/ContactRequest");
const { slugify, normalize, nameKey, perfumeKey } = require("../lib/perfumeKey");
const {
  hashPassword, checkPassword, startSession, endSession,
  loadUser, requireUser, sameOrigin, rateLimit,
} = require("../lib/auth");

const router = express.Router();
const FAMILIES = ["woody", "floral", "fresh", "amber", "citrus", "musk", "spicy", "gourmand"];
const UPLOAD_DIR = path.join(__dirname, "..", "public", "uploads", "perfumes");

router.use(express.json({ limit: "20kb" }));
router.use(sameOrigin);
router.use(loadUser);

/* ---------- Helpers ---------- */
const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

function perfumeJSON(p) {
  return {
    slug: p.slug,
    brand: p.brand,
    name: p.name,
    tags: p.tags,
    notes: p.notes,
    image: p.image,
    source: p.source,
    addedBy: p.addedBy && p.addedBy.username ? p.addedBy.username : null,
    notesAddedBy: p.notesAddedBy && p.notesAddedBy.username ? p.notesAddedBy.username : null,
    createdAt: p.createdAt,
  };
}

async function statsFor(slug) {
  const [agg] = await Review.aggregate([
    { $match: { perfume: slug } },
    { $group: { _id: null, reviews: { $sum: 1 }, ratingSum: { $sum: "$rating" } } },
  ]);
  const likes = await Like.countDocuments({ perfume: slug });
  return { reviews: agg ? agg.reviews : 0, ratingSum: agg ? agg.ratingSum : 0, likes };
}

// Same perfume already on the site? ("Dior Sauvage" / "dior sauvage EDP" / "Sauvage" by Dior)
async function findDuplicate(brand, name) {
  const nk = nameKey(brand, name);
  if (!nk) return null;
  const exact = await Perfume.findOne({ key: perfumeKey(brand, name) });
  if (exact) return exact;
  const b = normalize(brand);
  const sameName = await Perfume.find({ nameKey: nk });
  return sameName.find((c) => !b || !normalize(c.brand) || normalize(c.brand) === b) || null;
}

async function meJSON(user) {
  const [likes, reviews, following] = await Promise.all([
    Like.find({ user: user._id }).sort({ createdAt: -1 }),
    Review.find({ user: user._id }).sort({ updatedAt: -1 }),
    Follow.find({ follower: user._id }).populate("following", "username"),
  ]);
  return {
    user: user.toPublic(),
    likes: likes.map((l) => l.perfume),
    reviews: reviews.map((r) => ({ perfume: r.perfume, rating: r.rating })),
    following: following.filter((f) => f.following).map((f) => f.following.username),
  };
}

const authorJSON = (u) => (u ? { username: u.username, displayName: u.displayName } : null);

// A review as the browser sees it. `me` = signed-in user (for likedByMe)
function reviewJSON(r, me) {
  return {
    id: r._id,
    user: authorJSON(r.user),
    perfume: r.perfume,
    rating: r.rating,
    text: r.text,
    likes: r.likesCount || 0,
    likedByMe: !!(me && (r.likedBy || []).some((id) => id.equals(me._id))),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const limitParam = (v, def, max) => Math.min(max, Math.max(1, parseInt(v, 10) || def));

// Ids of the people `user` follows
const followingIds = (user) => Follow.find({ follower: user._id }).distinct("following");

/* ---------- Catalog seeding (lib/catalog.js) ---------- */
async function seedCatalogOnStart() {
  await Review.syncIndexes();   // drops the old "one review per perfume" unique index if it's still there
  const count = await seedCatalog();
  const groups = await seedGroups();
  console.log(`Perfume catalog ready (${count} perfumes, ${groups} built-in groups)`);
}

if (mongoose.connection.readyState === 1) seedCatalogOnStart().catch(console.error);
else mongoose.connection.once("connected", () => seedCatalogOnStart().catch(console.error));

/* ---------- Auth ---------- */
const authLimiter = rateLimit({ max: 20, windowMs: 15 * 60 * 1000 });

router.post("/auth/signup", authLimiter, async (req, res) => {
  const displayName = text(req.body.displayName, 40);
  const username = text(req.body.username, 40).toLowerCase();
  const email = text(req.body.email, 120).toLowerCase();
  const password = typeof req.body.password === "string" ? req.body.password : "";

  const fields = {};
  if (!displayName) fields.displayName = "Please enter your name.";
  if (!/^[a-z0-9_.]{3,20}$/.test(username)) fields.username = "3–20 characters: letters, numbers, _ or .";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = "Please enter a valid email.";
  if (password.length < 8) fields.password = "At least 8 characters.";
  if (password.length > 200) fields.password = "That password is too long.";
  if (Object.keys(fields).length) return res.status(400).json({ error: "Please fix the highlighted fields.", fields });

  const taken = await User.findOne({ $or: [{ username }, { email }] });
  if (taken) {
    const field = taken.username === username ? "username" : "email";
    return res.status(409).json({
      error: field === "username" ? "That username is taken." : "An account with this email already exists.",
      fields: { [field]: field === "username" ? "Already taken — try another." : "Already registered — log in instead." },
    });
  }

  const user = await User.create({ displayName, username, email, passwordHash: await hashPassword(password) });
  await startSession(res, user);
  res.status(201).json(await meJSON(user));
});

// Compared against when an account doesn't exist, so timing stays the same
const DUMMY_HASH = require("bcryptjs").hashSync("not-a-real-password", 12);

router.post("/auth/login", authLimiter, async (req, res) => {
  const login = text(req.body.login, 120).toLowerCase();
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const user = login ? await User.findOne({ $or: [{ email: login }, { username: login }] }) : null;
  // Always run bcrypt so response time doesn't reveal which accounts exist
  const ok = await checkPassword(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) return res.status(401).json({ error: "Wrong email/username or password." });
  await startSession(res, user);
  res.json(await meJSON(user));
});

router.post("/auth/logout", async (req, res) => {
  await endSession(req, res);
  res.json({ ok: true });
});

router.get("/auth/me", async (req, res) => {
  res.json(req.user ? await meJSON(req.user) : { user: null, likes: [], reviews: [] });
});

/* ---------- Profiles ---------- */
router.get("/users/:username", async (req, res) => {
  const user = await User.findOne({ username: String(req.params.username).toLowerCase() });
  if (!user) return res.status(404).json({ error: "User not found." });
  const [likes, reviews, added, followers, following, isFollowing, memberships] = await Promise.all([
    Like.find({ user: user._id }).sort({ createdAt: -1 }),
    Review.find({ user: user._id }).sort({ updatedAt: -1 }).populate("user", "username displayName"),
    Perfume.find({ addedBy: user._id }).sort({ createdAt: -1 }),
    Follow.countDocuments({ following: user._id }),
    Follow.countDocuments({ follower: user._id }),
    req.user ? Follow.exists({ follower: req.user._id, following: user._id }) : null,
    GroupMember.find({ user: user._id }).sort({ createdAt: -1 }).populate("group", "slug name family"),
  ]);
  res.json({
    user: user.toPublic(),
    likes: likes.map((l) => l.perfume),
    reviews: reviews.map((r) => reviewJSON(r, req.user)),
    added: added.map((p) => p.slug),
    followers,
    following,
    isFollowing: !!isFollowing,
    groups: memberships.filter((m) => m.group).map((m) => ({ slug: m.group.slug, name: m.group.name, family: m.group.family })),
  });
});

router.patch("/users/me", requireUser, async (req, res) => {
  const displayName = text(req.body.displayName, 40);
  if (!displayName) return res.status(400).json({ error: "Please enter your name.", fields: { displayName: "Required." } });
  req.user.displayName = displayName;
  req.user.bio = text(req.body.bio, 160);
  await req.user.save();
  res.json({ user: req.user.toPublic() });
});

/* ---------- Perfumes ---------- */
// Counts activity per perfume overall and in recent windows (used for Trending)
function activityGroup(extra = {}) {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const since = (days) => new Date(now - days * day);
  const inRange = (from, to) => ({
    $sum: { $cond: [{ $and: [{ $gte: ["$createdAt", since(from)] }, { $lt: ["$createdAt", since(to)] }] }, 1, 0] },
  });
  return {
    $group: {
      _id: "$perfume",
      total: { $sum: 1 },
      week: inRange(7, 0),
      prevWeek: inRange(14, 7),
      month: inRange(30, 0),
      ...extra,
    },
  };
}

router.get("/perfumes", async (req, res) => {
  const [list, reviewStats, likeStats] = await Promise.all([
    Perfume.find().populate("addedBy", "username").populate("notesAddedBy", "username").sort({ createdAt: 1 }),
    Review.aggregate([activityGroup({ ratingSum: { $sum: "$rating" } })]),
    Like.aggregate([activityGroup()]),
  ]);
  const stats = {};
  const blank = { reviews: 0, ratingSum: 0, likes: 0, week: 0, prevWeek: 0, month: 0 };
  reviewStats.forEach((s) => {
    stats[s._id] = { ...blank, reviews: s.total, ratingSum: s.ratingSum, week: s.week, prevWeek: s.prevWeek, month: s.month };
  });
  likeStats.forEach((s) => {
    const t = stats[s._id] || (stats[s._id] = { ...blank });
    t.likes = s.total;
    t.week += s.week;
    t.prevWeek += s.prevWeek;
    t.month += s.month;
  });
  res.json({ perfumes: list.map(perfumeJSON), stats });
});

// Live duplicate check while someone types in "Add a perfume"
router.get("/perfumes/check", async (req, res) => {
  const dup = await findDuplicate(text(req.query.brand, 60), text(req.query.name, 80));
  res.json({ exists: !!dup, perfume: dup ? { slug: dup.slug, brand: dup.brand, name: dup.name } : null });
});

router.post("/perfumes", requireUser, async (req, res) => {
  const brand = text(req.body.brand, 60);
  const name = text(req.body.name, 80);
  const tags = Array.isArray(req.body.tags) ? [...new Set(req.body.tags.filter((t) => FAMILIES.includes(t)))] : [];
  const notesInput = Array.isArray(req.body.notes) ? req.body.notes : String(req.body.notes || "").split(",");
  const notes = [...new Set(notesInput.map((n) => text(n, 40)).filter(Boolean))].slice(0, 8);

  const fields = {};
  if (!name) fields.name = "Please enter the perfume's name.";
  if (!brand) fields.brand = "Please enter the brand.";
  if (Object.keys(fields).length) return res.status(400).json({ error: "Please fix the highlighted fields.", fields });

  const dup = await findDuplicate(brand, name);
  if (dup) {
    return res.status(409).json({
      error: "This perfume is already on LUMIERE.",
      existing: { slug: dup.slug, brand: dup.brand, name: dup.name },
    });
  }

  let slug = slugify(`${brand} ${name}`) || "perfume";
  for (let i = 2; await Perfume.exists({ slug }); i++) slug = `${slugify(`${brand} ${name}`)}-${i}`;

  const perfume = await Perfume.create({
    slug, brand, name, tags, notes,
    key: perfumeKey(brand, name),
    nameKey: nameKey(brand, name),
    source: "community",
    addedBy: req.user._id,
  });
  await perfume.populate("addedBy", "username");
  res.status(201).json({ perfume: perfumeJSON(perfume) });
});

// Photo upload for a perfume you added (raw image body, max 5 MB)
const IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function looksLikeImage(buf, type) {
  if (type === "image/jpeg") return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (type === "image/png") return buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === "image/webp") return buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP";
  return false;
}

router.put(
  "/perfumes/:slug/image",
  requireUser,
  express.raw({ type: Object.keys(IMAGE_TYPES), limit: "5mb" }),
  async (req, res) => {
    const perfume = await Perfume.findOne({ slug: req.params.slug });
    if (!perfume) return res.status(404).json({ error: "Perfume not found." });
    if (!perfume.addedBy || !perfume.addedBy.equals(req.user._id)) {
      return res.status(403).json({ error: "Only the person who added this perfume can change its photo." });
    }
    const type = req.headers["content-type"];
    if (!Buffer.isBuffer(req.body) || !IMAGE_TYPES[type] || !looksLikeImage(req.body, type)) {
      return res.status(400).json({ error: "Please upload a JPG, PNG or WebP image." });
    }
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const file = `${perfume.slug}-${Date.now().toString(36)}.${IMAGE_TYPES[type]}`;
    await fs.writeFile(path.join(UPLOAD_DIR, file), req.body);
    if (perfume.image.startsWith("/uploads/perfumes/")) {
      await fs.unlink(path.join(UPLOAD_DIR, path.basename(perfume.image))).catch(() => {});
    }
    perfume.image = `/uploads/perfumes/${file}`;
    await perfume.save();
    res.json({ image: perfume.image });
  }
);

/* ---------- Performance votes (longevity, sillage, value) — one per member per perfume ---------- */
const PERF_KEYS = ["longevity", "sillage", "value"];

const WEAR_KEYS = ["Spring", "Summer", "Fall", "Winter", "Day", "Night"];

// Shared totals for a perfume (performance per level, when-to-wear picks, agree votes)
// + the signed-in member's own selections
async function performanceFor(slug, user) {
  const [rows, mine] = await Promise.all([
    PerformanceVote.aggregate([
      { $match: { perfume: slug } },
      { $facet: {
        ...Object.fromEntries(PERF_KEYS.map((k) => [k, [{ $match: { [k]: { $ne: null } } }, { $group: { _id: `$${k}`, n: { $sum: 1 } } }]])),
        wear: [{ $unwind: "$wear" }, { $group: { _id: "$wear", n: { $sum: 1 } } }],
        agree: [{ $unwind: "$agree" }, { $group: { _id: "$agree", n: { $sum: 1 } } }],
      } },
    ]),
    user ? PerformanceVote.findOne({ perfume: slug, user: user._id }) : null,
  ]);
  const counts = {};
  for (const k of PERF_KEYS) {
    counts[k] = [1, 2, 3, 4, 5].map((lvl) => ((rows[0][k] || []).find((r) => r._id === lvl) || { n: 0 }).n);
  }
  const voters = await PerformanceVote.countDocuments({ perfume: slug, $or: PERF_KEYS.map((k) => ({ [k]: { $ne: null } })) });
  const toMap = (list) => Object.fromEntries((list || []).map((r) => [r._id, r.n]));
  return {
    counts,
    voters,
    mine: mine ? Object.fromEntries(PERF_KEYS.map((k) => [k, mine[k] || null])) : { longevity: null, sillage: null, value: null },
    wear: { counts: { ...Object.fromEntries(WEAR_KEYS.map((k) => [k, 0])), ...toMap(rows[0].wear) }, mine: mine ? mine.wear : [] },
    agree: { counts: toMap(rows[0].agree), mine: mine ? mine.agree : [] },
  };
}

router.get("/perfumes/:slug/performance", async (req, res) => {
  res.json(await performanceFor(req.params.slug, req.user));
});

// Set (or clear with level: null) your vote for one measure
router.put("/perfumes/:slug/performance", requireUser, async (req, res) => {
  if (!(await requirePerfume(req, res))) return;
  const key = req.body.key;
  const lvl = req.body.level === null ? null : Number(req.body.level);
  if (!PERF_KEYS.includes(key)) return res.status(400).json({ error: "Unknown measure." });
  if (lvl !== null && (!Number.isInteger(lvl) || lvl < 1 || lvl > 5)) return res.status(400).json({ error: "Please pick a level from 1 to 5." });
  await PerformanceVote.findOneAndUpdate(
    { user: req.user._id, perfume: req.params.slug },
    { $set: { [key]: lvl }, $setOnInsert: { user: req.user._id, perfume: req.params.slug } },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  res.json(await performanceFor(req.params.slug, req.user));
});

// Pick / unpick a season or time of day: { pick: "Fall", on: true }
router.put("/perfumes/:slug/wear", requireUser, async (req, res) => {
  if (!(await requirePerfume(req, res))) return;
  const pick = String(req.body.pick || "");
  if (!WEAR_KEYS.includes(pick)) return res.status(400).json({ error: "Unknown season or time." });
  await PerformanceVote.findOneAndUpdate(
    { user: req.user._id, perfume: req.params.slug },
    { [req.body.on ? "$addToSet" : "$pull"]: { wear: pick }, $setOnInsert: { user: req.user._id, perfume: req.params.slug } },
    { upsert: true, setDefaultsOnInsert: true }
  );
  res.json(await performanceFor(req.params.slug, req.user));
});

// Agree / un-agree with one of the default pros or cons: { key: "pros:<text>", on: true }
router.put("/perfumes/:slug/agree", requireUser, async (req, res) => {
  if (!(await requirePerfume(req, res))) return;
  const key = String(req.body.key || "");
  if (!/^(pros|cons):.{1,190}$/.test(key)) return res.status(400).json({ error: "Unknown pro or con." });
  if (req.body.on) {
    const existing = await PerformanceVote.findOne({ user: req.user._id, perfume: req.params.slug }, "agree");
    if (existing && existing.agree.length >= 30 && !existing.agree.includes(key)) return res.status(400).json({ error: "Too many votes on this perfume." });
  }
  await PerformanceVote.findOneAndUpdate(
    { user: req.user._id, perfume: req.params.slug },
    { [req.body.on ? "$addToSet" : "$pull"]: { agree: key }, $setOnInsert: { user: req.user._id, perfume: req.params.slug } },
    { upsert: true, setDefaultsOnInsert: true }
  );
  res.json(await performanceFor(req.params.slug, req.user));
});

/* ---------- Notes: the first member to see a perfume without notes can add them ---------- */
router.put("/perfumes/:slug/notes", requireUser, async (req, res) => {
  const input = Array.isArray(req.body.notes) ? req.body.notes : String(req.body.notes || "").split(",");
  const notes = [...new Set(input.map((n) => text(n, 40)).filter(Boolean))].slice(0, 8);
  if (!notes.length) return res.status(400).json({ error: "Please add at least one note." });

  // only succeeds while the perfume still has no notes (safe if two people submit at once)
  const updated = await Perfume.findOneAndUpdate(
    { slug: req.params.slug, $or: [{ notes: { $size: 0 } }, { notes: { $exists: false } }] },
    { $set: { notes, notesAddedBy: req.user._id } },
    { new: true }
  );
  if (!updated) {
    const perfume = await Perfume.findOne({ slug: req.params.slug }).populate("notesAddedBy", "username");
    if (!perfume) return res.status(404).json({ error: "Perfume not found." });
    return res.status(409).json({
      error: "Someone already added notes to this perfume.",
      notes: perfume.notes,
      notesAddedBy: perfume.notesAddedBy ? perfume.notesAddedBy.username : null,
    });
  }
  const payload = { slug: updated.slug, notes: updated.notes, notesAddedBy: req.user.username };
  realtime.emitToAll("perfume:notes", payload);   // update everyone viewing it, live
  res.json(payload);
});

/* ---------- Reviews & likes ---------- */
async function requirePerfume(req, res) {
  const perfume = await Perfume.findOne({ slug: req.params.slug });
  if (!perfume) res.status(404).json({ error: "Perfume not found." });
  return perfume;
}

router.get("/perfumes/:slug/reviews", async (req, res) => {
  const [list, mine] = await Promise.all([
    Review.find({ perfume: req.params.slug }).sort({ likesCount: -1, createdAt: -1 }).limit(60).populate("user", "username displayName"),
    req.user ? Review.find({ perfume: req.params.slug, user: req.user._id }).sort({ createdAt: -1 }).populate("user", "username displayName") : [],
  ]);
  const all = [...mine.filter((m) => !list.some((r) => r._id.equals(m._id))), ...list];
  const counts = await Review.aggregate([{ $match: { perfume: req.params.slug } }, { $group: { _id: "$rating", n: { $sum: 1 } } }]);
  const breakdown = [1, 2, 3, 4, 5].map((star) => (counts.find((c) => c._id === star) || { n: 0 }).n);   // index 0 = 1★
  const total = breakdown.reduce((a, b) => a + b, 0);
  res.json({ reviews: all.filter((r) => r.user).map((r) => reviewJSON(r, req.user)), total, breakdown });
});

function reviewInput(req, res) {
  const rating = Number(req.body.rating);
  const body = text(req.body.text, 1000);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) { res.status(400).json({ error: "Please choose a star rating." }); return null; }
  if (body.length < 10) { res.status(400).json({ error: "Please write at least a few words (10+ characters)." }); return null; }
  return { rating, text: body };
}

// Tell open pages that review activity changed (e.g. "Top reviewers this month")
const reviewsChanged = (slug) => realtime.emitToAll("reviews:changed", { perfume: slug });

// Post a review (members can review the same perfume again later)
router.post("/perfumes/:slug/reviews", requireUser, async (req, res) => {
  if (!(await requirePerfume(req, res))) return;
  const input = reviewInput(req, res);
  if (!input) return;
  await Review.create({ user: req.user._id, perfume: req.params.slug, ...input });
  reviewsChanged(req.params.slug);
  res.status(201).json({ stats: await statsFor(req.params.slug) });
});

// Edit / delete one of your own reviews
async function myReview(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) { res.status(404).json({ error: "Review not found." }); return null; }
  const review = await Review.findOne({ _id: req.params.id, user: req.user._id });
  if (!review) res.status(404).json({ error: "Review not found." });
  return review;
}

router.put("/reviews/:id", requireUser, async (req, res) => {
  const review = await myReview(req, res);
  if (!review) return;
  const input = reviewInput(req, res);
  if (!input) return;
  Object.assign(review, input);
  await review.save();
  res.json({ stats: await statsFor(review.perfume) });
});

router.delete("/reviews/:id", requireUser, async (req, res) => {
  const review = await myReview(req, res);
  if (!review) return;
  await review.deleteOne();
  reviewsChanged(review.perfume);
  res.json({ stats: await statsFor(review.perfume) });
});

router.put("/perfumes/:slug/like", requireUser, async (req, res) => {
  if (!(await requirePerfume(req, res))) return;
  await Like.updateOne(
    { user: req.user._id, perfume: req.params.slug },
    { $setOnInsert: { user: req.user._id, perfume: req.params.slug } },
    { upsert: true }
  );
  res.json({ liked: true, stats: await statsFor(req.params.slug) });
});

router.delete("/perfumes/:slug/like", requireUser, async (req, res) => {
  await Like.deleteOne({ user: req.user._id, perfume: req.params.slug });
  res.json({ liked: false, stats: await statsFor(req.params.slug) });
});

/* ---------- All reviews (homepage "Popular reviews" + "See all reviews") ---------- */
router.get("/reviews", async (req, res) => {
  const sort = req.query.sort === "newest" ? { createdAt: -1 } : { likesCount: -1, createdAt: -1 };
  const limit = limitParam(req.query.limit, 10, 50);
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const filter = {};
  if (req.query.scope === "following") {
    if (!req.user) return res.status(401).json({ error: "Please log in first." });
    filter.user = { $in: await followingIds(req.user) };
  }
  if (req.query.rating && /^[1-5]$/.test(req.query.rating)) filter.rating = Number(req.query.rating);
  const [list, total] = await Promise.all([
    Review.find(filter).sort(sort).skip(offset).limit(limit).populate("user", "username displayName"),
    Review.countDocuments(filter),
  ]);
  res.json({
    reviews: list.filter((r) => r.user).map((r) => reviewJSON(r, req.user)),
    total,
    hasMore: offset + list.length < total,
  });
});

// "Helpful" votes on a review
async function setReviewLike(req, res, liked) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Review not found." });
  const review = await Review.findById(req.params.id);
  if (!review) return res.status(404).json({ error: "Review not found." });
  if (review.user.equals(req.user._id)) return res.status(400).json({ error: "You can't like your own review." });
  const me = req.user._id;
  const updated = liked
    ? await Review.findOneAndUpdate({ _id: review._id, likedBy: { $ne: me } }, { $push: { likedBy: me }, $inc: { likesCount: 1 } }, { new: true, timestamps: false })
    : await Review.findOneAndUpdate({ _id: review._id, likedBy: me }, { $pull: { likedBy: me }, $inc: { likesCount: -1 } }, { new: true, timestamps: false });
  res.json({ liked, likes: (updated || (await Review.findById(review._id))).likesCount });
}
router.put("/reviews/:id/like", requireUser, (req, res) => setReviewLike(req, res, true));
router.delete("/reviews/:id/like", requireUser, (req, res) => setReviewLike(req, res, false));

/* ---------- Following ---------- */
async function findUser(req, res) {
  const user = await User.findOne({ username: String(req.params.username).toLowerCase() });
  if (!user) res.status(404).json({ error: "User not found." });
  return user;
}

router.put("/users/:username/follow", requireUser, async (req, res) => {
  const target = await findUser(req, res);
  if (!target) return;
  if (target._id.equals(req.user._id)) return res.status(400).json({ error: "You can't follow yourself." });
  await Follow.updateOne(
    { follower: req.user._id, following: target._id },
    { $setOnInsert: { follower: req.user._id, following: target._id } },
    { upsert: true }
  );
  res.json({ following: true, followers: await Follow.countDocuments({ following: target._id }) });
});

router.delete("/users/:username/follow", requireUser, async (req, res) => {
  const target = await findUser(req, res);
  if (!target) return;
  await Follow.deleteOne({ follower: req.user._id, following: target._id });
  res.json({ following: false, followers: await Follow.countDocuments({ following: target._id }) });
});

// Followers / following lists on a profile
async function followList(req, res, direction) {
  const user = await findUser(req, res);
  if (!user) return;
  const limit = limitParam(req.query.limit, 60, 200);
  const filter = direction === "followers" ? { following: user._id } : { follower: user._id };
  const other = direction === "followers" ? "follower" : "following";
  const [rows, total] = await Promise.all([
    Follow.find(filter).sort({ createdAt: -1 }).limit(limit).populate(other, "username displayName bio"),
    Follow.countDocuments(filter),
  ]);
  res.json({
    users: rows.map((r) => r[other]).filter(Boolean).map((u) => ({ username: u.username, displayName: u.displayName, bio: u.bio })),
    total,
  });
}
router.get("/users/:username/followers", (req, res) => followList(req, res, "followers"));
router.get("/users/:username/following", (req, res) => followList(req, res, "following"));

/* ---------- Members: search + top reviewers ---------- */
// Search every member (registered and demo) by name or @username; closest matches first
router.get("/members", async (req, res) => {
  const q = text(req.query.search, 40).replace(/^@/, "");
  if (!q) return res.json({ users: [] });
  const limit = limitParam(req.query.limit, 5, 20);
  const re = new RegExp(escapeRegex(q), "i");
  const found = await User.find({ $or: [{ username: re }, { displayName: re }] }, "username displayName").limit(limit * 4);
  const lower = q.toLowerCase();
  const rank = (u) => {
    const name = u.displayName.toLowerCase();
    if (u.username === lower || name === lower) return 0;
    if (u.username.startsWith(lower) || name.startsWith(lower)) return 1;
    if (name.split(/\s+/).some((w) => w.startsWith(lower))) return 2;
    return 3;
  };
  const users = found
    .sort((a, b) => rank(a) - rank(b) || a.displayName.localeCompare(b.displayName))
    .slice(0, limit);
  res.json({ users: users.map((u) => ({ username: u.username, displayName: u.displayName })) });
});

// ?period=month -> ranked by reviews submitted since the 1st of the current month
router.get("/members/top", async (req, res) => {
  const limit = limitParam(req.query.limit, 5, 20);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const top = await Review.aggregate([
    ...(req.query.period === "month" ? [{ $match: { createdAt: { $gte: monthStart } } }] : []),
    { $group: { _id: "$user", reviews: { $sum: 1 }, helpful: { $sum: "$likesCount" } } },
    { $sort: { reviews: -1, helpful: -1, _id: 1 } },
    { $limit: limit },
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
    { $unwind: "$user" },
    { $lookup: { from: "follows", localField: "_id", foreignField: "following", as: "followers" } },
    { $project: { reviews: 1, helpful: 1, username: "$user.username", displayName: "$user.displayName", followers: { $size: "$followers" } } },
  ]);
  res.json({ users: top.map(({ _id, ...u }) => u) });
});

/* ---------- Activity feed ---------- */
// scope=following: people you follow · scope=all: everyone
router.get("/activity", async (req, res) => {
  const limit = limitParam(req.query.limit, 12, 40);
  let ids = null;
  if (req.query.scope === "following") {
    if (!req.user) return res.status(401).json({ error: "Please log in first." });
    ids = await followingIds(req.user);
    if (!ids.length) return res.json({ items: [], followingCount: 0 });
  }
  const by = (field) => (ids ? { [field]: { $in: ids } } : {});
  const [reviews, likes, follows, added, joins, posts] = await Promise.all([
    Review.find(by("user")).sort({ createdAt: -1 }).limit(limit).populate("user", "username displayName"),
    Like.find(by("user")).sort({ createdAt: -1 }).limit(limit).populate("user", "username displayName"),
    Follow.find(by("follower")).sort({ createdAt: -1 }).limit(limit).populate("follower following", "username displayName"),
    Perfume.find({ source: "community", ...by("addedBy") }).sort({ createdAt: -1 }).limit(limit).populate("addedBy", "username displayName"),
    GroupMember.find(by("user")).sort({ createdAt: -1 }).limit(limit).populate("user", "username displayName").populate("group", "slug name"),
    GroupPost.find({ parent: null, ...by("user") }).sort({ createdAt: -1 }).limit(limit).populate("user", "username displayName").populate("group", "slug name"),
  ]);
  const items = [
    ...reviews.filter((r) => r.user).map((r) => ({ type: "review", user: authorJSON(r.user), perfume: r.perfume, rating: r.rating, at: r.createdAt })),
    ...likes.filter((l) => l.user).map((l) => ({ type: "like", user: authorJSON(l.user), perfume: l.perfume, at: l.createdAt })),
    ...follows.filter((f) => f.follower && f.following).map((f) => ({ type: "follow", user: authorJSON(f.follower), target: authorJSON(f.following), at: f.createdAt })),
    ...added.filter((p) => p.addedBy).map((p) => ({ type: "added", user: authorJSON(p.addedBy), perfume: p.slug, at: p.createdAt })),
    ...joins.filter((j) => j.user && j.group).map((j) => ({ type: "joined", user: authorJSON(j.user), group: { slug: j.group.slug, name: j.group.name }, at: j.createdAt })),
    ...posts.filter((g) => g.user && g.group).map((g) => ({ type: "posted", user: authorJSON(g.user), group: { slug: g.group.slug, name: g.group.name }, at: g.createdAt })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, limit);
  res.json({ items, followingCount: ids ? ids.length : undefined });
});

/* ---------- Groups ---------- */
async function findGroup(req, res) {
  const group = await Group.findOne({ slug: String(req.params.slug) });
  if (!group) res.status(404).json({ error: "Group not found." });
  return group;
}

const isMemberOf = (group, user) => (user ? GroupMember.exists({ group: group._id, user: user._id }) : null);

// Members, posts and recent activity for every group (one round of aggregations)
async function groupStats() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [members, posts] = await Promise.all([
    GroupMember.aggregate([{ $group: { _id: "$group", members: { $sum: 1 } } }]),
    GroupPost.aggregate([{ $group: {
      _id: "$group",
      posts: { $sum: { $cond: [{ $eq: ["$parent", null] }, 1, 0] } },
      messages: { $sum: 1 },
      week: { $sum: { $cond: [{ $and: [{ $eq: ["$parent", null] }, { $gte: ["$createdAt", weekAgo] }] }, 1, 0] } },
      last: { $max: "$createdAt" },
    } }]),
  ]);
  const stats = {};
  members.forEach((m) => { stats[m._id] = { members: m.members, posts: 0, messages: 0, week: 0, last: null }; });
  posts.forEach((p) => { stats[p._id] = { members: 0, ...stats[p._id], posts: p.posts, messages: p.messages, week: p.week, last: p.last }; });
  return stats;
}

function groupJSON(g, stat = {}, extra = {}) {
  return {
    slug: g.slug,
    name: g.name,
    description: g.description,
    family: g.family,
    source: g.source,
    createdBy: g.createdBy && g.createdBy.username ? authorJSON(g.createdBy) : null,
    createdAt: g.createdAt,
    members: stat.members || 0,
    posts: stat.posts || 0,
    messages: stat.messages || 0,
    postsThisWeek: stat.week || 0,
    lastActivity: stat.last || null,
    ...extra,
  };
}

function postJSON(p, me) {
  return {
    id: p._id,
    user: authorJSON(p.user),
    text: p.text,
    perfume: p.perfume,
    parent: p.parent,
    likes: p.likesCount || 0,
    likedByMe: !!(me && (p.likedBy || []).some((id) => id.equals(me._id))),
    replies: p.repliesCount || 0,
    createdAt: p.createdAt,
  };
}

router.get("/groups", async (req, res) => {
  const [groups, stats, mine] = await Promise.all([
    Group.find().populate("createdBy", "username displayName"),
    groupStats(),
    req.user ? GroupMember.find({ user: req.user._id }).distinct("group") : [],
  ]);
  const mineSet = new Set(mine.map(String));
  const list = groups
    .map((g) => groupJSON(g, stats[g._id], { isMember: mineSet.has(String(g._id)) }))
    .sort((a, b) => b.postsThisWeek - a.postsThisWeek || b.members - a.members);
  res.json({ groups: list });
});

// Live duplicate check for "Create a group"
router.get("/groups/check", async (req, res) => {
  const g = await Group.findOne({ nameKey: normalize(text(req.query.name, 60)) });
  res.json({ exists: !!g, group: g ? { slug: g.slug, name: g.name } : null });
});

router.post("/groups", requireUser, async (req, res) => {
  const name = text(req.body.name, 60);
  const description = text(req.body.description, 240);
  const family = FAMILIES.includes(req.body.family) ? req.body.family : null;
  const fields = {};
  if (name.length < 3) fields.name = "Please give the group a name (3+ characters).";
  if (description.length < 10) fields.description = "Tell people what the group is about (10+ characters).";
  if (Object.keys(fields).length) return res.status(400).json({ error: "Please fix the highlighted fields.", fields });

  const existing = await Group.findOne({ nameKey: normalize(name) });
  if (existing) {
    return res.status(409).json({ error: "A group with this name already exists.", existing: { slug: existing.slug, name: existing.name } });
  }
  let slug = slugify(name) || "group";
  for (let i = 2; await Group.exists({ slug }); i++) slug = `${slugify(name)}-${i}`;
  const group = await Group.create({ slug, name, nameKey: normalize(name), description, family, source: "member", createdBy: req.user._id });
  await GroupMember.create({ group: group._id, user: req.user._id });   // creators join automatically
  await group.populate("createdBy", "username displayName");
  res.status(201).json({ group: groupJSON(group, { members: 1 }, { isMember: true }) });
});

router.get("/groups/:slug", async (req, res) => {
  const group = await findGroup(req, res);
  if (!group) return;
  await group.populate("createdBy", "username displayName");
  const [stats, isMember, recent, topPerfumes] = await Promise.all([
    groupStats(),
    isMemberOf(group, req.user),
    GroupMember.find({ group: group._id }).sort({ createdAt: -1 }).limit(8).populate("user", "username displayName"),
    GroupPost.aggregate([
      { $match: { group: group._id, perfume: { $ne: null } } },
      { $group: { _id: "$perfume", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 5 },
    ]),
  ]);
  res.json({
    group: groupJSON(group, stats[group._id], {
      isMember: !!isMember,
      recentMembers: recent.filter((m) => m.user).map((m) => authorJSON(m.user)),
      topPerfumes: topPerfumes.map((t) => ({ slug: t._id, mentions: t.n })),
    }),
  });
});

router.put("/groups/:slug/membership", requireUser, async (req, res) => {
  const group = await findGroup(req, res);
  if (!group) return;
  await GroupMember.updateOne(
    { group: group._id, user: req.user._id },
    { $setOnInsert: { group: group._id, user: req.user._id } },
    { upsert: true }
  );
  res.json({ isMember: true, members: await GroupMember.countDocuments({ group: group._id }) });
});

router.delete("/groups/:slug/membership", requireUser, async (req, res) => {
  const group = await findGroup(req, res);
  if (!group) return;
  await GroupMember.deleteOne({ group: group._id, user: req.user._id });
  res.json({ isMember: false, members: await GroupMember.countDocuments({ group: group._id }) });
});

router.get("/groups/:slug/members", async (req, res) => {
  const group = await findGroup(req, res);
  if (!group) return;
  const [rows, total] = await Promise.all([
    GroupMember.find({ group: group._id }).sort({ createdAt: -1 }).limit(limitParam(req.query.limit, 60, 200)).populate("user", "username displayName bio"),
    GroupMember.countDocuments({ group: group._id }),
  ]);
  res.json({ users: rows.filter((r) => r.user).map((r) => ({ ...authorJSON(r.user), bio: r.user.bio })), total });
});

router.get("/groups/:slug/posts", async (req, res) => {
  const group = await findGroup(req, res);
  if (!group) return;
  const limit = limitParam(req.query.limit, 10, 50);
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const sort = req.query.sort === "top" ? { likesCount: -1, createdAt: -1 } : { createdAt: -1 };
  const filter = { group: group._id, parent: null };
  const [list, total] = await Promise.all([
    GroupPost.find(filter).sort(sort).skip(offset).limit(limit).populate("user", "username displayName"),
    GroupPost.countDocuments(filter),
  ]);
  res.json({ posts: list.filter((p) => p.user).map((p) => postJSON(p, req.user)), total, hasMore: offset + list.length < total });
});

router.get("/groups/:slug/posts/:id/replies", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Post not found." });
  const list = await GroupPost.find({ parent: req.params.id }).sort({ createdAt: 1 }).limit(100).populate("user", "username displayName");
  res.json({ replies: list.filter((p) => p.user).map((p) => postJSON(p, req.user)) });
});

router.post("/groups/:slug/posts", requireUser, async (req, res) => {
  const group = await findGroup(req, res);
  if (!group) return;
  if (!(await isMemberOf(group, req.user))) return res.status(403).json({ error: "Join the group to post." });
  const body = text(req.body.text, 2000);
  if (body.length < 2) return res.status(400).json({ error: "Please write something first." });
  let parent = null;
  if (req.body.parent) {
    if (!mongoose.isValidObjectId(req.body.parent)) return res.status(400).json({ error: "Post not found." });
    parent = await GroupPost.findOne({ _id: req.body.parent, group: group._id, parent: null });
    if (!parent) return res.status(400).json({ error: "Post not found." });
  }
  const perfumeSlug = !parent && req.body.perfume ? String(req.body.perfume) : null;
  if (perfumeSlug && !(await Perfume.exists({ slug: perfumeSlug }))) return res.status(400).json({ error: "Perfume not found." });

  const post = await GroupPost.create({ group: group._id, user: req.user._id, text: body, perfume: perfumeSlug, parent: parent ? parent._id : null });
  if (parent) await GroupPost.updateOne({ _id: parent._id }, { $inc: { repliesCount: 1 } }, { timestamps: false });
  await post.populate("user", "username displayName");
  res.status(201).json({ post: postJSON(post, req.user) });
});

router.delete("/group-posts/:id", requireUser, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Post not found." });
  const post = await GroupPost.findById(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found." });
  if (!post.user.equals(req.user._id)) return res.status(403).json({ error: "You can only delete your own posts." });
  if (post.parent) await GroupPost.updateOne({ _id: post.parent }, { $inc: { repliesCount: -1 } }, { timestamps: false });
  else await GroupPost.deleteMany({ parent: post._id });
  await post.deleteOne();
  res.json({ ok: true });
});

async function setPostLike(req, res, liked) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Post not found." });
  const me = req.user._id;
  const updated = liked
    ? await GroupPost.findOneAndUpdate({ _id: req.params.id, likedBy: { $ne: me } }, { $push: { likedBy: me }, $inc: { likesCount: 1 } }, { new: true, timestamps: false })
    : await GroupPost.findOneAndUpdate({ _id: req.params.id, likedBy: me }, { $pull: { likedBy: me }, $inc: { likesCount: -1 } }, { new: true, timestamps: false });
  const post = updated || (await GroupPost.findById(req.params.id));
  if (!post) return res.status(404).json({ error: "Post not found." });
  res.json({ liked, likes: post.likesCount });
}
router.put("/group-posts/:id/like", requireUser, (req, res) => setPostLike(req, res, true));
router.delete("/group-posts/:id/like", requireUser, (req, res) => setPostLike(req, res, false));

/* ---------- Group posts per month (homepage chart) ---------- */
let groupTrendCache = { at: 0, data: null };

router.get("/stats/group-posts", async (req, res) => {
  if (groupTrendCache.data && Date.now() - groupTrendCache.at < 60 * 1000) return res.json(groupTrendCache.data);
  const MONTHS = 12;
  const now = new Date();
  const months = Array.from({ length: MONTHS }, (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS - 1 - i), 1)));
  const rows = await GroupPost.aggregate([
    { $match: { parent: null, createdAt: { $gte: months[0] } } },
    { $group: { _id: { g: "$group", m: { $dateTrunc: { date: "$createdAt", unit: "month", timezone: "UTC" } } }, n: { $sum: 1 } } },
  ]);
  const groups = await Group.find({}, "slug name family");
  const byId = new Map(groups.map((g) => [String(g._id), g]));
  const series = new Map();
  for (const { _id, n } of rows) {
    const g = byId.get(String(_id.g));
    if (!g) continue;
    const idx = (new Date(_id.m).getUTCFullYear() - months[0].getUTCFullYear()) * 12 + new Date(_id.m).getUTCMonth() - months[0].getUTCMonth();
    if (idx < 0 || idx >= MONTHS) continue;
    if (!series.has(g.slug)) series.set(g.slug, { slug: g.slug, name: g.name, values: new Array(MONTHS).fill(0) });
    series.get(g.slug).values[idx] += n;
  }
  const list = [...series.values()].sort((a, b) => b.values.reduce((x, y) => x + y, 0) - a.values.reduce((x, y) => x + y, 0));
  const totals = months.map((_, i) => list.reduce((sum, s) => sum + s.values[i], 0));
  const data = { months, series: list, totals, totalPosts: totals.reduce((a, b) => a + b, 0) };
  groupTrendCache = { at: Date.now(), data };
  res.json(data);
});

/* ---------- Messenger (history over REST; live delivery over Socket.io, see lib/realtime.js) ---------- */
router.get("/conversations", requireUser, async (req, res) => {
  res.json({ conversations: await chat.listConversations(req.user, realtime.isOnline), unread: await chat.unreadCount(req.user) });
});

// Open (or start) a chat with someone
router.post("/conversations", requireUser, async (req, res) => {
  const other = await User.findOne({ username: String(req.body.username || "").toLowerCase() });
  if (!other) return res.status(404).json({ error: "User not found." });
  if (other._id.equals(req.user._id)) return res.status(400).json({ error: "You can't message yourself." });
  const conversation = await chat.findOrCreateConversation(req.user, other);
  await conversation.populate("participants", "username displayName");
  res.json({ conversation: chat.conversationJSON(conversation, req.user, await chat.unreadIn(conversation, req.user), realtime.isOnline(other._id)) });
});

// Messages, newest last. `before` (ISO date) loads older ones.
router.get("/conversations/:id/messages", requireUser, async (req, res) => {
  const conversation = await chat.myConversation(req.user, req.params.id);
  if (!conversation) return res.status(404).json({ error: "Conversation not found." });
  const limit = limitParam(req.query.limit, 30, 100);
  const filter = { conversation: conversation._id };
  const before = req.query.before ? new Date(req.query.before) : null;
  if (before && !isNaN(before)) filter.createdAt = { $lt: before };
  const list = await Message.find(filter).sort({ createdAt: -1 }).limit(limit + 1).populate("sender", "username");
  res.json({ messages: list.slice(0, limit).reverse().map((m) => chat.messageJSON(m)), hasMore: list.length > limit });
});

router.get("/messages/unread", requireUser, async (req, res) => {
  res.json({ count: await chat.unreadCount(req.user) });
});

/* ---------- Review trends (homepage chart) ----------
   Cumulative reviews per perfume, week by week, and which perfume
   had the most reviews ("the leader") at the end of each week. */
let trendCache = { at: 0, data: null };

router.get("/stats/review-trends", async (req, res) => {
  if (trendCache.data && Date.now() - trendCache.at < 60 * 1000) return res.json(trendCache.data);

  const WEEKS = 52;
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const now = new Date();
  // Monday 00:00 UTC of the current week
  const thisWeek = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
  const weeks = Array.from({ length: WEEKS }, (_, i) => new Date(thisWeek.getTime() - (WEEKS - 1 - i) * weekMs));
  const start = weeks[0];

  const rows = await Review.aggregate([
    { $group: {
      _id: { p: "$perfume", w: { $dateTrunc: { date: "$createdAt", unit: "week", startOfWeek: "monday", timezone: "UTC" } } },
      n: { $sum: 1 },
    } },
  ]);

  // cumulative counts per perfume, per week
  const cum = {};
  for (const { _id, n } of rows) {
    const series = cum[_id.p] || (cum[_id.p] = new Array(WEEKS).fill(0));
    const idx = _id.w < start ? 0 : Math.round((_id.w - start) / weekMs);
    if (idx < WEEKS) series[idx] += n;
  }
  for (const series of Object.values(cum)) for (let i = 1; i < WEEKS; i++) series[i] += series[i - 1];

  const totals = new Array(WEEKS).fill(0);
  for (const series of Object.values(cum)) series.forEach((v, i) => { totals[i] += v; });

  // leader each week (ties keep the previous leader)
  const leaders = [];
  for (let i = 0; i < WEEKS; i++) {
    let best = leaders[i - 1] || null;
    for (const [slug, series] of Object.entries(cum)) {
      if (!best || series[i] > cum[best][i]) best = slug;
    }
    leaders.push(best && cum[best][i] > 0 ? best : null);
  }

  // lines: everyone who ever led + the current top, max 5
  const byFinal = Object.keys(cum).sort((a, b) => cum[b][WEEKS - 1] - cum[a][WEEKS - 1]);
  const picked = [...new Set([...leaders.filter(Boolean), ...byFinal])].slice(0, 5)
    .sort((a, b) => cum[b][WEEKS - 1] - cum[a][WEEKS - 1]);

  const data = {
    weeks,
    totals,
    totalReviews: await Review.countDocuments(),
    leaders,
    series: picked.map((slug) => ({ slug, values: cum[slug] })),
  };
  trendCache = { at: Date.now(), data };
  res.json(data);
});

/* ---------- Help center: "get back to me" requests ---------- */
const contactLimiter = rateLimit({ max: 5, windowMs: 15 * 60 * 1000 });

router.post("/contact", contactLimiter, async (req, res) => {
  const name = text(req.body.name, 80);
  const email = text(req.body.email, 120).toLowerCase();
  const message = text(req.body.message, 1000);
  const fields = {};
  if (!name) fields.name = "Please enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = "Please enter a valid email.";
  if (Object.keys(fields).length) return res.status(400).json({ error: "Please fix the highlighted fields.", fields });
  await ContactRequest.create({ name, email, message, user: req.user ? req.user._id : null });
  res.status(201).json({ ok: true });
});

/* ---------- Fallbacks ---------- */
router.use((req, res) => res.status(404).json({ error: "Not found." }));

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err.type === "entity.too.large") return res.status(413).json({ error: "That file is too large (max 5 MB)." });
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid request." });
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

module.exports = router;
