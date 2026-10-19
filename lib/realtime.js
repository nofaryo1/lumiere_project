const { Server } = require("socket.io");
const { userFromCookieHeader } = require("./auth");
const chat = require("./chat");

let io = null;
const onlineCount = new Map();

const room = (userId) => `user:${userId}`;
const isOnline = (userId) => (onlineCount.get(String(userId)) || 0) > 0;
const emitToUser = (userId, event, payload) => { if (io) io.to(room(userId)).emit(event, payload); };
const emitToAll = (event, payload) => { if (io) io.emit(event, payload); };

function limiter(max, windowMs) {
  let count = 0;
  let reset = Date.now() + windowMs;
  return () => {
    if (Date.now() > reset) { count = 0; reset = Date.now() + windowMs; }
    return ++count <= max;
  };
}

function attachRealtime(server) {
  io = new Server(server, {
    // only accept connections from this site (the login cookie is the credential)
    allowRequest: (req, done) => {
      const origin = req.headers.origin;
      if (!origin) return done(null, true);
      try { done(null, new URL(origin).host === req.headers.host); } catch (err) { done(null, false); }
    },
  });

  io.use(async (socket, next) => {
    try {
      const user = await userFromCookieHeader(socket.handshake.headers.cookie);
      if (!user) return next(new Error("unauthorized"));
      socket.data.user = user;
      next();
    } catch (err) {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const me = socket.data.user;
    const id = String(me._id);
    socket.join(room(id));
    onlineCount.set(id, (onlineCount.get(id) || 0) + 1);
    if (onlineCount.get(id) === 1) io.emit("presence", { username: me.username, online: true });

    const canSend = limiter(20, 10 * 1000);

    socket.on("message:send", async (payload = {}, ack = () => {}) => {
      if (typeof ack !== "function") ack = () => {};
      if (!canSend()) return ack({ error: "You're sending messages too fast. Please wait a moment." });
      try {
        const to = payload.conversationId ? { conversationId: payload.conversationId } : { username: payload.username };
        const { conversation, message, recipient } = await chat.sendMessage(me, to, payload.text);
        const msg = chat.messageJSON(message, me);
        const [unread, totalUnread] = await Promise.all([chat.unreadIn(conversation, recipient), chat.unreadCount(recipient)]);
        emitToUser(recipient._id, "message:new", {
          message: msg,
          conversation: chat.conversationJSON(conversation, recipient, unread, isOnline(me._id)),
          totalUnread,
        });
        emitToUser(me._id, "message:new", {
          message: msg,
          conversation: chat.conversationJSON(conversation, me, 0, isOnline(recipient._id)),
          clientId: payload.clientId || null,
        });
        ack({ ok: true, message: msg, conversationId: conversation._id });
      } catch (err) {
        ack({ error: err.status ? err.message : "Couldn't send the message. Please try again." });
        if (!err.status) console.error(err);
      }
    });

    socket.on("typing", async ({ conversationId } = {}) => {
      try {
        const conversation = await chat.myConversation(me, conversationId);
        if (!conversation) return;
        const other = conversation.participants.find((p) => !p._id.equals(me._id));
        emitToUser(other._id, "typing", { conversationId: String(conversation._id), username: me.username });
      } catch (err) {}
    });

    socket.on("conversation:read", async ({ conversationId } = {}) => {
      try {
        const conversation = await chat.myConversation(me, conversationId);
        if (!conversation) return;
        const changed = await chat.markRead(me, conversation._id);
        emitToUser(me._id, "unread:changed", { count: await chat.unreadCount(me) });
        if (changed) {
          const other = conversation.participants.find((p) => !p._id.equals(me._id));
          emitToUser(other._id, "conversation:read", { conversationId: String(conversation._id), by: me.username, at: new Date() });
        }
      } catch (err) {}
    });

    socket.on("presence:query", async (usernames = [], ack = () => {}) => {
      if (typeof ack !== "function" || !Array.isArray(usernames)) return;
      const User = require("../models/User");
      const users = await User.find({ username: { $in: usernames.slice(0, 200).map(String) } }, "username");
      ack(users.filter((u) => isOnline(u._id)).map((u) => u.username));
    });

    socket.on("disconnect", () => {
      const left = (onlineCount.get(id) || 1) - 1;
      if (left <= 0) {
        onlineCount.delete(id);
        io.emit("presence", { username: me.username, online: false });
      } else {
        onlineCount.set(id, left);
      }
    });
  });

  return io;
}

const disconnectUser = (userId) => { if (io) io.in(room(userId)).disconnectSockets(true); };

module.exports = { attachRealtime, emitToUser, emitToAll, isOnline, disconnectUser };
