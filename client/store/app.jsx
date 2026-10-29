import { createStore } from "../lib/createStore";

// Everything the page shows, except the messenger (store/chat.jsx)
export const app = createStore({
  ready: false,
  perfumes: [],
  perfumesFailed: false,
  session: { user: null, likes: new Set(), following: new Set() },
  likePending: {},
  followPending: {},
  trending: { period: "week", family: "all", query: "", brand: "", notes: "", rating: 0, searchSeq: 0 },
  community: { popular: null, popularError: "", activityScope: "all", activity: null, activityLoading: false, online: [] },
  groups: { list: null, filter: "all", q: "", family: "" },
  view: null,
  perfumePage: { editingReview: null, editingNotes: null, notesDraft: "", confirmingDelete: null },
  profile: { data: null, tab: "liked", editing: false, deleting: false, list: null },
  allReviews: { sort: "popular", scope: "all", rating: "", since: "", q: "", perfume: "", items: [], total: 0, hasMore: false, loading: false },
  members: { q: "", users: [], total: 0, hasMore: false, loading: false },
  groupView: null,
  auth: { open: false, mode: "signup", reason: "" },
  nav: { open: false, menuOpen: false },
  toast: { text: "", visible: false },
});

export const byId = (id) => app.state.perfumes.find((p) => p.id === id);
export const refresh = () => app.update();
