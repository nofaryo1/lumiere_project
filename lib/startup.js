const mongoose = require("mongoose");
const Review = require("../models/Review");
const { seedCatalog } = require("./catalog");
const { seedGroups } = require("./groups");

async function seedCatalogOnStart() {
  await Review.syncIndexes();
  const count = await seedCatalog();
  const groups = await seedGroups();
  console.log(`Perfume catalog ready (${count} perfumes, ${groups} built-in groups)`);
}

if (mongoose.connection.readyState === 1) seedCatalogOnStart().catch(console.error);
else mongoose.connection.once("connected", () => seedCatalogOnStart().catch(console.error));
