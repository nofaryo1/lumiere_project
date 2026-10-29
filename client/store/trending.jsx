import { app } from "./app";
import { ratingFor } from "./catalog";

export const PERIOD_LABEL = {
  week: "Most liked and reviewed this week",
  month: "Most liked and reviewed this month",
  all: "Most liked and reviewed of all time",
};

export const brandKey = (brand) => String(brand || "").trim().replace(/\s+/g, " ").toLowerCase();
export const filterNoteTerms = () => app.state.trending.notes.toLowerCase().split(",").map((t) => t.trim()).filter(Boolean);
export const hasPerfumeFilters = () => { const t = app.state.trending; return !!(t.brand || filterNoteTerms().length || t.rating); };

const starsOf = (p) => { const r = ratingFor(p); return r.count ? Math.min(5, Math.max(1, Math.round(r.avg))) : 0; };

export function matchesPerfumeFilters(p) {
  const t = app.state.trending;
  if (t.brand && brandKey(p.brand) !== t.brand) return false;
  const terms = filterNoteTerms();
  if (terms.length && !terms.every((term) => p.notes.some((n) => n.toLowerCase().includes(term)))) return false;
  if (t.rating && starsOf(p) !== t.rating) return false;
  return true;
}

// Brands and notes offered in the filters, taken from the perfumes on the site
export function filterOptions() {
  const brands = new Map();
  app.state.perfumes.forEach((p) => { const k = brandKey(p.brand); if (k && !brands.has(k)) brands.set(k, p.brand.trim().replace(/\s+/g, " ")); });
  const notes = new Map();
  app.state.perfumes.forEach((p) => p.notes.forEach((n) => { if (!notes.has(n.toLowerCase())) notes.set(n.toLowerCase(), n); }));
  return {
    brands: [...brands].sort((a, b) => a[1].localeCompare(b[1])),
    brandKeys: brands,
    noteNames: [...notes.values()].sort((a, b) => a.localeCompare(b)),
  };
}

export function setTrending(changes) {
  app.update(() => Object.assign(app.state.trending, changes, { scrollSeq: (app.state.trending.scrollSeq || 0) + 1 }));
}

export function setFamily(key) {
  setTrending({ family: key });
}

export function runSearch(text) {
  const t = app.state.trending;
  setTrending({ query: text.trim(), family: "all", searchSeq: t.searchSeq + 1 });
  if (t.query) {
    if (location.hash && location.hash !== "#trending") location.hash = "";
    const section = document.getElementById("trending");
    if (section) section.scrollIntoView({ behavior: "smooth" });
  }
}

export function clearFilters() {
  setTrending({ brand: "", notes: "", rating: 0, family: "all", notesSeq: (app.state.trending.notesSeq || 0) + 1 });
}
