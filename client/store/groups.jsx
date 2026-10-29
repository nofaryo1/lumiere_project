import { app } from "./app";
import { api, query } from "../lib/api";
import { toast, openAuth, setTitle } from "./ui";
import { session } from "./session";
import { isView } from "./router";

export const groupBySlug = (slug) => (app.state.groups.list || []).find((g) => g.slug === slug);

export async function loadGroups() {
  const groups = app.state.groups;
  try {
    const res = await api("/groups");
    groups.list = res.groups;
  } catch (err) {
    groups.list = groups.list || [];
  }
  app.update();
}

export function setGroupsFilter(changes) {
  app.update(() => Object.assign(app.state.groups, changes));
}

export async function loadGroupPosts(reset) {
  const v = app.state.groupView;
  const slug = v.slug;
  app.update(() => { v.loading = true; });
  try {
    const q = query({ sort: v.sort, limit: "10", offset: String(reset ? 0 : v.posts.length), q: v.q.trim(), since: v.since });
    const res = await api(`/groups/${encodeURIComponent(slug)}/posts?${q}`);
    if (app.state.groupView !== v || !isView("group")) return;
    v.posts = reset ? res.posts : [...v.posts, ...res.posts];
    v.total = res.total;
    v.hasMore = res.hasMore;
  } catch (err) {
    toast(err.message);
  }
  v.loading = false;
  app.update();
}

export async function loadGroup(slug) {
  const v = app.state.groupView;
  try {
    const res = await api(`/groups/${encodeURIComponent(slug)}`);
    if (app.state.groupView !== v) return;
    v.group = res.group;
    setTitle(`${res.group.name} — LUMIERE`);
    app.update();
    loadGroupPosts(true);
  } catch (err) {
    v.error = err.status === 404 ? "This group doesn't exist (anymore)." : err.message;
    app.update();
  }
}

export function setGroupView(changes) {
  app.update(() => Object.assign(app.state.groupView, changes));
}

let postsQueryTimer = 0;
export function setPostsQuery(q) {
  setGroupView({ q });
  clearTimeout(postsQueryTimer);
  postsQueryTimer = setTimeout(() => loadGroupPosts(true), 300);
}

export async function toggleReplies(postId) {
  const v = app.state.groupView;
  if (v.replies[postId]) {
    delete v.replies[postId];
    app.update();
    return;
  }
  v.replies[postId] = "loading";
  app.update();
  try {
    const res = await api(`/groups/${encodeURIComponent(v.slug)}/posts/${postId}/replies`);
    if (app.state.groupView === v && v.replies[postId]) { v.replies[postId] = res.replies; app.update(); }
  } catch (err) {
    delete v.replies[postId];
    app.update();
    toast(err.message);
  }
}

function applyMembership(slug, isMember, members) {
  const s = app.state;
  (s.groups.list || []).forEach((g) => { if (g.slug === slug) Object.assign(g, { isMember, members }); });
  if (s.groupView && s.groupView.group && s.groupView.group.slug === slug) Object.assign(s.groupView.group, { isMember, members });
  const profile = s.profile.data;
  if (profile && session().user && profile.user.username === session().user.username) {
    const g = groupBySlug(slug);
    profile.groups = isMember
      ? [{ slug, name: g ? g.name : slug, family: g ? g.family : null }, ...profile.groups.filter((x) => x.slug !== slug)]
      : profile.groups.filter((x) => x.slug !== slug);
  }
  app.update();
}

export async function toggleMembership(slug) {
  if (!session().user) {
    openAuth("signup", "Join the community to join groups and take part in discussions.");
    return;
  }
  const v = app.state.groupView;
  const g = groupBySlug(slug) || (v && v.group);
  const join = !(g && g.isMember);
  try {
    const res = await api(`/groups/${encodeURIComponent(slug)}/membership`, { method: join ? "PUT" : "DELETE" });
    applyMembership(slug, res.isMember, res.members);
    toast(join ? `Welcome to ${g ? g.name : "the group"}!` : `You left ${g ? g.name : "the group"}`);
  } catch (err) {
    toast(err.message);
  }
}

export function perfumeFromLabel(label) {
  const q = label.trim().toLowerCase();
  if (!q) return null;
  const { perfumes } = app.state;
  return perfumes.find((p) => `${p.brand ? p.brand + " " : ""}${p.name}`.toLowerCase() === q)
    || perfumes.find((p) => p.name.toLowerCase() === q) || undefined;
}

export async function submitPost(text, perfume) {
  const v = app.state.groupView;
  const res = await api(`/groups/${encodeURIComponent(v.slug)}/posts`, { method: "POST", body: { text, perfume } });
  v.sort = "new";
  v.posts = [res.post, ...v.posts.filter((p) => p.id !== res.post.id)];
  v.total += 1;
  v.group.posts += 1;
  v.group.postsThisWeek += 1;
  app.update();
  toast("Posted!");
}

export async function submitReply(postId, text) {
  const v = app.state.groupView;
  const res = await api(`/groups/${encodeURIComponent(v.slug)}/posts`, { method: "POST", body: { text, parent: postId } });
  const list = Array.isArray(v.replies[postId]) ? v.replies[postId] : [];
  v.replies[postId] = [...list, res.post];
  const post = v.posts.find((p) => String(p.id) === String(postId));
  if (post) post.replies += 1;
  app.update();
}

export async function deletePost(id, parent) {
  const v = app.state.groupView;
  try {
    await api(`/group-posts/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (parent) {
      v.replies[parent] = (v.replies[parent] || []).filter((r) => String(r.id) !== String(id));
      const post = v.posts.find((p) => String(p.id) === String(parent));
      if (post) post.replies -= 1;
    } else {
      v.posts = v.posts.filter((p) => String(p.id) !== String(id));
      v.total -= 1;
      v.group.posts -= 1;
    }
    app.update();
    toast(parent ? "Reply deleted" : "Post deleted");
  } catch (err) {
    toast(err.message);
  }
}

export async function togglePostLike(post) {
  if (!session().user) { openAuth("login", "Log in to like posts."); return; }
  const v = app.state.groupView;
  const id = String(post.id);
  const on = !post.likedByMe;
  try {
    const res = await api(`/group-posts/${encodeURIComponent(id)}/like`, { method: on ? "PUT" : "DELETE" });
    const all = [...v.posts, ...Object.values(v.replies).filter(Array.isArray).flat()];
    all.forEach((p) => { if (String(p.id) === id) Object.assign(p, { likes: res.likes, likedByMe: on }); });
    app.update();
  } catch (err) {
    toast(err.message);
  }
}

export async function saveEditedPost(id, text) {
  const v = app.state.groupView;
  const res = await api(`/group-posts/${encodeURIComponent(id)}`, { method: "PATCH", body: { text } });
  const replace = (list) => list.map((p) => (String(p.id) === String(id) ? { ...p, ...res.post } : p));
  v.posts = replace(v.posts);
  Object.keys(v.replies).forEach((k) => { if (Array.isArray(v.replies[k])) v.replies[k] = replace(v.replies[k]); });
  v.editing = null;
  app.update();
  toast(res.post.parent ? "Reply updated" : "Post updated");
}

export function checkGroupName(name, except) {
  const extra = except ? `&except=${encodeURIComponent(except)}` : "";
  return api(`/groups/check?name=${encodeURIComponent(name)}${extra}`);
}

export async function createGroup(body) {
  const res = await api("/groups", { method: "POST", body });
  app.state.groups.list = [res.group, ...(app.state.groups.list || [])];
  app.update();
  location.hash = `group/${res.group.slug}`;
  toast(`${res.group.name} was created — say hi to your first members!`);
}

export async function saveEditedGroup(slug, body) {
  const res = await api(`/groups/${encodeURIComponent(slug)}`, { method: "PATCH", body });
  const s = app.state;
  s.groups.list = (s.groups.list || []).map((g) => (g.slug === slug ? res.group : g));
  if (s.groupView && s.groupView.slug === slug && s.groupView.group) Object.assign(s.groupView.group, res.group);
  app.update();
  location.hash = `group/${encodeURIComponent(slug)}`;
  toast(`${res.group.name} was updated`);
}

export async function deleteGroup() {
  const s = app.state;
  const v = s.groupView;
  const slug = v.slug;
  await api(`/groups/${encodeURIComponent(slug)}`, { method: "DELETE" });
  const name = v.group.name;
  s.groups.list = (s.groups.list || []).filter((g) => g.slug !== slug);
  if (s.profile.data) s.profile.data.groups = (s.profile.data.groups || []).filter((g) => g.slug !== slug);
  app.update();
  location.hash = "groups";
  toast(`${name} was deleted`);
}

