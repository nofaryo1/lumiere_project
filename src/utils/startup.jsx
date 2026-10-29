const mongoose = require("mongoose");
const Review = require("../models/Review");
const { seedCatalog } = require("./catalog");
const { seedGroups } = require("./groups");
const { syncUploads } = require("./uploads");
const { perfumeStats, perfumeList, clearPerfumeStats, clearPerfumeList } = require("./perfumeCache");

async function seedCatalogOnStart() {
  await Review.syncIndexes();
  const count = await seedCatalog();
  const groups = await seedGroups();
  const photos = await syncUploads();
  clearPerfumeList();
  clearPerfumeStats();
  await Promise.all([perfumeList(), perfumeStats()]); // prepared now, so the first visitor doesn't wait
  console.log(`Perfume catalog ready (${count} perfumes, ${groups} built-in groups)${photos ? `, ${photos} uploaded photos copied to the database` : ""}`);
}

if (mongoose.connection.readyState === 1) seedCatalogOnStart().catch(console.error);
else mongoose.connection.once("connected", () => seedCatalogOnStart().catch(console.error));
