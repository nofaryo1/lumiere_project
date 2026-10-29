const express = require("express");
const pages = require("../controllers/pageController");
const { serveUpload } = require("../utils/uploads");

const router = express.Router();

router.get("/", pages.home);
router.get("/uploads/perfumes/:file", serveUpload);

module.exports = router;
