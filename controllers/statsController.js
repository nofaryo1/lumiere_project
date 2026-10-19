const Review = require("../models/Review");
const Group = require("../models/Group");
const GroupPost = require("../models/GroupPost");

let groupTrendCache = { at: 0, data: null };

exports.groupPosts = async (req, res) => {
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
};

let trendCache = { at: 0, data: null };

exports.reviewTrends = async (req, res) => {
  if (trendCache.data && Date.now() - trendCache.at < 60 * 1000) return res.json(trendCache.data);

  const WEEKS = 52;
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const now = new Date();
  const thisWeek = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
  const weeks = Array.from({ length: WEEKS }, (_, i) => new Date(thisWeek.getTime() - (WEEKS - 1 - i) * weekMs));
  const start = weeks[0];

  const rows = await Review.aggregate([
    { $group: {
      _id: { p: "$perfume", w: { $dateTrunc: { date: "$createdAt", unit: "week", startOfWeek: "monday", timezone: "UTC" } } },
      n: { $sum: 1 },
    } },
  ]);

  const cum = {};
  for (const { _id, n } of rows) {
    const series = cum[_id.p] || (cum[_id.p] = new Array(WEEKS).fill(0));
    const idx = _id.w < start ? 0 : Math.round((_id.w - start) / weekMs);
    if (idx < WEEKS) series[idx] += n;
  }
  for (const series of Object.values(cum)) for (let i = 1; i < WEEKS; i++) series[i] += series[i - 1];

  const totals = new Array(WEEKS).fill(0);
  for (const series of Object.values(cum)) series.forEach((v, i) => { totals[i] += v; });

  const leaders = [];
  for (let i = 0; i < WEEKS; i++) {
    let best = leaders[i - 1] || null;
    for (const [slug, series] of Object.entries(cum)) {
      if (!best || series[i] > cum[best][i]) best = slug;
    }
    leaders.push(best && cum[best][i] > 0 ? best : null);
  }

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
};
