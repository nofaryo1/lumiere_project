import { app, byId } from "./app";
import { api } from "../lib/api";
import { setTitle, toast, openAuth } from "./ui";
import { refreshCommunity } from "./community";
import { loadRealReviews, loadPerformance } from "./perfumePage";
import { loadAllReviews } from "./reviews";
import { loadMembers } from "./members";
import { loadGroups, loadGroup, groupBySlug } from "./groups";
import { showMessenger } from "./chat";
import { ownsPerfume } from "./catalog";

const HOME_TITLE = "LUMIERE — Fragrance discovery & community";

let returnScroll = 0;
let homeSeen = false;
let routeToken = 0;
let viewSeq = 0;
let pendingSection = null;

// Work for after React has drawn the next update (scrolling, focus)
const afterRender = [];
export const runAfterRender = (fn) => afterRender.push(fn);
export function flushAfterRender() {
  afterRender.splice(0).forEach((fn) => fn());
}

export const isView = (name) => !!app.state.view && app.state.view.name === name;

export const currentPerfume = () => {
  const m = location.hash.match(/^#perfume\/(.+)$/);
  return m && byId(decodeURIComponent(m[1]));
};

export function openPerfume(id, section = null) {
  pendingSection = section;
  if (location.hash === `#perfume/${id}`) route();
  else location.hash = `perfume/${id}`;
}

export function goBack() {
  if (homeSeen) history.back();
  else location.hash = "";
}

// live: the page is redrawn when data changes; otherwise it is only drawn when opened (keeps what was typed)
function showView(view, title, { live = true, scrollTop = true } = {}) {
  if (!app.state.view) returnScroll = window.scrollY;
  app.state.view = { ...view, live, seq: ++viewSeq };
  document.documentElement.classList.remove("is-opening-view");
  setTitle(`${title} — LUMIERE`);
  if (scrollTop) runAfterRender(() => window.scrollTo({ top: 0, behavior: "instant" }));
  app.update();
}

export function showHome() {
  homeSeen = true;
  document.documentElement.classList.remove("is-opening-view");
  if (!app.state.view) return;
  app.state.view = null;
  setTitle(HOME_TITLE);
  runAfterRender(() => {
    const target = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView();
    else window.scrollTo({ top: returnScroll, behavior: "instant" });
  });
  app.update();
}

function leaveForAuth(mode, reason) {
  history.replaceState(null, "", location.pathname + location.search);
  showHome();
  openAuth(mode, reason);
}

function showPerfume(p, token) {
  Object.assign(app.state.perfumePage, { editingReview: null, editingNotes: null, confirmingDelete: null });
  const section = pendingSection;
  pendingSection = null;
  showView({ name: "perfume", id: p.id }, `${p.brand ? p.brand + " " : ""}${p.name}`, { scrollTop: section !== "reviews" });
  if (section === "reviews") runAfterRender(() => { const el = document.getElementById("pvReviews"); if (el) el.scrollIntoView({ behavior: "instant" }); });
  if (!p.realReviews) loadRealReviews(p).then(() => { if (token === routeToken) app.update(); });
  if (!p.perf) loadPerformance(p).then(() => { if (token === routeToken) app.update(); });
}

async function showProfile(username, token) {
  const profile = app.state.profile;
  if (!profile.data || profile.data.user.username !== username.toLowerCase()) {
    Object.assign(profile, { tab: "liked", editing: false, list: null });
  }
  showView({ name: "profile", username, loading: true }, `@${username}`, { live: false });
  try {
    const data = await api(`/users/${encodeURIComponent(username)}`);
    if (token !== routeToken) return;
    profile.data = data;
    app.state.view = { ...app.state.view, loading: false, live: true };
    app.update();
    setTitle(`${data.user.displayName} (@${data.user.username}) — LUMIERE`);
  } catch (err) {
    if (token !== routeToken) return;
    app.state.view = { ...app.state.view, loading: false, error: err.status === 404 ? `We couldn't find @${username}.` : err.message };
    app.update();
  }
}

function showGroups() {
  showView({ name: "groups" }, "Groups");
  loadGroups();
}

function showGroup(slug) {
  app.state.groupView = { slug, group: null, posts: [], total: 0, hasMore: false, sort: "new", loading: false, replies: {}, q: "", since: "", editing: null, confirmDelete: false };
  showView({ name: "group", slug }, "Group");
  loadGroup(slug);
}

function showCreateGroup() {
  if (!app.state.session.user) return leaveForAuth("signup", "Create a free account to start your own group.");
  showView({ name: "group-form" }, "Create a group", { live: false });
}

async function showEditGroup(slug) {
  const { user } = app.state.session;
  if (!user) return leaveForAuth("login", "Log in to edit your group.");
  if (!app.state.groups.list) await loadGroups();
  const g = groupBySlug(slug);
  if (!g || !g.createdBy || g.createdBy.username !== user.username) {
    toast("Only the member who created this group can edit it.");
    location.replace(g ? `#group/${encodeURIComponent(slug)}` : "#groups");
    return;
  }
  showView({ name: "group-form", slug }, `Edit ${g.name}`, { live: false });
}

function showAllReviews(perfume = "") {
  const a = app.state.allReviews;
  if (a.perfume !== perfume) {
    Object.assign(a, { perfume, rating: "", since: "", q: "", items: [], total: 0, hasMore: false });
  }
  const p = perfume && byId(perfume);
  showView({ name: "all-reviews" }, p ? `Reviews of ${p.name}` : "All reviews");
  loadAllReviews(true);
}

function showMembers() {
  showView({ name: "members" }, "Members");
  loadMembers(true);
}

function showEditPerfume(slug) {
  const p = byId(slug);
  if (!app.state.session.user) return leaveForAuth("login", "Log in to edit your perfume.");
  if (!p || !ownsPerfume(p)) {
    toast("Only the member who added this perfume can edit it.");
    location.replace(p ? `#perfume/${encodeURIComponent(slug)}` : "#");
    return;
  }
  showView({ name: "perfume-form", id: slug }, `Edit ${p.name}`, { live: false });
}

function showAddPerfume() {
  if (!app.state.session.user) return leaveForAuth("signup", "Create a free account to add perfumes to LUMIERE.");
  showView({ name: "perfume-form" }, "Add a perfume", { live: false });
}

function showChat(username) {
  if (!app.state.session.user) return leaveForAuth("login", "Log in to see your messages.");
  const wasOpen = isView("messages");
  if (!wasOpen) showView({ name: "messages" }, "Messages");
  showMessenger(username, wasOpen);
}

export function route() {
  const token = ++routeToken;
  const hash = location.hash;
  let m;
  if ((m = hash.match(/^#perfume\/(.+)$/))) {
    const p = byId(decodeURIComponent(m[1]));
    if (p) return showPerfume(p, token);
    return showView({ name: "not-found" }, "Not found", { live: false });
  }
  if ((m = hash.match(/^#profile\/(.+)$/))) return showProfile(decodeURIComponent(m[1]), token);
  if (hash === "#add-perfume") return showAddPerfume();
  if (hash === "#all-reviews") return showAllReviews();
  if ((m = hash.match(/^#all-reviews\/(.+)$/))) return showAllReviews(decodeURIComponent(m[1]));
  if ((m = hash.match(/^#edit-perfume\/(.+)$/))) return showEditPerfume(decodeURIComponent(m[1]));
  if (hash === "#about") return showView({ name: "about" }, "About");
  if (hash === "#privacy") return showView({ name: "privacy" }, "Privacy");
  if (hash === "#help") return showView({ name: "help" }, "Help center", { live: false });
  if (hash === "#groups") return showGroups();
  if (hash === "#members") return showMembers();
  if (hash === "#messages") return showChat();
  if ((m = hash.match(/^#messages\/(.+)$/))) return showChat(decodeURIComponent(m[1]));
  if (hash === "#create-group") return showCreateGroup();
  if ((m = hash.match(/^#edit-group\/(.+)$/))) return showEditGroup(decodeURIComponent(m[1]));
  if ((m = hash.match(/^#group\/(.+)$/))) return showGroup(decodeURIComponent(m[1]));
  showHome();
}

export function renderAfterPerfumeChange() {
  app.update();
}

export function renderAfterPerfumeRemoved(id) {
  const profile = app.state.profile.data;
  if (profile) profile.added = profile.added.filter((x) => x !== id);
  refreshCommunity();
  if (isView("profile")) app.update();
  else if (location.hash === `#perfume/${encodeURIComponent(id)}` || location.hash === `#perfume/${id}`) route();
  else app.update();
}
