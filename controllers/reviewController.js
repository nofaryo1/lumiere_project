// Reviews: one perfume's reviews, writing / editing / deleting your own, all reviews, "helpful" votes
const mongoose = require("mongoose");
const Review = require("../models/Review");
const User = require("../models/User");
const {
  text, limitParam, escapeRegex, reviewJSON, statsFor, followingIds, requirePerfume, reviewsChanged,
} = require("../lib/helpers");

const SINCE_DAYS = { week: 7, month: 30, year: 365 };   // ?since= on the All reviews page

/* ---------- Reviews & likes ---------- */
exports.forPerfume = async (req, res) => {
  const [list, mine] = await Promise.all([
    Review.find({ perfume: req.params.slug }).sort({ likesCount: -1, createdAt: -1 }).limit(60).populate("user", "username displayName"),
    req.user ? Review.find({ perfume: req.params.slug, user: req.user._id }).sort({ createdAt: -1 }).populate("user", "username displayName") : [],
  ]);
  const all = [...mine.filter((m) => !list.some((r) => r._id.equals(m._id))), ...list];
  const counts = await Review.aggregate([{ $match: { perfume: req.params.slug } }, { $group: { _id: "$rating", n: { $sum: 1 } } }]);
  const breakdown = [1, 2, 3, 4, 5].map((star) => (counts.find((c) => c._id === star) || { n: 0 }).n);   // index 0 = 1★
  const total = breakdown.reduce((a, b) => a + b, 0);
  res.json({ reviews: all.filter((r) => r.user).map((r) => reviewJSON(r, req.user)), total, breakdown });
};

function reviewInput(req, res) {
  const rating = Number(req.body.rating);
  const body = text(req.body.text, 1000);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) { res.status(400).json({ error: "Please choose a star rating." }); return null; }
  if (body.length < 10) { res.status(400).json({ error: "Please write at least a few words (10+ characters)." }); return null; }
  return { rating, text: body };
}

// Post a review (members can review the same perfume again later)
exports.create = async (req, res) => {
  if (!(await requirePerfume(req, res))) return;
  const input = reviewInput(req, res);
  if (!input) return;
  await Review.create({ user: req.user._id, perfume: req.params.slug, ...input });
  reviewsChanged(req.params.slug);
  res.status(201).json({ stats: await statsFor(req.params.slug) });
};

// Edit / delete one of your own reviews
async function myReview(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) { res.status(404).json({ error: "Review not found." }); return null; }
  const review = await Review.findOne({ _id: req.params.id, user: req.user._id });
  if (!review) res.status(404).json({ error: "Review not found." });
  return review;
}

exports.update = async (req, res) => {
  const review = await myReview(req, res);
  if (!review) return;
  const input = reviewInput(req, res);
  if (!input) return;
  Object.assign(review, input);
  await review.save();
  res.json({ stats: await statsFor(review.perfume) });
};

exports.remove = async (req, res) => {
  const review = await myReview(req, res);
  if (!review) return;
  await review.deleteOne();
  reviewsChanged(review.perfume);
  res.json({ stats: await statsFor(review.perfume) });
};

/* ---------- All reviews (homepage "Popular reviews" + "See all reviews") ---------- */
exports.list = async (req, res) => {
  const sort = req.query.sort === "newest" ? { createdAt: -1 } : { likesCount: -1, createdAt: -1 };
  const limit = limitParam(req.query.limit, 10, 50);
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const filter = {};
  if (req.query.scope === "following") {
    if (!req.user) return res.status(401).json({ error: "Please log in first." });
    filter.user = { $in: await followingIds(req.user) };
  }
  if (req.query.rating && /^[1-5]$/.test(req.query.rating)) filter.rating = Number(req.query.rating);
  if (req.query.perfume) filter.perfume = text(req.query.perfume, 200);   // one perfume's reviews
  if (SINCE_DAYS[req.query.since]) filter.createdAt = { $gte: new Date(Date.now() - SINCE_DAYS[req.query.since] * 24 * 60 * 60 * 1000) };
  // ?q= : words in the review, or the reviewer's name / @username
  const q = text(req.query.q, 60).replace(/^@/, "");
  if (q) {
    const re = new RegExp(escapeRegex(q), "i");
    const reviewers = await User.find({ $or: [{ username: re }, { displayName: re }] }).distinct("_id");
    filter.$or = [{ text: re }, { user: { $in: reviewers } }];
  }
  const [list, total] = await Promise.all([
    Review.find(filter).sort(sort).skip(offset).limit(limit).populate("user", "username displayName"),
    Review.countDocuments(filter),
  ]);
  res.json({
    reviews: list.filter((r) => r.user).map((r) => reviewJSON(r, req.user)),
    total,
    hasMore: offset + list.length < total,
  });
};

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
exports.markHelpful = (req, res) => setReviewLike(req, res, true);
exports.unmarkHelpful = (req, res) => setReviewLike(req, res, false);
