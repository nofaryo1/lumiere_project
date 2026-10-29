const fs = require("fs");
const path = require("path");

// The server runs from the bundle in dist/, so folders are found from the project root
// (the nearest folder with package.json) instead of from __dirname.
function findRoot(dir) {
  if (fs.existsSync(path.join(dir, "package.json"))) return dir;
  const parent = path.dirname(dir);
  return parent === dir ? process.cwd() : findRoot(parent);
}

const ROOT = findRoot(__dirname);

module.exports = {
  ROOT,
  PUBLIC: path.join(ROOT, "public"),
  VIEWS: path.join(ROOT, "views"),
  UPLOADS: path.join(ROOT, "public", "uploads", "perfumes"),
};
