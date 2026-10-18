// Discussion groups: list, create, edit / delete (creator), membership, posts (search, edit / delete your own),
// replies and post likes
const mongoose = require("mongoose");
const User = require("../models/User");
const Group = require("../models/Group");
const GroupMember = require("../models/GroupMember");
const GroupPost = require("../models/GroupPost");
const Perfume = require("../models/Perfume");
const { slugify, normalize } = require("../lib/perfumeKey");
const { FAMILIES, text, limitParam, escapeRegex, authorJSON } = require("../lib/helpers");

const SINCE_DAYS = { week: 7, month: 30, year: 365 };   // ?since= when searching posts

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
    edited: !!p.editedAt,
  };
}

exports.list = async (req, res) => {
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
};

// Live duplicate check for "Create a group"
exports.check = async (req, res) => {
  const except = text(req.query.except, 200);
  const g = await Group.findOne({ nameKey: normalize(text(req.query.name, 60)), ...(except ? { slug: { $ne: except } } : {}) });
  res.json({ exists: !!g, group: g ? { slug: g.slug, name: g.name } : null });
};

exports.create = async (req, res) => {
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
};

exports.show = async (req, res) => {
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
};

// Only the member who created a group can change it (built-in groups have no creator)
async function ownGroup(req, res) {
  const group = await findGroup(req, res);
  if (!group) return null;
  if (!group.createdBy || !group.createdBy.equals(req.user._id)) {
    res.status(403).json({ error: "Only the member who created this group can change it." });
    return null;
  }
  return group;
}

exports.update = async (req, res) => {
  const group = await ownGroup(req, res);
  if (!group) return;
  const name = text(req.body.name, 60);
  const description = text(req.body.description, 240);
  const family = FAMILIES.includes(req.body.family) ? req.body.family : null;
  const fields = {};
  if (name.length < 3) fields.name = "Please give the group a name (3+ characters).";
  if (description.length < 10) fields.description = "Tell people what the group is about (10+ characters).";
  if (Object.keys(fields).length) return res.status(400).json({ error: "Please fix the highlighted fields.", fields });
  const existing = await Group.findOne({ nameKey: normalize(name), _id: { $ne: group._id } });
  if (existing) {
    return res.status(409).json({ error: "A group with this name already exists.", existing: { slug: existing.slug, name: existing.name } });
  }
  Object.assign(group, { name, nameKey: normalize(name), description, family });   // the address (slug) stays the same
  await group.save();
  await group.populate("createdBy", "username displayName");
  const [stats, isMember] = await Promise.all([groupStats(), isMemberOf(group, req.user)]);
  res.json({ group: groupJSON(group, stats[group._id], { isMember: !!isMember }) });
};

// Delete a group you created, with its members list and all its posts
exports.remove = async (req, res) => {
  const group = await ownGroup(req, res);
  if (!group) return;
  await Promise.all([GroupMember.deleteMany({ group: group._id }), GroupPost.deleteMany({ group: group._id })]);
  await group.deleteOne();
  res.json({ ok: true });
};

exports.join = async (req, res) => {
  const group = await findGroup(req, res);
  if (!group) return;
  await GroupMember.updateOne(
    { group: group._id, user: req.user._id },
    { $setOnInsert: { group: group._id, user: req.user._id } },
    { upsert: true }
  );
  res.json({ isMember: true, members: await GroupMember.countDocuments({ group: group._id }) });
};

exports.leave = async (req, res) => {
  const group = await findGroup(req, res);
  if (!group) return;
  await GroupMember.deleteOne({ group: group._id, user: req.user._id });
  res.json({ isMember: false, members: await GroupMember.countDocuments({ group: group._id }) });
};

exports.members = async (req, res) => {
  const group = await findGroup(req, res);
  if (!group) return;
  const [rows, total] = await Promise.all([
    GroupMember.find({ group: group._id }).sort({ createdAt: -1 }).limit(limitParam(req.query.limit, 60, 200)).populate("user", "username displayName bio"),
    GroupMember.countDocuments({ group: group._id }),
  ]);
  res.json({ users: rows.filter((r) => r.user).map((r) => ({ ...authorJSON(r.user), bio: r.user.bio })), total });
};

exports.posts = async (req, res) => {
  const group = await findGroup(req, res);
  if (!group) return;
  const limit = limitParam(req.query.limit, 10, 50);
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const sort = req.query.sort === "top" ? { likesCount: -1, createdAt: -1 } : { createdAt: -1 };
  const filter = { group: group._id, parent: null };
  if (SINCE_DAYS[req.query.since]) filter.createdAt = { $gte: new Date(Date.now() - SINCE_DAYS[req.query.since] * 24 * 60 * 60 * 1000) };
  // ?q= : words in the post, or the author's name / @username
  const q = text(req.query.q, 60).replace(/^@/, "");
  if (q) {
    const re = new RegExp(escapeRegex(q), "i");
    const authors = await User.find({ $or: [{ username: re }, { displayName: re }] }).distinct("_id");
    filter.$or = [{ text: re }, { user: { $in: authors } }];
  }
  const [list, total] = await Promise.all([
    GroupPost.find(filter).sort(sort).skip(offset).limit(limit).populate("user", "username displayName"),
    GroupPost.countDocuments(filter),
  ]);
  res.json({ posts: list.filter((p) => p.user).map((p) => postJSON(p, req.user)), total, hasMore: offset + list.length < total });
};

exports.replies = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Post not found." });
  const list = await GroupPost.find({ parent: req.params.id }).sort({ createdAt: 1 }).limit(100).populate("user", "username displayName");
  res.json({ replies: list.filter((p) => p.user).map((p) => postJSON(p, req.user)) });
};

exports.createPost = async (req, res) => {
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
};

// Edit one of your own posts or replies
exports.updatePost = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Post not found." });
  const post = await GroupPost.findById(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found." });
  if (!post.user.equals(req.user._id)) return res.status(403).json({ error: "You can only edit your own posts." });
  const body = text(req.body.text, 2000);
  if (body.length < 2) return res.status(400).json({ error: "Please write something first." });
  post.text = body;
  post.editedAt = new Date();
  await post.save();
  await post.populate("user", "username displayName");
  res.json({ post: postJSON(post, req.user) });
};

exports.deletePost = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Post not found." });
  const post = await GroupPost.findById(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found." });
  if (!post.user.equals(req.user._id)) return res.status(403).json({ error: "You can only delete your own posts." });
  if (post.parent) await GroupPost.updateOne({ _id: post.parent }, { $inc: { repliesCount: -1 } }, { timestamps: false });
  else await GroupPost.deleteMany({ parent: post._id });
  await post.deleteOne();
  res.json({ ok: true });
};

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
exports.likePost = (req, res) => setPostLike(req, res, true);
exports.unlikePost = (req, res) => setPostLike(req, res, false);
