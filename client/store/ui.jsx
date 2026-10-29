import { app } from "./app";
import { chat } from "./chat";

let toastTimer = 0;
export function toast(message) {
  app.update({ toast: { text: message, visible: true } });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => app.update({ toast: { text: app.state.toast.text, visible: false } }), 2400);
}

let lastTitle = document.title;
export function setTitle(text) {
  lastTitle = text;
  document.title = chat.state.unread ? `(${chat.state.unread}) ${text}` : text;
}
export const refreshTitle = () => setTitle(lastTitle);

let lastFocus = null;
export function openAuth(mode = "signup", reason = "") {
  if (!app.state.auth.open) lastFocus = document.activeElement;
  app.update({ auth: { open: true, mode, reason, seq: (app.state.auth.seq || 0) + 1 } });
}

export function closeAuth() {
  if (!app.state.auth.open) return;
  app.update({ auth: { open: false, mode: "signup", reason: "" } });
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}

export function setNav(changes) {
  app.update({ nav: { ...app.state.nav, ...changes } });
}

export function share(path) {
  const url = path ? `${location.origin}${location.pathname}${path}` : location.href;
  if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
  toast("Link copied");
}
