const Review = require("../models/Review");
const Like = require("../models/Like");
const Perfume = require("../models/Perfume");
const { perfumeJSON } = require("./helpers");

// Every visit starts with GET /api/perfumes, and no perfume (or its photo) can appear before it answers.
// Building that answer means reading all perfumes and counting every review and like, which takes the
// database up to a second. So both parts are kept in memory and rebuilt only when something changes them:
// clearPerfumeStats() after a like, review or deletion, clearPerfumeList() after a perfume is added,
// edited or deleted. Both are also rebuilt at least once a minute, for changes made by another server that
// shares the database (for example the site running on a laptop).
const KEEP_MS = 60 * 1000;
let cache = { at: 0, data: null, pending: null };
let listCache = { at: 0, data: null, pending: null };

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

// For every perfume: reviews, rating sum, likes, and activity this week / last week / this month
async function countStats() {
  const [reviewStats, likeStats] = await Promise.all([
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
  return stats;
}

function perfumeStats() {
  if (cache.data && Date.now() - cache.at < KEEP_MS) return Promise.resolve(cache.data);
  if (cache.pending) return cache.pending;
  const run = countStats()
    .then((data) => { if (cache.pending === run) cache = { at: Date.now(), data, pending: null }; return data; })
    .catch((err) => { if (cache.pending === run) cache.pending = null; throw err; });
  cache.pending = run;
  return run;
}

function clearPerfumeStats() {
  cache = { at: 0, data: null, pending: null };
}

// All perfumes, as sent to the browser
function perfumeList() {
  if (listCache.data && Date.now() - listCache.at < KEEP_MS) return Promise.resolve(listCache.data);
  if (listCache.pending) return listCache.pending;
  const run = Perfume.find().populate("addedBy", "username").populate("notesAddedBy", "username").sort({ createdAt: 1 })
    .then((list) => { const data = list.map(perfumeJSON); if (listCache.pending === run) listCache = { at: Date.now(), data, pending: null }; return data; })
    .catch((err) => { if (listCache.pending === run) listCache.pending = null; throw err; });
  listCache.pending = run;
  return run;
}

function clearPerfumeList() {
  listCache = { at: 0, data: null, pending: null };
}

module.exports = { perfumeStats, clearPerfumeStats, perfumeList, clearPerfumeList };
