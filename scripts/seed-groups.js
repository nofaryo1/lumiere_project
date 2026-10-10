// Gives the demo community members (see seed-community.js) group activity:
// memberships, posts, replies and likes over the past year.
//
//   npm run seed:groups              -> (re)builds demo group activity
//   npm run seed:groups -- --remove  -> removes demo group activity
//
// Only demo members' memberships/posts are replaced; real members' posts
// and memberships are kept.
require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");

const User = require("../models/User");
const Perfume = require("../models/Perfume");
const Review = require("../models/Review");
const Group = require("../models/Group");
const GroupMember = require("../models/GroupMember");
const GroupPost = require("../models/GroupPost");
const { seedGroups } = require("../lib/groups");

const DB_NAME = process.env.SEED_DB || "lumiere";
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();
const YEAR_AGO = NOW - 365 * DAY;

/* ---------- Deterministic randomness ---------- */
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(777);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => a + Math.floor(rand() * (b - a + 1));

/* ---------- Which perfumes each group talks about ---------- */
const NICHE = ["Byredo", "Xerjoff", "Amouage", "Diptyque", "Maison Margiela", "Jo Malone", "Penhaligon's", "Bortnikoff", "Tom Ford", "Guerlain"];
const ARABIAN = ["Lattafa", "Haramain", "Armaf"];
const BUDGET = ["Zara", "Armaf", "Farmasi", "Nautica", "Lattafa", "Calvin Klein", "Joop", "4711", "Bruno Banani", "The Man Company"];
const TOPIC = {
  woody: "woody", floral: "floral", fresh: "fresh", amber: "amber", citrus: "citrus", musk: "musky", spicy: "spicy", gourmand: "gourmand",
  "niche-explorers": "niche", "oud-arabian-perfumery": "oud", "budget-finds-dupes": "budget-friendly", "beginners-corner": "everyday",
};
const SEASON_PEAK = { fresh: 196, citrus: 196, floral: 105, woody: 310, amber: 15, gourmand: 15, spicy: 340, musk: 120 };

function groupPerfumes(group, perfumes) {
  if (group.family) return perfumes.filter((p) => p.tags.includes(group.family));
  switch (group.slug) {
    case "niche-explorers": return perfumes.filter((p) => NICHE.includes(p.brand));
    case "oud-arabian-perfumery": return perfumes.filter((p) => ARABIAN.includes(p.brand) || /oud/i.test(p.name + " " + p.notes.join(" ")));
    case "budget-finds-dupes": return perfumes.filter((p) => BUDGET.includes(p.brand));
    default: return perfumes.filter((p) => ["dior-sauvage", "dolce-gabbana-light-blue", "chanel-bleu-de-chanel", "armani-acqua-di-gio", "versace-eros", "chanel-no-5", "lattafa-yara", "marc-jacobs-daisy", "chanel-coco-mademoiselle", "calvin-klein-ck-one"].includes(p.slug));
  }
}

/* ---------- Post & reply text ---------- */
const OPINION = ["The dry down is gorgeous.", "Got two compliments already.", "It lasts all day on me.", "Very different from what I expected.",
  "Smells way more expensive than it is.", "My partner keeps stealing it.", "Not sure about the opening, but it gets better."];
const ADJ = ["lighter", "sweeter", "fresher", "darker", "more unique", "cheaper", "more long-lasting"];
const WEATHER = ["rainy", "cold", "sunny", "hot", "lazy Sunday"];
const POSTS = [
  "What's your favorite {topic} perfume for {season}? Mine is {P}.",
  "Just got {P} and I'm obsessed. {opinion}",
  "Is {P} worth the hype, or should I get {P2} instead?",
  "Hot take: {P} is a bit overrated. Change my mind.",
  "Looking for something similar to {P} but a little {adj}. Any ideas?",
  "Layering tip: {P} + {P2} works surprisingly well together.",
  "{P} on a {weather} day is pure magic.",
  "How long does {P} last on you? I get about {hours} hours.",
  "Finally tested {P} in store today. {opinion}",
  "Which do you prefer: {P} or {P2}?",
  "My {topic} top 3 right now: {P}, {P2} and {P3}.",
  "Blind buy recommendations in this style? I loved {P}.",
];
const BEGINNER_POSTS = [
  "First time buying perfume — is {P} a safe choice?",
  "How did you find your signature scent?",
  "Where do you spray perfume so it lasts longer?",
  "EDP vs EDT — what's the real difference?",
  "Can someone explain what 'sillage' means?",
  "Is it okay to wear {P} to the office?",
];
const BUDGET_POSTS = [
  "Found {P} on sale — great value!",
  "Best alternative to {P} that doesn't cost a fortune?",
  "{P} smells way more expensive than its price.",
];
const REPLIES = ["Totally agree!", "Try {P}, you won't regret it.", "{P} is my go-to too.", "Hmm, it didn't last long on me.", "Great pick!",
  "I'd go for {P} instead.", "Thanks for the tip, ordering a sample now.", "Same here!", "Interesting, I get a completely different vibe from it.",
  "Hard agree, it's a masterpiece.", "Have you tried layering it?", "Sample first — it's very skin dependent.", "Love this thread."];

const SEASON_NAMES = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "fall", "fall", "fall", "winter"];
const label = (p) => `${p.brand ? p.brand + " " : ""}${p.name}`;

function fillText(tpl, pool, when, topic) {
  const [a, b, c] = [pick(pool), pick(pool), pick(pool)];
  return {
    text: tpl
      .replace("{P}", label(a)).replace("{P2}", label(b)).replace("{P3}", label(c))
      .replace("{topic}", topic).replace("{season}", SEASON_NAMES[new Date(when).getUTCMonth()])
      .replace("{opinion}", pick(OPINION)).replace("{adj}", pick(ADJ)).replace("{weather}", pick(WEATHER))
      .replace("{hours}", String(between(3, 12))),
    perfume: tpl.includes("{P}") ? a.slug : null,
  };
}

function seasonFactor(group, time) {
  const peak = group.family ? SEASON_PEAK[group.family] : null;
  if (peak == null) return 1;
  const day = new Date(time).getUTCMonth() * 30.5 + new Date(time).getUTCDate();
  return 1 + 0.75 * Math.cos((2 * Math.PI * (day - peak)) / 365);
}

// A post date after `from`, weighted toward recent months and the group's season
function postTime(group, from) {
  const start = Math.max(from, YEAR_AGO);
  for (let tries = 0; tries < 20; tries++) {
    const t = start + rand() * (NOW - start);
    if (rand() * 1.75 < seasonFactor(group, t)) return t;
  }
  return start + rand() * (NOW - start);
}

/* ---------- Remove demo group activity ---------- */
async function removeDemoGroupData(ids) {
  if (!ids.length) return;
  const demoPosts = await GroupPost.find({ user: { $in: ids }, parent: null }).distinct("_id");
  await GroupPost.deleteMany({ $or: [{ user: { $in: ids } }, { parent: { $in: demoPosts } }] });
  await GroupMember.deleteMany({ user: { $in: ids } });
  // real posts: drop demo likes and recount replies
  await GroupPost.updateMany({ likedBy: { $in: ids } }, [
    { $set: { likedBy: { $setDifference: ["$likedBy", ids] } } },
    { $set: { likesCount: { $size: "$likedBy" } } },
  ], { updatePipeline: true });
  const counts = await GroupPost.aggregate([{ $match: { parent: { $ne: null } } }, { $group: { _id: "$parent", n: { $sum: 1 } } }]);
  await GroupPost.updateMany({ parent: null }, { $set: { repliesCount: 0 } }, { timestamps: false });
  if (counts.length) {
    await GroupPost.bulkWrite(counts.map((c) => ({ updateOne: { filter: { _id: c._id }, update: { $set: { repliesCount: c.n } }, timestamps: false } })));
  }
}

async function insertInBatches(collection, docs, size = 2000) {
  for (let i = 0; i < docs.length; i += size) {
    await mongoose.connection.db.collection(collection).insertMany(docs.slice(i, i + size), { ordered: false });
  }
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: DB_NAME });
  console.log(`Connected to "${DB_NAME}"`);
  await Promise.all([Group, GroupMember, GroupPost].map((m) => m.init()));
  await seedGroups();

  const users = await User.find({ seeded: true }, "_id createdAt").lean();
  const ids = users.map((u) => u._id);
  await removeDemoGroupData(ids);
  if (process.argv.includes("--remove")) { console.log("Removed demo group activity"); return; }
  if (!users.length) { console.log("No demo members found — run `npm run seed:community` first."); return; }

  const groups = await Group.find({ source: "builtin" }).lean();
  const perfumes = await Perfume.find({}, "slug brand name tags notes").lean();
  const pools = new Map(groups.map((g) => [String(g._id), groupPerfumes(g, perfumes)]));
  const tagsOf = new Map(perfumes.map((p) => [p.slug, p]));

  // what each member likes, based on their reviews
  const reviewed = await Review.aggregate([{ $match: { user: { $in: ids } } }, { $group: { _id: "$user", perfumes: { $push: "$perfume" } } }]);
  const tasteOf = new Map(reviewed.map((r) => [String(r._id), r.perfumes.map((s) => tagsOf.get(s)).filter(Boolean)]));

  // ---- memberships ----
  const members = [];
  const membersOf = new Map(groups.map((g) => [String(g._id), []]));
  for (const u of users) {
    const taste = tasteOf.get(String(u._id)) || [];
    const weights = groups.map((g) => {
      let w = 1;
      for (const p of taste) {
        if (g.family && p.tags.includes(g.family)) w += 1.2;
        if (g.slug === "niche-explorers" && NICHE.includes(p.brand)) w += 2;
        if (g.slug === "oud-arabian-perfumery" && (ARABIAN.includes(p.brand) || /oud/i.test(p.notes.join(" ")))) w += 2;
        if (g.slug === "budget-finds-dupes" && BUDGET.includes(p.brand)) w += 1.5;
      }
      if (g.slug === "beginners-corner") w += taste.length <= 3 ? 6 : 0.5;
      return w;
    });
    const n = taste.length === 0 ? between(0, 2) : between(1, Math.min(6, 2 + Math.ceil(taste.length / 8)));
    const chosen = new Set();
    for (let t = 0; t < n * 4 && chosen.size < n; t++) {
      const total = weights.reduce((a, b, i) => a + (chosen.has(i) ? 0 : b), 0);
      let r = rand() * total;
      for (let i = 0; i < groups.length; i++) {
        if (chosen.has(i)) continue;
        r -= weights[i];
        if (r <= 0) { chosen.add(i); break; }
      }
    }
    for (const i of chosen) {
      const g = groups[i];
      const joined = new Date(u.createdAt.getTime() + Math.pow(rand(), 1.5) * (NOW - u.createdAt.getTime()));
      members.push({ group: g._id, user: u._id, createdAt: joined, updatedAt: joined, _activity: taste.length });
      membersOf.get(String(g._id)).push(u._id);
    }
  }

  // ---- posts ----
  const posts = [];
  const replies = [];
  for (const m of members) {
    const g = groups.find((x) => x._id.equals(m.group));
    const pool = pools.get(String(g._id));
    if (!pool.length) continue;
    // members post at a steady pace: longer membership -> more posts
    const years = Math.max(0.05, (NOW - Math.max(m.createdAt.getTime(), YEAR_AGO)) / (365 * DAY));
    const pace = m._activity === 0 ? (rand() < 0.3 ? 1 : 0) : between(1, Math.min(12, 2 + Math.floor(m._activity / 4)));
    const n = Math.round(pace * years + (rand() < (pace * years) % 1 ? 1 : 0));
    for (let k = 0; k < n; k++) {
      const t = postTime(g, m.createdAt.getTime());
      const templates = g.slug === "beginners-corner" ? BEGINNER_POSTS : g.slug === "budget-finds-dupes" ? [...BUDGET_POSTS, ...POSTS] : POSTS;
      const { text, perfume } = fillText(pick(templates), pool, t, TOPIC[g.family || g.slug]);
      const groupMembers = membersOf.get(String(g._id));
      const likeCount = rand() < 0.4 ? between(0, 2) : rand() < 0.85 ? between(3, 12) : between(13, 40);
      const likedBy = [...new Set(Array.from({ length: likeCount }, () => pick(groupMembers)))].filter((id) => !id.equals(m.user));
      const post = {
        _id: new mongoose.Types.ObjectId(),
        group: g._id, user: m.user, parent: null, text, perfume,
        likedBy, likesCount: likedBy.length, repliesCount: 0,
        createdAt: new Date(t), updatedAt: new Date(t),
      };
      posts.push(post);

      const replyCount = rand() < 0.35 ? 0 : rand() < 0.85 ? between(1, 4) : between(5, 12);
      for (let r = 0; r < replyCount; r++) {
        // replies come within ~10 days of the post (never in the future)
        const at = t + Math.pow(rand(), 2) * Math.min(10 * DAY, NOW - t - 60 * 1000);
        const author = pick(groupMembers);
        const replyLikes = rand() < 0.6 ? [] : [...new Set(Array.from({ length: between(1, 6) }, () => pick(groupMembers)))].filter((id) => !id.equals(author));
        replies.push({
          _id: new mongoose.Types.ObjectId(),
          group: g._id, user: author, parent: post._id, text: fillText(pick(REPLIES), pool, at, "").text, perfume: null,
          likedBy: replyLikes, likesCount: replyLikes.length, repliesCount: 0,
          createdAt: new Date(at), updatedAt: new Date(at),
        });
        post.repliesCount++;
      }
    }
  }

  members.forEach((m) => { delete m._activity; });
  await insertInBatches("groupmembers", members);
  await insertInBatches("groupposts", posts);
  await insertInBatches("groupposts", replies);
  console.log(`Created ${members.length} memberships, ${posts.length} posts and ${replies.length} replies in ${groups.length} groups`);
}

module.exports = { removeDemoGroupData };

if (require.main === module) {
  main()
    .catch((err) => { console.error(err); process.exitCode = 1; })
    .finally(() => mongoose.disconnect());
}
