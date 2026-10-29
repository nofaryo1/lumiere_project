import { app, byId } from "./app";
import { api } from "../lib/api";
import { emit } from "../lib/events";
import { hash, sum } from "../lib/format";
import { toast, openAuth } from "./ui";
import { session } from "./session";
import { removePerfume, updatePerfume, applyNotes, addPerfume } from "./catalog";
import { currentPerfume } from "./router";

const PRO_POOL = {
  general: ["Gets lots of compliments", "Smells expensive", "Unique — not generic",
            "Smooth, beautiful dry down", "Beautiful bottle", "Easy to wear", "Great for layering"],
  fresh:    ["Perfect for hot weather", "Clean and office-safe"],
  citrus:   ["Bright, energizing opening", "Uplifting and cheerful"],
  woody:    ["Warm and grounding", "Sophisticated and calm"],
  floral:   ["Elegant and romantic", "Natural-smelling flowers"],
  amber:    ["Rich and warm in cold weather", "Cozy, enveloping trail"],
  gourmand: ["Cozy, edible sweetness", "Very comforting"],
  musk:     ["Soft skin-scent, very intimate", "Smells clean and fresh out of the shower"],
  spicy:    ["Warm, interesting spice", "Stands out in a crowd"],
};
const CON_POOL = {
  general: ["Pricey for the bottle size", "Sprayer could be better", "Very popular — you'll smell it on others",
            "Opening is a bit harsh", "Can feel slightly synthetic", "Hard to find in stores"],
  fresh:    ["Can feel generic"],
  citrus:   ["Opening disappears quickly"],
  woody:    ["Can read a bit serious"],
  floral:   ["Can turn powdery"],
  amber:    ["Too heavy for summer"],
  gourmand: ["Can be cloying in the heat"],
  musk:     ["Some people barely smell musk"],
  spicy:    ["Not for everyone"],
};

export const LEVELS = {
  longevity: ["Very weak", "Weak", "Moderate", "Long lasting", "Eternal"],
  sillage:   ["Intimate", "Soft", "Moderate", "Strong", "Enormous"],
  value:     ["Overpriced", "Pricey", "Fair", "Good value", "Great value"],
};

const WEAR = {
  fresh:    { Spring: 3, Summer: 5, Fall: 1, Winter: 0, Day: 5, Night: 1 },
  citrus:   { Spring: 4, Summer: 5, Fall: 1, Winter: 0, Day: 5, Night: 1 },
  woody:    { Spring: 1, Summer: 1, Fall: 4, Winter: 3, Day: 2, Night: 4 },
  floral:   { Spring: 5, Summer: 3, Fall: 2, Winter: 1, Day: 4, Night: 2 },
  amber:    { Spring: 0, Summer: 0, Fall: 4, Winter: 5, Day: 1, Night: 5 },
  gourmand: { Spring: 1, Summer: 0, Fall: 4, Winter: 5, Day: 2, Night: 4 },
  musk:     { Spring: 3, Summer: 3, Fall: 3, Winter: 2, Day: 4, Night: 2 },
  spicy:    { Spring: 1, Summer: 0, Fall: 5, Winter: 4, Day: 2, Night: 4 },
};
const KNOWN_PERFORMANCE = {
  "dior-sauvage":             { longevity: 4, sillage: 4 },
  "lattafa-yara":             { longevity: 4, sillage: 4 },
  "dolce-gabbana-light-blue": { longevity: 2, sillage: 2 },
};
const BASE_LONGEVITY = { fresh: 2, citrus: 2, floral: 3, musk: 3, woody: 4, spicy: 4, amber: 4, gourmand: 4 };

export const SEASONS = ["Spring", "Summer", "Fall", "Winter"];
export const TIMES = ["Day", "Night"];
export const STAR_LABELS = ["Didn't like it", "Not for me", "It's OK", "Like it", "Love it"];

try { localStorage.removeItem("lumiere:my-activity"); } catch (err) {}

function pick(list, n, seed) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = hash(seed + i) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

function spread(level, votes) {
  const w = [1, 2, 3, 4, 5].map((l) => Math.exp(-((l - level) ** 2) / 0.8));
  const total = w.reduce((a, b) => a + b, 0);
  return w.map((x) => Math.round((x / total) * votes));
}

export function levelOf(counts) {
  const total = sum(counts);
  if (!total) return 0;
  const mean = counts.reduce((s, c, i) => s + c * (i + 1), 0) / total;
  return Math.max(1, Math.min(5, Math.round(mean)));
}

const baseCache = {};

export function baseDetails(p) {
  if (baseCache[p.id]) return baseCache[p.id];
  const h = hash(p.id);
  const fam = p.tags;
  const reviewCount = p.real.reviews;

  const famLong = fam.length ? Math.round(fam.reduce((s, t) => s + BASE_LONGEVITY[t], 0) / fam.length) : 3;
  const known = KNOWN_PERFORMANCE[p.id] || {};
  const longevity = known.longevity || Math.max(1, Math.min(5, famLong + ((h >> 3) % 3) - 1));
  const sillage = known.sillage || Math.max(1, Math.min(5, longevity + ((h >> 5) % 3) - 1));
  const value = 2 + ((h >> 7) % 4);
  const votes = Math.round(reviewCount * 0.6);

  const pros = [], cons = [];
  if (votes) {
    if (longevity >= 4) pros.push("Long-lasting — still there the next morning");
    if (longevity <= 2) cons.push("Fades after a few hours");
    if (sillage >= 4) cons.push("Too loud for small offices");
    if (sillage <= 2) pros.push("Close to the skin — never overwhelming");
    if (value >= 4) pros.push("Great value for the quality");
  }
  const famPros = fam.flatMap((t) => PRO_POOL[t] || []);
  const famCons = fam.flatMap((t) => CON_POOL[t] || []);
  pros.push(...pick(famPros, 2, p.id + "fp"), ...pick(PRO_POOL.general, 2, p.id + "gp"));
  cons.push(...pick(famCons, 1, p.id + "fc"), ...pick(CON_POOL.general, 2, p.id + "gc"));

  const toItems = (list, max, k) => [...new Set(list)].slice(0, max).map((text, i) => ({
    text,
    votes: votes ? Math.max(1, Math.round(reviewCount * (0.7 - i * 0.12)) - (hash(text + p.id) % 7) * k) : 0,
  })).sort((a, b) => b.votes - a.votes);

  const lean = { Spring: 2, Summer: 2, Fall: 2, Winter: 2, Day: 3, Night: 3 };
  fam.forEach((t) => Object.keys(lean).forEach((k) => { lean[k] += WEAR[t][k]; }));
  const toVotes = (keys) => {
    const total = sum(keys.map((k) => lean[k]));
    return Object.fromEntries(keys.map((k) => [k, Math.round((lean[k] / total) * votes)]));
  };

  const details = {
    pros: toItems(pros, 5, 1),
    cons: toItems(cons, 4, 2),
    perf: { longevity: spread(longevity, votes), sillage: spread(sillage, votes), value: spread(value, votes) },
    wear: { ...toVotes(SEASONS), ...toVotes(TIMES) },
  };
  baseCache[p.id] = details;
  return details;
}

export function similarPerfumes(p, n = 5) {
  return app.state.perfumes
    .filter((o) => o.id !== p.id)
    .map((o) => ({ o, shared: o.tags.filter((t) => p.tags.includes(t)).length }))
    .sort((a, b) => b.shared - a.shared || b.o.score.month - a.o.score.month)
    .slice(0, n)
    .map((x) => x.o);
}

const noPerfVote = () => ({ longevity: null, sillage: null, value: null });
export async function loadPerformance(p) {
  try {
    p.perf = await api(`/perfumes/${encodeURIComponent(p.id)}/performance`);
  } catch (err) {
    p.perf = {
      counts: { longevity: [0, 0, 0, 0, 0], sillage: [0, 0, 0, 0, 0], value: [0, 0, 0, 0, 0] }, voters: 0, mine: noPerfVote(),
      wear: { counts: {}, mine: [] }, agree: { counts: {}, mine: [] },
    };
  }
}

export async function loadRealReviews(p) {
  try {
    const data = await api(`/perfumes/${encodeURIComponent(p.id)}/reviews`);
    p.realReviews = data.reviews;
    p.breakdown = data.breakdown;
  } catch (err) {
    p.realReviews = [];
    p.breakdown = [0, 0, 0, 0, 0];
  }
}

export const myWear = (p) => (p.perf && session().user ? p.perf.wear.mine : []);
export const myAgree = (p) => (p.perf && session().user ? p.perf.agree.mine : []);

export async function toggleOpinion(p, kind, value) {
  if (!session().user) {
    openAuth("login", kind === "wear"
      ? "Log in to say when you'd wear this perfume."
      : "Log in to vote on the pros and cons you agree with.");
    return;
  }
  if (!p.perf) await loadPerformance(p);
  const box = p.perf[kind];
  const on = !box.mine.includes(value);

  const snapshot = JSON.parse(JSON.stringify(p.perf));
  box.mine = on ? [...box.mine, value] : box.mine.filter((v) => v !== value);
  box.counts[value] = Math.max(0, (box.counts[value] || 0) + (on ? 1 : -1));
  app.update();
  try {
    const body = kind === "wear" ? { pick: value, on } : { key: value, on };
    p.perf = await api(`/perfumes/${encodeURIComponent(p.id)}/${kind}`, { method: "PUT", body });
    app.update();
  } catch (err) {
    p.perf = snapshot;
    app.update();
    toast(err.message);
  }
}

export async function votePerformance(p, key, level) {
  if (!session().user) {
    openAuth("login", "Log in to rate this perfume's longevity, sillage and value.");
    return;
  }
  if (!p.perf) await loadPerformance(p);
  const previous = p.perf.mine[key];
  const next = previous === level ? null : level;

  const snapshot = JSON.parse(JSON.stringify(p.perf));
  if (previous) p.perf.counts[key][previous - 1] -= 1;
  if (next) p.perf.counts[key][next - 1] += 1;
  p.perf.mine[key] = next;
  app.update();
  try {
    p.perf = await api(`/perfumes/${encodeURIComponent(p.id)}/performance`, { method: "PUT", body: { key, level: next } });
    app.update();
    toast(next ? "Thanks for voting!" : "Vote removed");
  } catch (err) {
    p.perf = snapshot;
    app.update();
    toast(err.message);
  }
}

export function setEditing(changes) {
  app.update(() => Object.assign(app.state.perfumePage, changes));
}

// Saves a new or edited review; throws with the message to show in the form
export async function saveReview(p, rating, text) {
  const wasEditing = app.state.perfumePage.editingReview;
  const res = wasEditing
    ? await api(`/reviews/${encodeURIComponent(wasEditing)}`, { method: "PUT", body: { rating, text } })
    : await api(`/perfumes/${encodeURIComponent(p.id)}/reviews`, { method: "POST", body: { rating, text } });
  p.real = { ...p.real, ...res.stats };
  await loadRealReviews(p);
  app.state.perfumePage.editingReview = null;
  app.state.perfumePage.composerSeq = (app.state.perfumePage.composerSeq || 0) + 1;
  app.update();
  emit("reviews-changed");
  toast(wasEditing ? "Your review was updated" : "Thanks! Your review was posted");
}

export async function deleteReview(p, id) {
  try {
    const res = await api(`/reviews/${encodeURIComponent(id)}`, { method: "DELETE" });
    p.real = { ...p.real, ...res.stats };
    await loadRealReviews(p);
    app.state.perfumePage.editingReview = null;
    emit("reviews-changed");
    app.update();
    toast("Your review was deleted");
  } catch (err) {
    toast(err.message);
  }
}

export const MAX_NOTES = 8;
export const NOTES_REQUIRED = 3;
export const parseNotes = (value) => [...new Set(String(value || "").split(",").map((n) => n.trim()).filter(Boolean))].slice(0, MAX_NOTES);

export function notesCountError(notes) {
  if (notes.length === NOTES_REQUIRED) return "";
  return `Please enter exactly ${NOTES_REQUIRED} notes${notes.length ? ` (you have ${notes.length})` : ""}.`;
}

export const canEditNotes = (p) => !!session().user && p.source === "community" && p.addedBy === session().user.username;

export async function submitNotes(p, value) {
  const notes = parseNotes(value);
  const invalid = notesCountError(notes);
  if (invalid) throw Object.assign(new Error(invalid), { focus: true });
  const res = await api(`/perfumes/${encodeURIComponent(p.id)}/notes`, { method: "PUT", body: { notes } });
  app.state.perfumePage.editingNotes = null;
  applyNotes(p, res.notes, res.notesAddedBy);
  toast(`The notes of ${p.name} were updated`);
}

export async function deletePerfume(id) {
  const p = byId(id);
  if (!p) return;
  // checked before the request: the live "perfume:deleted" event can remove it from the list first
  const onItsPage = currentPerfume() === p;
  try {
    await api(`/perfumes/${encodeURIComponent(id)}`, { method: "DELETE" });
    app.state.perfumePage.confirmingDelete = null;
    removePerfume(id);
    toast(`${p.name} was deleted`);
    if (onItsPage) {
      app.state.profile.tab = "added";
      location.hash = `profile/${encodeURIComponent(session().user.username)}`;
    }
  } catch (err) {
    toast(err.message);
    app.update();
  }
}

// Add form: POST with the photo as the body and the details in a header
export async function createPerfume(body, photo) {
  const { perfume } = await api("/perfumes", {
    method: "POST",
    file: photo,
    headers: { "X-Perfume": encodeURIComponent(JSON.stringify(body)) },
  });
  // the live "perfume:added" event may have added it already
  const p = addPerfume(perfume);
  const profile = app.state.profile.data;
  if (profile && session().user && profile.user.username === session().user.username) profile.added.unshift(p.id);
  app.update();
  location.hash = `perfume/${p.id}`;
  toast(`Thanks! ${p.name} was added to LUMIERE`);
}

export async function saveEditedPerfume(p, body, photo) {
  let { perfume } = await api(`/perfumes/${encodeURIComponent(p.id)}`, { method: "PATCH", body });
  if (photo) {
    try {
      const res = await api(`/perfumes/${encodeURIComponent(p.id)}/image`, { method: "PUT", file: photo });
      perfume = { ...perfume, image: res.image };
    } catch (err) {
      toast(`Changes saved, but the photo failed: ${err.message}`);
    }
  }
  updatePerfume(perfume);
  location.hash = `perfume/${encodeURIComponent(p.id)}`;
  toast(`${perfume.name} was updated`);
}

export function checkPerfumeExists(brand, name, except) {
  const extra = except ? `&except=${encodeURIComponent(except)}` : "";
  return api(`/perfumes/check?brand=${encodeURIComponent(brand)}&name=${encodeURIComponent(name)}${extra}`);
}
