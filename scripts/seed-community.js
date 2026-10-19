//   npm run seed:community            -> (re)builds the demo community in the "lumiere" database
//   npm run seed:community -- --remove -> removes all demo members and everything they created
require("dotenv").config({ quiet: true });
const crypto = require("crypto");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Perfume = require("../models/Perfume");
const Review = require("../models/Review");
const Like = require("../models/Like");
const Follow = require("../models/Follow");
const { seedCatalog } = require("../lib/catalog");

const DB_NAME = process.env.SEED_DB || "lumiere";
const MEMBERS = 2000;
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261010);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => a + Math.floor(rand() * (b - a + 1));
const gauss = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
function weightedPick(items, weights, total) {
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}

const FIRST = ["Noa", "Maya", "Liam", "Emma", "Yael", "Daniel", "Sofia", "Omer", "Lea", "Ethan", "Tamar", "Lucas", "Chloe", "Itai", "Mia",
  "Noah", "Shira", "Leo", "Ava", "Ariel", "Zoe", "Jonathan", "Camille", "Adam", "Nina", "Eitan", "Clara", "Amit", "Lina", "Gabriel",
  "Hila", "Mateo", "Ella", "Yoni", "Isabel", "Ori", "Julia", "Nadav", "Alice", "Ben", "Rotem", "Hugo", "Anna", "Tom", "Inès",
  "Aviv", "Elena", "Matan", "Laura", "Sam", "Michal", "Diego", "Sarah", "Guy", "Hannah", "Ido", "Olivia", "Elias", "Dana", "Marco",
  "Keren", "Theo", "Lily", "Asaf", "Grace", "Nir", "Amelia", "Raphael", "Gal", "Isla", "Yuval", "Luna", "Jonas", "Rachel", "Felix",
  "Shani", "Victor", "Ruby", "Ilan", "Sara", "Max", "Neta", "Alma", "Oscar", "Lior", "Mila", "Erez", "Eva", "Ronen", "Iris",
  "Kai", "Talia", "Adrian", "Naomi", "Eli", "Stella", "Ran", "Leah", "Paul", "Orly", "Jasmine", "David", "Inbar", "Aria", "Nathan"];
const LAST = ["Cohen", "Levi", "Mizrahi", "Peretz", "Biton", "Friedman", "Katz", "Azoulay", "Shapiro", "Ben-David", "Martin", "Bernard",
  "Dubois", "Laurent", "Moreau", "Garcia", "Rossi", "Romano", "Silva", "Costa", "Smith", "Johnson", "Brown", "Miller", "Wilson",
  "Taylor", "Anderson", "Thomas", "Moore", "Clark", "Weiss", "Klein", "Schwartz", "Roth", "Stern", "Novak", "Kowalski", "Haddad",
  "Nasser", "Kaplan", "Golan", "Avraham", "Dahan", "Amar", "Ohana", "Rosen", "Segal", "Adler", "Fischer", "Weber", "Becker", "Ricci",
  "Marino", "Greco", "Bruno", "Lopez", "Martinez", "Fernandez", "Santos", "Pereira", "Nguyen", "Kim", "Park", "Tanaka", "Sato",
  "Ito", "Singh", "Patel", "Haim", "Barak", "Yosef", "Eliyahu", "Gabay", "Malka", "Vaknin", "Harel", "Tal", "Shalom", "Hayun", "Sasson"];
const BIOS = ["Woody scents all year round.", "Vanilla addict.", "Collector of niche perfumes.", "Always hunting for the perfect summer scent.",
  "Fresh and clean is my thing.", "Rose lover, unapologetically.", "Oud & incense enthusiast.", "Sampling everything, buying very little.",
  "Perfume is my favorite accessory.", "I review honestly — no hype.", "Citrus in summer, amber in winter.", "Building my signature collection.",
  "Musk and skin scents only.", "Gourmand fan with a sweet tooth.", "Learning about notes one bottle at a time.", "Decant hoarder.",
  "Mostly designer, a little niche.", "Office-safe scents are my specialty.", "Compliment-getters only.", "Fragrance student, forever."];
const PLACES = ["Tel Aviv", "Paris", "London", "Haifa", "Berlin", "Milan", "New York", "Jerusalem", "Barcelona", "Lisbon", "Toronto", "Amsterdam"];

const OPEN = {
  5: ["Absolutely love this one.", "A true favorite of mine.", "One of the best perfumes I own.", "Instant compliment magnet.",
      "Blind bought it and zero regrets.", "This has become my signature.", "I can't stop wearing it."],
  4: ["Really nice and easy to wear.", "Very good, almost perfect.", "Glad I picked this up.", "A solid choice.",
      "Pleasantly surprised by this one.", "Better than I expected."],
  3: ["It's okay, nothing special for me.", "Mixed feelings about this one.", "Nice, but not a blind buy.", "Decent, but I expected more."],
  2: ["Not really for me.", "Disappointed after all the hype.", "I wanted to like it more."],
  1: ["Not for me, unfortunately.", "Smells too synthetic on my skin.", "Really didn't work for me."],
};
const NOTE_LINES = ["The {a} really stands out.", "I mostly get {a} and a bit of {b}.", "The {a} opening is lovely, then it settles into {b}.",
  "{A} is front and center.", "Beautiful {a}, very well blended.", "The {b} in the dry down is my favorite part."];
const FAMILY_LINES = ["Very {f} overall.", "A classic {f} scent.", "Nicely {f} without being boring."];
const PERFORMANCE = {
  good: ["Lasts all day on me.", "Still there the next morning on my scarf.", "Beast mode — two sprays are enough.", "Great longevity on clothes."],
  mid: ["Lasts around 6 hours.", "Projection is moderate, people notice it up close.", "Decent longevity for the price."],
  weak: ["Fades after about 3–4 hours.", "Becomes a skin scent pretty quickly.", "I wish it lasted longer."],
};
const OCCASION = {
  warm: ["Perfect for hot summer days.", "Great for the office and daytime.", "My go-to after the gym."],
  cold: ["Perfect for cold evenings.", "My go-to date-night scent.", "Cozy for winter."],
  any: ["Works for almost any occasion.", "I wear it mostly on weekends.", "Easy to reach for every day."],
};
const CLOSE = { 5: ["Will rebuy for sure.", "Highly recommend!", "Already on my second bottle."], 4: ["Worth trying a sample.", "Would recommend."],
  3: ["Try before you buy."], 2: ["Sample first."], 1: ["Sample first."] };

const fill = (tpl, notes, fam) => {
  const [a, b] = [notes[0] || "", notes[1] || notes[0] || ""].map((n) => n.toLowerCase());
  return tpl.replace("{A}", a.charAt(0).toUpperCase() + a.slice(1)).replace("{a}", a).replace("{b}", b).replace("{f}", fam);
};

const WARM = ["fresh", "citrus"];
const COLD = ["amber", "gourmand", "spicy", "woody"];

function reviewText(perfume, rating) {
  const parts = [pick(OPEN[rating])];
  if (perfume.notes.length && rand() < 0.85) parts.push(fill(pick(NOTE_LINES), perfume.notes));
  else if (perfume.tags.length) parts.push(fill(pick(FAMILY_LINES), [], perfume.tags[0]));
  if (rand() < 0.7) {
    const strength = perfume.tags.some((t) => COLD.includes(t)) ? (rand() < 0.7 ? "good" : "mid") : (rand() < 0.5 ? "mid" : "weak");
    parts.push(pick(PERFORMANCE[rating <= 2 && rand() < 0.6 ? "weak" : strength]));
  }
  if (rand() < 0.6) {
    const when = perfume.tags.some((t) => WARM.includes(t)) ? "warm" : perfume.tags.some((t) => COLD.includes(t)) ? "cold" : "any";
    parts.push(pick(OCCASION[rand() < 0.75 ? when : "any"]));
  }
  if (rand() < 0.45) parts.push(pick(CLOSE[rating]));
  return parts.join(" ");
}

const FAVORITES = ["dior-sauvage", "dolce-gabbana-light-blue", "lattafa-yara", "chanel-bleu-de-chanel", "armani-acqua-di-gio",
  "versace-eros", "chanel-no-5", "chanel-coco-mademoiselle", "dior-jadore", "tom-ford-ombre-leather", "byredo-gypsy-water", "xerjoff-naxos"];
const SEASON_PEAK = { fresh: 196, citrus: 196, floral: 105, woody: 310, amber: 15, gourmand: 15, spicy: 340, musk: 120 };
const FAVORITE_PEAK = { "dior-sauvage": 150, "dolce-gabbana-light-blue": 200, "lattafa-yara": 10, "chanel-bleu-de-chanel": 300 };

function popularity(perfumes) {
  const rest = perfumes.map((p) => p.slug).filter((s) => !FAVORITES.includes(s)).sort(() => rand() - 0.5);
  const order = [...FAVORITES.filter((s) => perfumes.some((p) => p.slug === s)), ...rest];
  const weight = {};
  order.forEach((slug, i) => {
    weight[slug] = i < 4 ? 30 - i * 1.2 : 1 / Math.pow(i + 2, 0.75) * 40;
  });
  return weight;
}

function seasonFactor(perfume, time) {
  const day = (new Date(time).getUTCMonth() * 30.5 + new Date(time).getUTCDate());
  const peak = FAVORITE_PEAK[perfume.slug] ?? (perfume.tags.length ? SEASON_PEAK[perfume.tags[0]] : null);
  if (peak == null) return 1;
  const amp = FAVORITE_PEAK[perfume.slug] != null ? 0.85 : 0.6;
  return 1 + amp * Math.cos((2 * Math.PI * (day - peak)) / 365);
}

async function removeDemo() {
  const ids = await User.find({ seeded: true }).distinct("_id");
  if (!ids.length) return 0;
  await Review.deleteMany({ user: { $in: ids } });
  await Like.deleteMany({ user: { $in: ids } });
  await Follow.deleteMany({ $or: [{ follower: { $in: ids } }, { following: { $in: ids } }] });
  await Review.updateMany({ likedBy: { $in: ids } }, [
    { $set: { likedBy: { $setDifference: ["$likedBy", ids] } } },
    { $set: { likesCount: { $size: "$likedBy" } } },
  ], { updatePipeline: true });
  await require("./seed-groups").removeDemoGroupData(ids);
  await mongoose.connection.db.collection("sessions").deleteMany({ user: { $in: ids } });
  await User.deleteMany({ _id: { $in: ids } });
  return ids.length;
}

async function insertInBatches(collection, docs, size = 2000) {
  for (let i = 0; i < docs.length; i += size) {
    await mongoose.connection.db.collection(collection).insertMany(docs.slice(i, i + size), { ordered: false });
  }
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: DB_NAME });
  console.log(`Connected to "${DB_NAME}"`);
  await Promise.all([User, Perfume, Review, Like, Follow].map((m) => m.init()));

  const removed = await removeDemo();
  if (removed) console.log(`Removed ${removed} previous demo members`);
  if (process.argv.includes("--remove")) return;

  await seedCatalog();
  const perfumes = await Perfume.find({ source: "catalog" }).lean();
  const weight = popularity(perfumes);

  const taken = new Set(await User.distinct("username"));
  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
  const users = [];
  while (users.length < MEMBERS) {
    const first = pick(FIRST);
    const last = pick(LAST);
    const f = first.toLowerCase().replace(/[^a-z]/g, "");
    const l = last.toLowerCase().replace(/[^a-z]/g, "");
    const base = pick([`${f}.${l}`, `${f}${l}`, `${f}_${l}`, `${f}.${l[0]}`, `${f}${between(1, 99)}`, `${f}_${l[0]}${between(10, 99)}`, `${l}.${f}`]);
    let username = base.slice(0, 18);
    for (let n = 2; taken.has(username) || username.length < 3; n++) username = `${base.slice(0, 16)}${n}`;
    taken.add(username);

    const joined = NOW - Math.pow(rand(), 1.2) * 420 * DAY;
    const r = rand();
    const level = r < 0.18 ? 0 : r < 0.55 ? 1 : r < 0.85 ? 2 : r < 0.97 ? 3 : 4;
    users.push({
      _id: new mongoose.Types.ObjectId(),
      username,
      email: `${username}@example.com`,
      displayName: rand() < 0.5 ? `${first} ${last}` : `${first} ${last[0]}.`,
      passwordHash,
      bio: rand() < 0.65 ? `${pick(BIOS)}${rand() < 0.4 ? ` Based in ${pick(PLACES)}.` : ""}` : "",
      seeded: true,
      createdAt: new Date(joined),
      updatedAt: new Date(joined),
      _level: level,
    });
  }

  const reviewCount = [0, () => between(1, 3), () => between(4, 11), () => between(12, 26), () => between(27, 55)];
  const reviews = [];
  const ratedBy = new Map();
  const quality = Object.fromEntries(perfumes.map((p) => [p.slug, Math.min(4.7, Math.max(3.3, 4.05 + gauss() * 0.35))]));
  for (const u of users) {
    const n = u._level ? reviewCount[u._level]() : 0;
    const done = new Set();
    const mine = [];
    for (let k = 0; k < n * 3 && mine.length < n; k++) {
      const time = u.createdAt.getTime() + Math.pow(rand(), 0.75) * (NOW - u.createdAt.getTime());
      const weights = perfumes.map((p) => (done.has(p.slug) ? 0 : weight[p.slug] * seasonFactor(p, time)));
      const total = weights.reduce((a, b) => a + b, 0);
      const p = weightedPick(perfumes, weights, total);
      if (done.has(p.slug)) continue;
      done.add(p.slug);
      const rating = Math.min(5, Math.max(1, Math.round(quality[p.slug] + gauss() * 0.85)));
      const at = new Date(time);
      reviews.push({
        _id: new mongoose.Types.ObjectId(),
        user: u._id, perfume: p.slug, rating, text: reviewText(p, rating),
        likedBy: [], likesCount: 0, createdAt: at, updatedAt: at,
      });
      mine.push({ slug: p.slug, rating });
    }
    ratedBy.set(u._id, mine);
  }

  for (const r of reviews) {
    const x = rand();
    let k = x < 0.45 ? between(0, 2) : x < 0.82 ? between(3, 10) : x < 0.96 ? between(11, 30) : between(31, 75);
    if (r.rating === 5 && r.text.length > 140) k = Math.round(k * 1.3);
    const voters = new Set();
    for (let t = 0; t < k * 2 && voters.size < k; t++) {
      const v = users[Math.floor(rand() * users.length)];
      if (!v._id.equals(r.user)) voters.add(v._id);
    }
    r.likedBy = [...voters];
    r.likesCount = r.likedBy.length;
  }

  const likes = [];
  const allSlugs = perfumes.map((p) => p.slug);
  const likeWeights = allSlugs.map((s) => weight[s]);
  const likeTotal = likeWeights.reduce((a, b) => a + b, 0);
  for (const u of users) {
    const loved = ratedBy.get(u._id).filter((x) => x.rating >= 4).map((x) => x.slug);
    const extra = between(1, 10) + u._level * 2;
    const set = new Set(loved);
    for (let t = 0; t < extra * 3 && set.size < loved.length + extra; t++) set.add(weightedPick(allSlugs, likeWeights, likeTotal));
    for (const slug of set) {
      const at = new Date(u.createdAt.getTime() + rand() * (NOW - u.createdAt.getTime()));
      likes.push({ user: u._id, perfume: slug, createdAt: at, updatedAt: at });
    }
  }

  const follows = [];
  const influence = users.map((u) => 1 + ratedBy.get(u._id).length * 1.5);
  const influenceTotal = influence.reduce((a, b) => a + b, 0);
  for (const u of users) {
    const n = 2 + Math.floor(Math.pow(rand(), 2) * 38) + u._level * 2;
    const set = new Set();
    for (let t = 0; t < n * 3 && set.size < n; t++) {
      const target = weightedPick(users, influence, influenceTotal);
      if (target !== u) set.add(target);
    }
    for (const target of set) {
      const from = Math.max(u.createdAt.getTime(), target.createdAt.getTime());
      const at = new Date(from + rand() * (NOW - from));
      follows.push({ follower: u._id, following: target._id, createdAt: at, updatedAt: at });
    }
  }

  users.forEach((u) => { delete u._level; });
  await insertInBatches("users", users);
  await insertInBatches("reviews", reviews);
  await insertInBatches("likes", likes);
  await insertInBatches("follows", follows);
  await Review.updateMany({ likesCount: { $exists: false } }, { $set: { likesCount: 0, likedBy: [] } });

  console.log(`Created ${users.length} members, ${reviews.length} reviews, ${likes.length} likes, ${follows.length} follows`);
  console.log("Tip: run `npm run seed:groups` to give them group activity too.");
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
