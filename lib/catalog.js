// Loads the built-in perfume catalog (data/catalog.js) into MongoDB.
const Perfume = require("../models/Perfume");
const catalog = require("../data/catalog");
const { slugify, nameKey, perfumeKey } = require("./perfumeKey");

async function seedCatalog() {
  const slugs = [];
  const ops = catalog.map(([brand, name, tags, notes]) => {
    const slug = slugify(`${brand} ${name}`);
    slugs.push(slug);
    return {
      updateOne: {
        filter: { slug },
        update: {
          $set: {
            brand, name,
            key: perfumeKey(brand, name),
            nameKey: nameKey(brand, name),
            tags: tags ? tags.split(" ") : [],
            notes: notes ? notes.split(", ") : [],
            image: `/images/perfumes/${slug}.jpg`,
            source: "catalog",
          },
        },
        upsert: true,
      },
    };
  });
  await Perfume.bulkWrite(ops);
  await Perfume.deleteMany({ source: "catalog", slug: { $nin: slugs } });
  return slugs.length;
}

module.exports = { seedCatalog };
