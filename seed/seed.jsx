//   npm run seed:community            -> (re)builds the demo community in the "lumiere" database
//   npm run seed:community -- --remove -> removes all demo members and everything they created
//   npm run seed:groups               -> (re)builds demo group activity
//   npm run seed:groups -- --remove   -> removes demo group activity
const mongoose = require("mongoose");
const community = require("./community");
const groups = require("./groups");

const jobs = { community: community.main, groups: groups.main };
const job = jobs[process.argv[2]];

if (!job) {
  console.log("Usage: node dist/seed/seed.js <community|groups> [--remove]");
  process.exitCode = 1;
} else {
  job()
    .catch((err) => { console.error(err); process.exitCode = 1; })
    .finally(() => mongoose.disconnect());
}
