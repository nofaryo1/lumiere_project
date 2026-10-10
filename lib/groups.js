// The built-in discussion groups, created/updated on server start.
const Group = require("../models/Group");
const { slugify, normalize } = require("./perfumeKey");

const BUILTIN_GROUPS = [
  { name: "Woody Lovers", family: "woody", description: "Sandalwood, cedar, vetiver and everything that smells like a walk in the forest." },
  { name: "Floral Garden", family: "floral", description: "Roses, jasmine, iris and tuberose — share your favorite blooms in a bottle." },
  { name: "Fresh & Clean", family: "fresh", description: "Aquatic, airy and office-safe scents for every day." },
  { name: "Amber & Resin", family: "amber", description: "Warm, glowing ambers and resins for cold evenings." },
  { name: "Citrus Club", family: "citrus", description: "Bergamot, neroli, lemon — bright scents and summer favorites." },
  { name: "Musk & Skin Scents", family: "musk", description: "Soft, close-to-the-skin musks that smell like you, but better." },
  { name: "Spice Route", family: "spicy", description: "Pepper, cardamom, cinnamon and incense lovers unite." },
  { name: "Gourmand Kitchen", family: "gourmand", description: "Vanilla, tonka, coffee and caramel — perfumes good enough to eat." },
  { name: "Niche Explorers", family: null, description: "Byredo, Xerjoff, Amouage and beyond: discovering niche houses together." },
  { name: "Oud & Arabian Perfumery", family: null, description: "Oud, amber and Middle Eastern perfumery — from Lattafa to the classics." },
  { name: "Budget Finds & Dupes", family: null, description: "Great scents that don't cost a fortune, and the best alternatives to pricey favorites." },
  { name: "Beginners' Corner", family: null, description: "New to fragrance? Ask anything — no question is too basic." },
];

async function seedGroups() {
  const ops = BUILTIN_GROUPS.map((g) => ({
    updateOne: {
      filter: { slug: slugify(g.name) },
      update: {
        $set: { name: g.name, nameKey: normalize(g.name), description: g.description, family: g.family, source: "builtin" },
      },
      upsert: true,
    },
  }));
  await Group.bulkWrite(ops);
  return BUILTIN_GROUPS.length;
}

module.exports = { seedGroups, BUILTIN_GROUPS };
