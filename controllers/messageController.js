// Messenger history over REST (live delivery is over Socket.io, see lib/realtime.js)
const User = require("../models/User");
const Message = require("../models/Message");
const chat = require("../lib/chat");
const realtime = require("../lib/realtime");
const { limitParam } = require("../lib/helpers");

/* ---------- Messenger (history over REST; live delivery over Socket.io, see lib/realtime.js) ---------- */
exports.conversations = async (req, res) => {
  res.json({ conversations: await chat.listConversations(req.user, realtime.isOnline), unread: await chat.unreadCount(req.user) });
};

// Open (or start) a chat with someone. `withMessages` also returns the latest messages (saves a round trip).
exports.open = async (req, res) => {
  const other = await User.findOne({ username: String(req.body.username || "").toLowerCase() });
  if (!other) return res.status(404).json({ error: "User not found." });
  if (other._id.equals(req.user._id)) return res.status(400).json({ error: "You can't message yourself." });
  const conversation = await chat.findOrCreateConversation(req.user, other);
  const [, unread, page] = await Promise.all([
    conversation.populate("participants", "username displayName"),
    chat.unreadIn(conversation, req.user),
    req.body.withMessages ? messagePage(conversation._id, 30) : null,
  ]);
  res.json({
    conversation: chat.conversationJSON(conversation, req.user, unread, realtime.isOnline(other._id)),
    ...(page || {}),
  });
};

// Messages, newest last. `before` (ISO date) loads older ones.
exports.messages = async (req, res) => {
  const conversation = await chat.myConversation(req.user, req.params.id);
  if (!conversation) return res.status(404).json({ error: "Conversation not found." });
  res.json(await messagePage(conversation._id, limitParam(req.query.limit, 30, 100), req.query.before));
};

async function messagePage(conversationId, limit, beforeParam) {
  const filter = { conversation: conversationId };
  const before = beforeParam ? new Date(beforeParam) : null;
  if (before && !isNaN(before)) filter.createdAt = { $lt: before };
  const list = await Message.find(filter).sort({ createdAt: -1 }).limit(limit + 1).populate("sender", "username");
  return { messages: list.slice(0, limit).reverse().map((m) => chat.messageJSON(m)), hasMore: list.length > limit };
}

exports.unread = async (req, res) => {
  res.json({ count: await chat.unreadCount(req.user) });
};
