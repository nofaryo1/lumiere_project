// LUMIERE JSON API, mounted at /api in server.js
const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");

const User = require("../models/User");
const Perfume = require("../models/Perfume");
const Review = require("../models/Review");
const Like = require("../models/Like");
const catalog = require("../data/catalog");
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
  const [likes, reviews] = await Promise.all([
    Like.find({ user: user._id }).sort({ createdAt: -1 }),
    Review.find({ user: user._id }).sort({ updatedAt: -1 }),
  ]);
  return {
    user: user.toPublic(),
    likes: likes.map((l) => l.perfume),
    reviews: reviews.map((r) => ({ perfume: r.perfume, rating: r.rating })),
  };
}

/* ---------- Catalog seeding ---------- */
async function seedCatalog() {
  const slugs = [];
  const ops = catalog.map(([brand, name, tags, notes]) => {
    const slug = slugify(`${brand} ${name}`);
    slugs.push(slug);
    return {
      updateOne: {
        filter: { slug },
        update: {
          $set: {
            brand, name,
            key: perfumeKey(brand, name),
            nameKey: nameKey(brand, name),
            tags: tags ? tags.split(" ") : [],
            notes: notes ? notes.split(", ") : [],
            image: `/images/perfumes/${slug}.jpg`,
            source: "catalog",
          },
        },
        upsert: true,
      },
    };
  });
  await Perfume.bulkWrite(ops);
  await Perfume.deleteMany({ source: "catalog", slug: { $nin: slugs } });
  console.log(`Perfume catalog ready (${slugs.length} perfumes)`);
}

if (mongoose.connection.readyState === 1) seedCatalog().catch(console.error);
else mongoose.connection.once("connected", () => seedCatalog().catch(console.error));

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
  const [likes, reviews, added] = await Promise.all([
    Like.find({ user: user._id }).sort({ createdAt: -1 }),
    Review.find({ user: user._id }).sort({ updatedAt: -1 }),
    Perfume.find({ addedBy: user._id }).sort({ createdAt: -1 }),
  ]);
  res.json({
    user: user.toPublic(),
    likes: likes.map((l) => l.perfume),
    reviews: reviews.map((r) => ({ perfume: r.perfume, rating: r.rating, text: r.text, createdAt: r.createdAt, updatedAt: r.updatedAt })),
    added: added.map((p) => p.slug),
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
router.get("/perfumes", async (req, res) => {
  const [list, reviewStats, likeStats] = await Promise.all([
    Perfume.find().populate("addedBy", "username").sort({ createdAt: 1 }),
    Review.aggregate([{ $group: { _id: "$perfume", reviews: { $sum: 1 }, ratingSum: { $sum: "$rating" } } }]),
    Like.aggregate([{ $group: { _id: "$perfume", likes: { $sum: 1 } } }]),
  ]);
  const stats = {};
  reviewStats.forEach((s) => { stats[s._id] = { reviews: s.reviews, ratingSum: s.ratingSum, likes: 0 }; });
  likeStats.forEach((s) => { stats[s._id] = { reviews: 0, ratingSum: 0, ...stats[s._id], likes: s.likes }; });
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

/* ---------- Reviews & likes ---------- */
async function requirePerfume(req, res) {
  const perfume = await Perfume.findOne({ slug: req.params.slug });
  if (!perfume) res.status(404).json({ error: "Perfume not found." });
  return perfume;
}

router.get("/perfumes/:slug/reviews", async (req, res) => {
  const list = await Review.find({ perfume: req.params.slug }).sort({ updatedAt: -1 }).limit(100).populate("user", "username displayName");
  res.json({
    reviews: list.filter((r) => r.user).map((r) => ({
      user: { username: r.user.username, displayName: r.user.displayName },
      rating: r.rating, text: r.text, createdAt: r.createdAt, updatedAt: r.updatedAt,
    })),
  });
});

router.put("/perfumes/:slug/review", requireUser, async (req, res) => {
  if (!(await requirePerfume(req, res))) return;
  const rating = Number(req.body.rating);
  const body = text(req.body.text, 1000);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: "Please choose a star rating." });
  if (body.length < 10) return res.status(400).json({ error: "Please write at least a few words (10+ characters)." });
  await Review.findOneAndUpdate(
    { user: req.user._id, perfume: req.params.slug },
    { rating, text: body },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  res.json({ stats: await statsFor(req.params.slug) });
});

router.delete("/perfumes/:slug/review", requireUser, async (req, res) => {
  await Review.deleteOne({ user: req.user._id, perfume: req.params.slug });
  res.json({ stats: await statsFor(req.params.slug) });
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
