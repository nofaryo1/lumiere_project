const path = require("path");
const { VIEWS } = require("../paths");

exports.home = (req, res) => {
  res.sendFile(path.join(VIEWS, "index.html"));
};
