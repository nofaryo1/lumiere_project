import { createStore } from "../lib/createStore";
import { api } from "../lib/api";
import { emit } from "../lib/events";
import { app, byId } from "./app";
import { toast, setTitle, refreshTitle } from "./ui";
import { addPerfume, updatePerfume, removePerfume, applyNotes } from "./catalog";
import { isView } from "./router";

const emptyThread = () => ({ messages: [], hasMore: false, loaded: false });

export const chat = createStore({
  conversations: null,
  active: null,
  opening: false,
  threads: new Map(),
  thread: emptyThread(),
  loading: false,
  online: new Set(),
  typingUntil: 0,
  unread: 0,
  connected: false,
  popups: [],
  scroll: { seq: 0, mode: "end", prevHeight: 0 },
  focusSeq: 0,
  pageSeq: 0,
});

const c = chat.state;
let socket = null;
let typingTimer = 0;
let lastTypingSent = 0;
let chatToken = 0;
let popupId = 0;

const isMessengerOpen = () => isView("messages");
const me = () => app.state.session.user;

function threadFor(conversationId) {
  const key = String(conversationId);
  if (!c.threads.has(key)) c.threads.set(key, emptyThread());
  return c.threads.get(key);
}

function addToThread(thread, message, clientId) {
  const i = thread.messages.findIndex((m) => String(m.id) === String(message.id) || (clientId && m.clientId === clientId));
  if (i >= 0) thread.messages[i] = message;
  else thread.messages.push(message);
}

// Redraws the open thread: "end" scrolls to the newest message, "keep" only if it was already there,
// "older" keeps the same messages in view after earlier ones are added on top
function renderThread(mode, prevHeight = 0) {
  c.scroll = { seq: c.scroll.seq + 1, mode, prevHeight };
  chat.update();
}

export function setUnread(count) {
  c.unread = Math.max(0, count);
  chat.update();
  refreshTitle();
}

export const isOnline = (username) => c.online.has(username);

function connectSocket() {
  disconnectSocket();
  if (!me() || !window.io) return;
  socket = window.io({ withCredentials: true });
  const updateConnection = () => chat.update({ connected: !!(socket && socket.connected) });

  let connectedBefore = false;
  socket.on("connect", () => {
    queryPresence();
    updateConnection();
    if (connectedBefore) {
      loadConversations();
      if (isMessengerOpen() && c.active) {
        loadMessages(false).then(() => { if (document.visibilityState === "visible") markActiveRead(); });
      }
    }
    connectedBefore = true;
  });
  socket.on("disconnect", updateConnection);
  socket.on("connect_error", updateConnection);

  socket.on("message:new", ({ message, conversation, totalUnread, clientId }) => {
    upsertConversation(conversation);
    const mine = message.sender === me().username;
    const viewing = isMessengerOpen() && c.active && String(c.active.id) === String(conversation.id);

    if (viewing) {
      addToThread(c.thread, message, clientId);
      if (!mine) c.typingUntil = 0;
      renderThread("end");
      if (!mine && document.visibilityState === "visible") markActiveRead();
    } else {
      const thread = c.threads.get(String(conversation.id));
      if (thread) addToThread(thread, message, clientId);
      if (!mine) {
        showChatPopup(conversation, message);
        prefetchThread(conversation.id);
      }
    }
    if (typeof totalUnread === "number") setUnread(totalUnread);
    chat.update();
  });

  socket.on("typing", ({ conversationId }) => {
    if (!c.active || String(c.active.id) !== String(conversationId)) return;
    chat.update({ typingUntil: Date.now() + 3500 });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => chat.update(), 3600);
  });

  socket.on("conversation:read", ({ conversationId, at }) => {
    if (!c.active || String(c.active.id) !== String(conversationId)) return;
    c.thread.messages.forEach((m) => { if (m.sender === me().username && !m.readAt) m.readAt = at; });
    renderThread("keep");
  });

  socket.on("unread:changed", ({ count }) => setUnread(count));
  socket.on("reviews:changed", () => emit("reviews-changed"));

  socket.on("perfume:changed", ({ perfume }) => updatePerfume(perfume));
  socket.on("perfume:added", ({ perfume }) => { if (!byId(perfume.slug)) addPerfume(perfume); });
  socket.on("perfume:deleted", ({ slug }) => removePerfume(slug));

  socket.on("perfume:notes", ({ slug, notes, notesAddedBy }) => {
    const p = byId(slug);
    if (!p || JSON.stringify(p.notes) === JSON.stringify(notes)) return;
    const input = document.querySelector("#notesForm [name=notes]");
    const typing = input && input.value.trim();
    applyNotes(p, notes, notesAddedBy);
    if (typing) toast(`The notes of ${p.name} were just updated`);
  });

  socket.on("presence", ({ username, online }) => {
    if (online) c.online.add(username); else c.online.delete(username);
    chat.update();
  });
}

function disconnectSocket() {
  if (socket) socket.disconnect();
  socket = null;
  c.connected = false;
}

function queryPresence() {
  if (!socket || !socket.connected) return;
  const names = (c.conversations || []).map((x) => x.other.username);
  if (c.active) names.push(c.active.other.username);
  if (!names.length) return;
  socket.emit("presence:query", [...new Set(names)], (online) => {
    online.forEach((u) => c.online.add(u));
    chat.update();
  });
}

function upsertConversation(conv) {
  if (!c.conversations) return;
  c.conversations = [conv, ...c.conversations.filter((x) => String(x.id) !== String(conv.id))];
  if (c.active && String(c.active.id) === String(conv.id)) {
    c.active = { ...c.active, ...conv, unread: 0 };
    c.conversations[0].unread = 0;
  }
}

async function loadConversations() {
  try {
    const res = await api("/conversations");
    c.conversations = res.conversations;
    res.conversations.forEach((x) => { if (x.online) c.online.add(x.other.username); });
    setUnread(res.unread);
  } catch (err) {
    c.conversations = c.conversations || [];
  }
  chat.update();
  queryPresence();
}

export function markActiveRead() {
  if (!c.active || !socket) return;
  socket.emit("conversation:read", { conversationId: c.active.id });
  const conv = (c.conversations || []).find((x) => String(x.id) === String(c.active.id));
  const wasUnread = (conv ? conv.unread : c.active.unread) || 0;
  if (wasUnread) setUnread(c.unread - wasUnread);
  if (conv) conv.unread = 0;
  c.active.unread = 0;
  chat.update();
}

function prepareChat(username) {
  const name = username.toLowerCase();
  const known = (c.conversations || []).find((x) => x.other.username === name)
    || (c.active && c.active.other.username === name ? c.active : null);
  c.typingUntil = 0;
  if (known) setActiveChat(known);
  else { c.active = null; c.opening = true; }
}

function setActiveChat(conversation) {
  c.active = { ...conversation };
  c.thread = threadFor(conversation.id);
  c.opening = false;
}

async function openChat(username) {
  const token = ++chatToken;
  try {
    let fresh = false;
    if (!c.active) {
      const res = await api("/conversations", { method: "POST", body: { username, withMessages: true } });
      if (token !== chatToken || !isMessengerOpen()) return;
      const { conversation } = res;
      if (conversation.online) c.online.add(conversation.other.username);
      setActiveChat(conversation);
      if (Array.isArray(res.messages)) { storeMessages(c.thread, res, false); fresh = true; }
      renderThread("end");
    }
    setTitle(`${c.active.other.displayName} — Messages — LUMIERE`);
    markActiveRead();
    chat.update({ focusSeq: c.focusSeq + 1 });
    if (!fresh) await loadMessages(false);
  } catch (err) {
    if (token !== chatToken) return;
    c.opening = false;
    toast(err.message);
    location.hash = "messages";
  }
}

export async function loadMessages(older) {
  const a = c.active;
  const thread = c.thread;
  if (!a) return;
  c.loading = true;
  if (older) renderThread("keep");
  try {
    const q = older && thread.messages.length ? `?before=${encodeURIComponent(thread.messages[0].createdAt)}` : "";
    const res = await api(`/conversations/${a.id}/messages${q}`);
    storeMessages(thread, res, older);
    if (c.thread !== thread) return;
    c.loading = false;
    const box = document.getElementById("threadMessages");
    if (older) renderThread("older", box ? box.scrollHeight : 0);
    else renderThread("end");
  } catch (err) {
    if (c.thread === thread) c.loading = false;
    chat.update();
    toast(err.message);
  }
}

function storeMessages(thread, res, older) {
  if (older) thread.messages = [...res.messages, ...thread.messages];
  else {
    const last = res.messages.length ? res.messages[res.messages.length - 1].createdAt : "";
    const keep = thread.messages.filter((m) => !res.messages.some((x) => String(x.id) === String(m.id))
      && (m.pending || m.failed || m.createdAt > last));
    thread.messages = [...res.messages, ...keep];
  }
  if (!older || !thread.loaded) thread.hasMore = res.hasMore;
  thread.loaded = true;
}

const prefetching = new Set();
export function prefetchThread(conversationId) {
  const thread = threadFor(conversationId);
  const key = String(conversationId);
  if (thread.loaded || prefetching.has(key)) return;
  prefetching.add(key);
  api(`/conversations/${key}/messages`)
    .then((res) => { if (!thread.loaded) storeMessages(thread, res, false); })
    .catch(() => {})
    .finally(() => prefetching.delete(key));
}

export function prefetchConversationWith(username) {
  const conv = (c.conversations || []).find((x) => x.other.username === username);
  if (conv) prefetchThread(conv.id);
}

// Returns true when the message was handed to the server (so the box can be cleared)
export function sendChat(value) {
  const a = c.active;
  const text = value.trim();
  if (!a || !text) return false;
  if (!socket || !socket.connected) { toast("Not connected to live chat yet — try again in a moment."); return false; }
  const clientId = `c${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const temp = { id: clientId, clientId, sender: me().username, text, createdAt: new Date().toISOString(), pending: true };
  c.thread.messages.push(temp);
  renderThread("end");
  const thread = c.thread;
  socket.emit("message:send", { conversationId: a.id, text, clientId }, (ack) => {
    const i = thread.messages.findIndex((m) => m.clientId === clientId);
    if (ack && ack.ok) {
      if (i >= 0) thread.messages[i] = ack.message;
    } else {
      if (i >= 0) thread.messages[i] = { ...temp, pending: false, failed: true };
      toast((ack && ack.error) || "Couldn't send the message.");
    }
    if (c.active === a) renderThread("keep");
  });
  return true;
}

export function sendTyping() {
  if (socket && c.active && Date.now() - lastTypingSent > 2000) {
    lastTypingSent = Date.now();
    socket.emit("typing", { conversationId: c.active.id });
  }
}

function showChatPopup(conversation, message) {
  const popup = { id: ++popupId, other: conversation.other, text: message.text, leaving: false };
  c.popups = [popup, ...c.popups].slice(0, 3);
  chat.update();
  setTimeout(() => dismissPopup(popup.id), 7000);
}

export function dismissPopup(id) {
  const popup = c.popups.find((p) => p.id === id);
  if (!popup || popup.leaving) return;
  popup.leaving = true;
  chat.update();
  setTimeout(() => chat.update({ popups: c.popups.filter((p) => p.id !== id) }), 250);
}

export async function searchMembersToMessage(q) {
  const res = await api(`/members?search=${encodeURIComponent(q)}&limit=6`);
  return res.users.filter((u) => u.username !== me().username);
}

export function showMessenger(username, wasOpen) {
  c.pageSeq += 1;
  if (!username) {
    chatToken++;
    c.active = null;
    c.opening = false;
    chat.update();
  } else {
    prepareChat(username);
    renderThread("end");
    openChat(username);
  }
  if (!c.conversations || !wasOpen) loadConversations();
}

export function startMessenger() {
  if (me()) {
    connectSocket();
    loadConversations();
  } else {
    disconnectSocket();
    c.conversations = null;
    c.active = null;
    c.opening = false;
    c.threads.clear();
    c.thread = emptyThread();
    c.online.clear();
    setUnread(0);
    if (isMessengerOpen()) location.hash = "";
  }
}

export function onVisible() {
  if (document.visibilityState === "visible" && isMessengerOpen() && c.active) markActiveRead();
}
