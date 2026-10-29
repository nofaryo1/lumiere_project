import { app } from "./app";
import { api } from "../lib/api";
import { emit } from "../lib/events";
import { toast, openAuth, closeAuth } from "./ui";
import { refreshCommunity, loadActivity } from "./community";
import { loadGroups, loadGroup } from "./groups";
import { startMessenger } from "./chat";
import { loadPerformance } from "./perfumePage";
import { route, currentPerfume, isView } from "./router";

export const session = () => app.state.session;
export const isLiked = (id) => app.state.session.likes.has(id);
export const isFollowing = (username) => app.state.session.following.has(username);
export const isMe = (username) => !!app.state.session.user && app.state.session.user.username === username;

export function setSession(data) {
  app.state.session = {
    user: data && data.user ? data.user : null,
    likes: new Set((data && data.likes) || []),
    following: new Set((data && data.following) || []),
  };
  rememberAccount();
}

// Remembered so the next page load paints the header for this member straight away
export function rememberAccount() {
  const { user } = app.state.session;
  try {
    if (user) localStorage.setItem("lumiere:account", JSON.stringify({ username: user.username, displayName: user.displayName }));
    else localStorage.removeItem("lumiere:account");
  } catch (err) {}
}

export function rememberedAccount() {
  try { return JSON.parse(localStorage.getItem("lumiere:account")) || null; } catch (err) { return null; }
}

// Logged in? Until the server answers, going by the member who was logged in last time
export const memberGuess = () => (app.state.ready ? !!app.state.session.user : !!rememberedAccount());

export function onAuthChange() {
  const s = app.state;
  s.perfumes.forEach((x) => { delete x.perf; });
  const viewing = currentPerfume();
  if (viewing) loadPerformance(viewing).then(() => { if (currentPerfume() === viewing) app.update(); });
  emit("auth");
  s.allReviews.scope = "all";
  s.likePending = {};
  s.followPending = {};
  if (s.perfumes.length) refreshCommunity();
  loadGroups();
  startMessenger();
  if (isView("group") && s.groupView) {
    s.groupView.group = null;
    loadGroup(s.groupView.slug);
  }
  if (location.hash === "#add-perfume" && !s.session.user) location.hash = "";
  else if (s.view && !s.view.live) route();
  app.update();
}

export async function submitAuth(signup, values) {
  const data = await api(signup ? "/auth/signup" : "/auth/login", { method: "POST", body: values });
  setSession(data);
  closeAuth();
  onAuthChange();
  toast(signup ? `Welcome to LUMIERE, ${data.user.displayName}!` : `Welcome back, ${data.user.displayName}!`);
}

export async function logout() {
  try { await api("/auth/logout", { method: "POST" }); } catch (err) {}
  setSession(null);
  onAuthChange();
  toast("You've been logged out");
}

export async function deleteAccount(password) {
  await api("/users/me", { method: "DELETE", body: { password } });
  app.state.profile.deleting = false;
  app.state.profile.editing = false;
  setSession(null);
  onAuthChange();
  location.hash = "";
  toast("Your account was deleted");
}

export async function saveProfile(values) {
  const res = await api("/users/me", { method: "PATCH", body: values });
  app.state.session.user = res.user;
  app.state.profile.data.user = res.user;
  app.state.profile.editing = false;
  rememberAccount();
  app.update();
  toast("Profile updated");
}

export async function toggleLike(p) {
  if (!app.state.session.user) {
    openAuth("signup", "Join the community to like perfumes and keep them on your profile.");
    return;
  }
  const liked = !isLiked(p.id);
  app.update((s) => { s.likePending = { ...s.likePending, [p.id]: liked }; });
  const done = () => { const next = { ...app.state.likePending }; delete next[p.id]; app.state.likePending = next; };
  try {
    const res = await api(`/perfumes/${encodeURIComponent(p.id)}/like`, { method: liked ? "PUT" : "DELETE" });
    p.real = { ...p.real, ...res.stats };
    if (liked) app.state.session.likes.add(p.id); else app.state.session.likes.delete(p.id);
    done();
    app.update();
    toast(liked ? "Added to your liked perfumes" : "Removed from your liked perfumes");
  } catch (err) {
    done();
    app.update();
    toast(err.message);
  }
}

// What a like button shows: the click right away, the saved state otherwise
export const likeShown = (id) => (id in app.state.likePending ? app.state.likePending[id] : isLiked(id));
export const followShown = (username) => (username in app.state.followPending ? app.state.followPending[username] : isFollowing(username));

export async function toggleFollow(username) {
  if (!app.state.session.user) {
    openAuth("signup", "Join the community to follow other fragrance lovers and see what they're wearing.");
    return null;
  }
  const s = app.state;
  const on = !isFollowing(username);
  app.update(() => { s.followPending = { ...s.followPending, [username]: on }; });
  const done = () => { const next = { ...s.followPending }; delete next[username]; s.followPending = next; };
  try {
    const res = await api(`/users/${encodeURIComponent(username)}/follow`, { method: on ? "PUT" : "DELETE" });
    if (on) s.session.following.add(username); else s.session.following.delete(username);
    const profile = s.profile.data;
    if (profile && profile.user.username === username) {
      profile.followers = res.followers;
      profile.isFollowing = on;
    }
    done();
    app.update();
    toast(on ? `You're now following @${username}` : `You unfollowed @${username}`);
    emit("follow", { username, following: on, followers: res.followers });
    if (on && s.session.following.size === 1) s.community.activityScope = "following";
    if (s.community.activityScope === "following") loadActivity();
    return { following: on, followers: res.followers };
  } catch (err) {
    done();
    app.update();
    toast(err.message);
    return null;
  }
}

