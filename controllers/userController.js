const User = require("../models/User");
const Perfume = require("../models/Perfume");
const Review = require("../models/Review");
const Like = require("../models/Like");
const Follow = require("../models/Follow");
const GroupMember = require("../models/GroupMember");
const GroupPost = require("../models/GroupPost");
const Group = require("../models/Group");
const PerformanceVote = require("../models/PerformanceVote");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Session = require("../models/Session");
const ContactRequest = require("../models/ContactRequest");
const realtime = require("../lib/realtime");
const { checkPassword, endSession } = require("../lib/auth");
const { text, limitParam, escapeRegex, authorJSON, reviewJSON, followingIds } = require("../lib/helpers");

exports.profile = async (req, res) => {
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
};

exports.updateMe = async (req, res) => {
  const displayName = text(req.body.displayName, 40);
  if (!displayName) return res.status(400).json({ error: "Please enter your name.", fields: { displayName: "Required." } });
  req.user.displayName = displayName;
  req.user.bio = text(req.body.bio, 160);
  await req.user.save();
  res.json({ user: req.user.toPublic() });
};

exports.deleteMe = async (req, res) => {
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!(await checkPassword(password, req.user.passwordHash))) {
    return res.status(401).json({ error: "That password isn't right.", fields: { password: "Wrong password." } });
  }
  const me = req.user._id;
  const [myPosts, conversations] = await Promise.all([
    GroupPost.find({ user: me }, "parent"),
    Conversation.find({ participants: me }).distinct("_id"),
  ]);
  const myTopPosts = myPosts.filter((p) => !p.parent).map((p) => p._id);
  for (const reply of myPosts.filter((p) => p.parent)) {
    await GroupPost.updateOne({ _id: reply.parent }, { $inc: { repliesCount: -1 } }, { timestamps: false });
  }
  await Promise.all([
    Review.deleteMany({ user: me }),
    Like.deleteMany({ user: me }),
    PerformanceVote.deleteMany({ user: me }),
    Follow.deleteMany({ $or: [{ follower: me }, { following: me }] }),
    GroupMember.deleteMany({ user: me }),
    GroupPost.deleteMany({ $or: [{ user: me }, { parent: { $in: myTopPosts } }] }),
    Review.updateMany({ likedBy: me }, { $pull: { likedBy: me }, $inc: { likesCount: -1 } }, { timestamps: false }),
    GroupPost.updateMany({ likedBy: me }, { $pull: { likedBy: me }, $inc: { likesCount: -1 } }, { timestamps: false }),
    Message.deleteMany({ conversation: { $in: conversations } }),
    Conversation.deleteMany({ _id: { $in: conversations } }),
    Perfume.updateMany({ addedBy: me }, { $set: { addedBy: null } }),
    Perfume.updateMany({ notesAddedBy: me }, { $set: { notesAddedBy: null } }),
    Group.updateMany({ createdBy: me }, { $set: { createdBy: null } }),
    ContactRequest.updateMany({ user: me }, { $set: { user: null } }),
  ]);
  await endSession(req, res);
  await Session.deleteMany({ user: me });
  await req.user.deleteOne();
  realtime.disconnectUser(me);
  realtime.emitToAll("reviews:changed", {});
  res.json({ ok: true });
};

async function findUser(req, res) {
  const user = await User.findOne({ username: String(req.params.username).toLowerCase() });
  if (!user) res.status(404).json({ error: "User not found." });
  return user;
}

exports.follow = async (req, res) => {
  const target = await findUser(req, res);
  if (!target) return;
  if (target._id.equals(req.user._id)) return res.status(400).json({ error: "You can't follow yourself." });
  await Follow.updateOne(
    { follower: req.user._id, following: target._id },
    { $setOnInsert: { follower: req.user._id, following: target._id } },
    { upsert: true }
  );
  res.json({ following: true, followers: await Follow.countDocuments({ following: target._id }) });
};

exports.unfollow = async (req, res) => {
  const target = await findUser(req, res);
  if (!target) return;
  await Follow.deleteOne({ follower: req.user._id, following: target._id });
  res.json({ following: false, followers: await Follow.countDocuments({ following: target._id }) });
};

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
exports.followers = (req, res) => followList(req, res, "followers");
exports.following = (req, res) => followList(req, res, "following");

exports.directory = async (req, res) => {
  const limit = limitParam(req.query.limit, 30, 60);
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const q = text(req.query.search, 40).replace(/^@/, "");
  const re = q ? new RegExp(escapeRegex(q), "i") : null;
  const filter = re ? { $or: [{ username: re }, { displayName: re }] } : {};
  const [list, total] = await Promise.all([
    User.find(filter, "username displayName bio").sort({ displayName: 1, _id: 1 }).skip(offset).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({
    users: list.map((u) => ({ username: u.username, displayName: u.displayName, bio: u.bio })),
    total,
    hasMore: offset + list.length < total,
  });
};

exports.search = async (req, res) => {
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
};

exports.top = async (req, res) => {
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
};

exports.activity = async (req, res) => {
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
};
