// Loads the built-in catalog and groups once MongoDB is connected
const mongoose = require("mongoose");
const Review = require("../models/Review");
const { seedCatalog } = require("./catalog");
const { seedGroups } = require("./groups");

/* ---------- Catalog seeding (lib/catalog.js) ---------- */
async function seedCatalogOnStart() {
  await Review.syncIndexes();   // drops the old "one review per perfume" unique index if it's still there
  const count = await seedCatalog();
  const groups = await seedGroups();
  console.log(`Perfume catalog ready (${count} perfumes, ${groups} built-in groups)`);
}

if (mongoose.connection.readyState === 1) seedCatalogOnStart().catch(console.error);
else mongoose.connection.once("connected", () => seedCatalogOnStart().catch(console.error));
