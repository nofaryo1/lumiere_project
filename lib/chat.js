const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");

const MAX_LENGTH = 2000;

const userJSON = (u) => ({ username: u.username, displayName: u.displayName });

function messageJSON(m, sender) {
  return {
    id: m._id,
    conversation: m.conversation,
    sender: sender ? sender.username : m.sender && m.sender.username,
    text: m.text,
    createdAt: m.createdAt,
    readAt: m.readAt,
  };
}

function conversationJSON(c, me, unread = 0, online = false) {
  const other = c.participants.find((p) => !p._id.equals(me._id)) || c.participants[0];
  return {
    id: c._id,
    other: userJSON(other),
    lastMessage: c.lastMessage && c.lastMessage.at
      ? { text: c.lastMessage.text, mine: !!(c.lastMessage.sender && c.lastMessage.sender.equals(me._id)), at: c.lastMessage.at }
      : null,
    unread,
    online,
    updatedAt: c.updatedAt,
  };
}

async function findOrCreateConversation(me, other) {
  const key = Conversation.keyFor(me._id, other._id);
  const existing = await Conversation.findOne({ key });
  if (existing) return existing;
  try {
    return await Conversation.create({ key, participants: [me._id, other._id].sort((a, b) => String(a).localeCompare(String(b))) });
  } catch (err) {
    if (err.code === 11000) return Conversation.findOne({ key });
    throw err;
  }
}

async function myConversation(me, id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Conversation.findOne({ _id: id, participants: me._id }).populate("participants", "username displayName");
}

async function unreadByConversation(me) {
  const rows = await Message.aggregate([
    { $match: { recipient: me._id, readAt: null } },
    { $group: { _id: "$conversation", n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

async function listConversations(me, isOnline = () => false) {
  const [list, unread] = await Promise.all([
    Conversation.find({ participants: me._id, "lastMessage.at": { $ne: null } })
      .sort({ updatedAt: -1 }).limit(100).populate("participants", "username displayName"),
    unreadByConversation(me),
  ]);
  return list.map((c) => {
    const other = c.participants.find((p) => !p._id.equals(me._id));
    return conversationJSON(c, me, unread.get(String(c._id)) || 0, other ? isOnline(other._id) : false);
  });
}

async function sendMessage(me, to, rawText) {
  const text = typeof rawText === "string" ? rawText.trim().slice(0, MAX_LENGTH) : "";
  if (!text) throw Object.assign(new Error("Message is empty."), { status: 400 });

  let conversation;
  if (to.conversationId) {
    conversation = await myConversation(me, to.conversationId);
    if (!conversation) throw Object.assign(new Error("Conversation not found."), { status: 404 });
  } else {
    const other = await User.findOne({ username: String(to.username || "").toLowerCase() });
    if (!other) throw Object.assign(new Error("User not found."), { status: 404 });
    if (other._id.equals(me._id)) throw Object.assign(new Error("You can't message yourself."), { status: 400 });
    conversation = await findOrCreateConversation(me, other);
    await conversation.populate("participants", "username displayName");
  }
  const recipient = conversation.participants.find((p) => !p._id.equals(me._id));

  const message = await Message.create({ conversation: conversation._id, sender: me._id, recipient: recipient._id, text });
  conversation.lastMessage = { text: text.slice(0, 200), sender: me._id, at: message.createdAt };
  await conversation.save();
  return { conversation, message, recipient };
}

async function markRead(me, conversationId) {
  const res = await Message.updateMany({ conversation: conversationId, recipient: me._id, readAt: null }, { $set: { readAt: new Date() } });
  return res.modifiedCount;
}

const unreadCount = (me) => Message.countDocuments({ recipient: me._id, readAt: null });
const unreadIn = (conversation, user) => Message.countDocuments({ conversation: conversation._id, recipient: user._id, readAt: null });

module.exports = {
  userJSON, messageJSON, conversationJSON, findOrCreateConversation, myConversation,
  listConversations, sendMessage, markRead, unreadCount, unreadIn,
};
