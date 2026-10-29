const Review = require("../models/Review");
const Like = require("../models/Like");
const Follow = require("../models/Follow");
const Perfume = require("../models/Perfume");
const realtime = require("../socket/realtime");

const FAMILIES = ["woody", "floral", "fresh", "amber", "citrus", "musk", "spicy", "gourmand"];

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

const followingIds = (user) => Follow.find({ follower: user._id }).distinct("following");

async function requirePerfume(req, res) {
  const perfume = await Perfume.findOne({ slug: req.params.slug });
  if (!perfume) res.status(404).json({ error: "Perfume not found." });
  return perfume;
}

const reviewsChanged = (slug) => realtime.emitToAll("reviews:changed", { perfume: slug });

module.exports = {
  FAMILIES, text, perfumeJSON, statsFor, meJSON, authorJSON, reviewJSON, escapeRegex, limitParam,
  followingIds, requirePerfume, reviewsChanged,
};
