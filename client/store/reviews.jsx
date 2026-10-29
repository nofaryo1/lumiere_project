import { app, byId } from "./app";
import { api, query } from "../lib/api";
import { toast } from "./ui";
import { syncNewPerfumes } from "./catalog";
import { isView } from "./router";

let allReviewsRequest = 0;

export async function loadAllReviews(reset) {
  const a = app.state.allReviews;
  const id = ++allReviewsRequest;
  app.update(() => { a.loading = true; });
  try {
    const q = query({
      sort: a.sort, scope: a.scope, limit: "10", offset: String(reset ? 0 : a.items.length),
      rating: a.rating, perfume: a.perfume, since: a.since, q: a.q.trim(),
    });
    const res = await api(`/reviews?${q}`);
    if (res.reviews.some((r) => !byId(r.perfume))) await syncNewPerfumes();
    if (!isView("all-reviews") || id !== allReviewsRequest) return;
    a.items = reset ? res.reviews : [...a.items, ...res.reviews];
    a.total = res.total;
    a.hasMore = res.hasMore;
  } catch (err) {
    toast(err.message);
  }
  a.loading = false;
  app.update();
}

export function setReviewFilters(changes) {
  Object.assign(app.state.allReviews, changes);
  loadAllReviews(true);
}

let queryTimer = 0;
export function setReviewQuery(q) {
  app.update(() => { app.state.allReviews.q = q; });   // saved right away, so another filter can't undo it
  clearTimeout(queryTimer);
  queryTimer = setTimeout(() => loadAllReviews(true), 300);
}
