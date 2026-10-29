const express = require("express");
const pages = require("../controllers/pageController");

const router = express.Router();

router.get("/", pages.home);

module.exports = router;
