const Perfume = require("../models/Perfume");
const Review = require("../models/Review");
const Like = require("../models/Like");
const PerformanceVote = require("../models/PerformanceVote");
const GroupPost = require("../models/GroupPost");
const realtime = require("../socket/realtime");
const { slugify, normalize, nameKey, perfumeKey } = require("../utils/perfumeKey");
const { isImage, saveImage, removeUpload } = require("../utils/uploads");
const { perfumeStats, clearPerfumeStats, perfumeList, clearPerfumeList } = require("../utils/perfumeCache");
const {
  FAMILIES, text, perfumeJSON, statsFor, requirePerfume, reviewsChanged,
} = require("../utils/helpers");

async function findDuplicate(brand, name, exceptSlug = null) {
  const nk = nameKey(brand, name);
  if (!nk) return null;
  const notSelf = exceptSlug ? { slug: { $ne: exceptSlug } } : {};
  const exact = await Perfume.findOne({ key: perfumeKey(brand, name), ...notSelf });
  if (exact) return exact;
  const b = normalize(brand);
  const sameName = await Perfume.find({ nameKey: nk, ...notSelf });
  return sameName.find((c) => !b || !normalize(c.brand) || normalize(c.brand) === b) || null;
}

exports.list = async (req, res) => {
  const [perfumes, stats] = await Promise.all([perfumeList(), perfumeStats()]);
  res.json({ perfumes, stats });
};

exports.check = async (req, res) => {
  const dup = await findDuplicate(text(req.query.brand, 60), text(req.query.name, 80), text(req.query.except, 200) || null);
  res.json({ exists: !!dup, perfume: dup ? { slug: dup.slug, brand: dup.brand, name: dup.name } : null });
};

function perfumeFields(input) {
  const brand = text(input.brand, 60);
  const name = text(input.name, 80);
  const tags = Array.isArray(input.tags) ? [...new Set(input.tags.filter((t) => FAMILIES.includes(t)))] : [];
  const notes = notesFrom(input.notes);
  const fields = {};
  if (!name) fields.name = "Please enter the perfume's name.";
  if (!brand) fields.brand = "Please enter the brand.";
  if (notes.length !== NOTES_REQUIRED) fields.notes = `Please enter exactly ${NOTES_REQUIRED} notes.`;
  return { brand, name, tags, notes, fields };
}

async function ownPerfume(req, res) {
  const perfume = await Perfume.findOne({ slug: req.params.slug });
  if (!perfume) { res.status(404).json({ error: "Perfume not found." }); return null; }
  if (perfume.source !== "community" || !perfume.addedBy || !perfume.addedBy.equals(req.user._id)) {
    res.status(403).json({ error: "Only the member who added this perfume can change it." });
    return null;
  }
  return perfume;
}

// Add a perfume: the photo is the request body (required), the details come in the X-Perfume header (JSON)
exports.create = async (req, res) => {
  let info = {};
  try { info = JSON.parse(decodeURIComponent(req.get("X-Perfume") || "{}")) || {}; } catch (err) { info = {}; }
  const { brand, name, tags, notes, fields } = perfumeFields(info);
  if (!isImage(req)) fields.photo = "Please add a photo of the perfume (JPG, PNG or WebP).";
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

  const image = await saveImage(slug, req);
  const perfume = await Perfume.create({
    slug, brand, name, tags, notes, image,
    key: perfumeKey(brand, name),
    nameKey: nameKey(brand, name),
    source: "community",
    addedBy: req.user._id,
  });
  clearPerfumeList();
  await perfume.populate("addedBy", "username");
  realtime.emitToAll("perfume:added", { perfume: perfumeJSON(perfume) });
  res.status(201).json({ perfume: perfumeJSON(perfume) });
};

// Edit a perfume you added (the address stays the same, so links and reviews keep working)
exports.update = async (req, res) => {
  const perfume = await ownPerfume(req, res);
  if (!perfume) return;
  const { brand, name, tags, notes, fields } = perfumeFields(req.body || {});
  if (Object.keys(fields).length) return res.status(400).json({ error: "Please fix the highlighted fields.", fields });
  const dup = await findDuplicate(brand, name, perfume.slug);
  if (dup) {
    return res.status(409).json({
      error: "This perfume is already on LUMIERE.",
      existing: { slug: dup.slug, brand: dup.brand, name: dup.name },
    });
  }
  Object.assign(perfume, { brand, name, tags, notes, key: perfumeKey(brand, name), nameKey: nameKey(brand, name) });
  await perfume.save();
  clearPerfumeList();
  await perfume.populate("addedBy", "username");
  const json = perfumeJSON(perfume);
  realtime.emitToAll("perfume:changed", { perfume: json });
  res.json({ perfume: json });
};

exports.remove = async (req, res) => {
  const perfume = await ownPerfume(req, res);
  if (!perfume) return;
  const slug = perfume.slug;
  await Promise.all([
    Review.deleteMany({ perfume: slug }),
    Like.deleteMany({ perfume: slug }),
    PerformanceVote.deleteMany({ perfume: slug }),
    GroupPost.updateMany({ perfume: slug }, { $set: { perfume: null } }),
  ]);
  await perfume.deleteOne();
  clearPerfumeStats();
  clearPerfumeList();
  await removeUpload(perfume.image);
  realtime.emitToAll("perfume:deleted", { slug });
  reviewsChanged(slug);
  res.json({ ok: true });
};

exports.updateImage = async (req, res) => {
  const perfume = await ownPerfume(req, res);
  if (!perfume) return;
  if (!isImage(req)) return res.status(400).json({ error: "Please upload a JPG, PNG or WebP image." });
  const old = perfume.image;
  perfume.image = await saveImage(perfume.slug, req);
  await perfume.save();
  clearPerfumeList();
  await removeUpload(old);
  realtime.emitToAll("perfume:changed", { perfume: perfumeJSON(await perfume.populate("addedBy", "username")) });
  res.json({ image: perfume.image });
};

const PERF_KEYS = ["longevity", "sillage", "value"];

const WEAR_KEYS = ["Spring", "Summer", "Fall", "Winter", "Day", "Night"];

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

exports.performance = async (req, res) => {
  res.json(await performanceFor(req.params.slug, req.user));
};

exports.votePerformance = async (req, res) => {
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
};

exports.voteWear = async (req, res) => {
  if (!(await requirePerfume(req, res))) return;
  const pick = String(req.body.pick || "");
  if (!WEAR_KEYS.includes(pick)) return res.status(400).json({ error: "Unknown season or time." });
  await PerformanceVote.findOneAndUpdate(
    { user: req.user._id, perfume: req.params.slug },
    { [req.body.on ? "$addToSet" : "$pull"]: { wear: pick }, $setOnInsert: { user: req.user._id, perfume: req.params.slug } },
    { upsert: true, setDefaultsOnInsert: true }
  );
  res.json(await performanceFor(req.params.slug, req.user));
};

exports.voteAgree = async (req, res) => {
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
};

const NOTES_REQUIRED = 3;

function notesFrom(value) {
  const input = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(input.map((n) => text(n, 40)).filter(Boolean))];
}

exports.updateNotes = async (req, res) => {
  const notes = notesFrom(req.body.notes);
  if (notes.length !== NOTES_REQUIRED) return res.status(400).json({ error: `Please enter exactly ${NOTES_REQUIRED} notes.` });

  const perfume = await Perfume.findOne({ slug: req.params.slug });
  if (!perfume) return res.status(404).json({ error: "Perfume not found." });
  if (perfume.source !== "community" || !perfume.addedBy || !perfume.addedBy.equals(req.user._id)) {
    return res.status(403).json({ error: "Only the member who added this perfume can edit its notes." });
  }
  perfume.notes = notes;
  perfume.notesAddedBy = null;
  const updated = await perfume.save();
  clearPerfumeList();
  const payload = { slug: updated.slug, notes: updated.notes, notesAddedBy: null };
  realtime.emitToAll("perfume:notes", payload);
  res.json(payload);
};

exports.like = async (req, res) => {
  if (!(await requirePerfume(req, res))) return;
  await Like.updateOne(
    { user: req.user._id, perfume: req.params.slug },
    { $setOnInsert: { user: req.user._id, perfume: req.params.slug } },
    { upsert: true }
  );
  clearPerfumeStats();
  res.json({ liked: true, stats: await statsFor(req.params.slug) });
};

exports.unlike = async (req, res) => {
  await Like.deleteOne({ user: req.user._id, perfume: req.params.slug });
  clearPerfumeStats();
  res.json({ liked: false, stats: await statsFor(req.params.slug) });
};
