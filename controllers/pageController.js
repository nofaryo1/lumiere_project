// Pages: the site is a single HTML view (views/home.html); public/js/main.js draws each page in the browser
const path = require("path");

exports.home = (req, res) => {
  res.sendFile(path.join(__dirname, "..", "views", "home.html"));
};
