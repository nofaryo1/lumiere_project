import { app, byId } from "./app";
import { api } from "../lib/api";
import { hash } from "../lib/format";
import { renderAfterPerfumeChange, renderAfterPerfumeRemoved } from "./router";
import { session } from "./session";

export const families = [
  { key: "woody", name: "Woody" },
  { key: "floral", name: "Floral" },
  { key: "fresh", name: "Fresh" },
  { key: "amber", name: "Amber" },
  { key: "citrus", name: "Citrus" },
  { key: "musk", name: "Musk" },
  { key: "spicy", name: "Spicy" },
  { key: "gourmand", name: "Gourmand" },
];

const LIQUID = { woody: "#b98a57", floral: "#e7b9b4", fresh: "#cfe0dc", amber: "#d9a85e",
                 citrus: "#f0d98a", musk: "#e6ebe8", spicy: "#c98a5e", gourmand: "#8a5a3b" };

export const BLANK_LOOK = { shape: "rect", liquid: "#e3e6e4", cap: "#2b2f2d" };

export function buildPerfume(rec, stat = {}) {
  const id = rec.slug;
  const h = hash(id);
  const tags = rec.tags || [];
  const s = { reviews: 0, ratingSum: 0, likes: 0, week: 0, prevWeek: 0, month: 0, ...stat };
  return {
    id,
    name: rec.name,
    brand: rec.brand,
    tags,
    notes: rec.notes || [],
    image: rec.image || "",
    source: rec.source,
    addedBy: rec.addedBy || null,
    notesAddedBy: rec.notesAddedBy || null,
    score: { week: s.week, month: s.month, all: s.reviews + s.likes },
    change: s.prevWeek >= 5 ? Math.round(((s.week - s.prevWeek) / s.prevWeek) * 100) : 0,
    real: { reviews: s.reviews, ratingSum: s.ratingSum, likes: s.likes },
    look: { shape: ["rect", "tall", "round"][h % 3], liquid: LIQUID[tags[0]] || "#e3e6e4", cap: "#2b2f2d" },
  };
}

export function ratingFor(p) {
  const count = p.real.reviews;
  return { avg: count ? p.real.ratingSum / count : 0, count, reviews: count };
}

export const starsOf = (p) => { const r = ratingFor(p); return r.count ? Math.min(5, Math.max(1, Math.round(r.avg))) : 0; };

export function rankedPerfumes(period = "week") {
  return [...app.state.perfumes].sort((a, b) => b.score[period] - a.score[period] || b.real.reviews - a.real.reviews);
}

export function matchesQuery(p, q) {
  const hay = [p.name, p.brand, ...p.notes, ...p.tags].join(" ").toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((word) => hay.includes(word));
}

export const ownsPerfume = (p) => {
  const { user } = session();
  return !!user && p.source === "community" && p.addedBy === user.username;
};

export async function loadCatalog() {
  const res = await api("/perfumes");
  app.state.perfumes = res.perfumes.map((rec) => buildPerfume(rec, res.stats[rec.slug]));
}

let perfumeSync = null;
export function syncNewPerfumes() {
  if (perfumeSync) return perfumeSync;
  perfumeSync = api("/perfumes")
    .then((res) => {
      const fresh = res.perfumes.filter((rec) => !byId(rec.slug));
      fresh.forEach((rec) => app.state.perfumes.push(buildPerfume(rec, res.stats[rec.slug])));
      if (fresh.length) app.update();
    })
    .catch(() => {})
    .finally(() => { perfumeSync = null; });
  return perfumeSync;
}

export function addPerfume(json) {
  if (byId(json.slug)) return byId(json.slug);
  const p = buildPerfume(json);
  app.state.perfumes.push(p);
  app.update();
  return p;
}

export function updatePerfume(json) {
  const p = byId(json.slug);
  if (!p) return;
  Object.assign(p, { brand: json.brand, name: json.name, tags: json.tags || [], notes: json.notes || [], image: json.image || "" });
  renderAfterPerfumeChange(p);
}

export function removePerfume(id) {
  if (!byId(id)) return;
  app.state.perfumes = app.state.perfumes.filter((x) => x.id !== id);
  renderAfterPerfumeRemoved(id);
}

export function applyNotes(p, notes, addedBy) {
  p.notes = notes;
  p.notesAddedBy = addedBy || null;
  app.update();
}
