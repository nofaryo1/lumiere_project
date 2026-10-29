import { app } from "./app";
import { api } from "../lib/api";
import { toast, openAuth } from "./ui";

export async function loadPopularReviews() {
  const c = app.state.community;
  try {
    const res = await api("/reviews?sort=popular&limit=3");
    c.popular = res.reviews;
    c.popularError = "";
  } catch (err) {
    c.popularError = err.message;
  }
  app.update();
}

export async function loadOnlineAvatars() {
  try {
    const res = await api("/members/top?limit=5");
    app.state.community.online = res.users;
    app.update();
  } catch (err) {}
}

let activityRequest = 0;
export async function loadActivity() {
  const c = app.state.community;
  const id = ++activityRequest;
  const scope = c.activityScope;
  app.update(() => { c.activityLoading = true; });
  let result;
  try {
    const res = await api(`/activity?scope=${scope}&limit=8`);
    result = { scope, items: res.items, followingCount: res.followingCount };
  } catch (err) {
    result = { scope, error: err.message };
  }
  if (id !== activityRequest) return;
  app.update(() => { c.activity = result; c.activityLoading = false; });
}

export function setActivityScope(scope) {
  if (scope === app.state.community.activityScope) return;
  app.state.community.activityScope = scope;
  loadActivity();
}

export function refreshCommunity() {
  const { session } = app.state;
  app.state.community.activityScope = session.user && session.following.size ? "following" : "all";
  loadActivity();
  loadPopularReviews();
  loadOnlineAvatars();
}

export function patchReview(id, changes) {
  const s = app.state;
  const lists = [s.community.popular || [], s.allReviews.items, s.profile.data ? s.profile.data.reviews : [], ...s.perfumes.map((p) => p.realReviews || [])];
  lists.forEach((list) => list.forEach((r) => { if (String(r.id) === String(id)) Object.assign(r, changes); }));
}

export async function toggleHelpful(review) {
  if (!app.state.session.user) {
    openAuth("login", "Log in to mark reviews as helpful.");
    return;
  }
  const on = !review.likedByMe;
  try {
    const res = await api(`/reviews/${encodeURIComponent(review.id)}/like`, { method: on ? "PUT" : "DELETE" });
    patchReview(review.id, { likes: res.likes, likedByMe: on });
    app.update();
  } catch (err) {
    toast(err.message);
  }
}
