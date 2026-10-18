// REST API (mounted at /api): each URL is handled by a controller in controllers/
const express = require("express");
const { loadUser, requireUser, sameOrigin, rateLimit } = require("../lib/auth");
const { imageBody } = require("../lib/uploads");
const auth = require("../controllers/authController");
const users = require("../controllers/userController");
const perfumes = require("../controllers/perfumeController");
const reviews = require("../controllers/reviewController");
const groups = require("../controllers/groupController");
const messages = require("../controllers/messageController");
const stats = require("../controllers/statsController");
const contact = require("../controllers/contactController");

const router = express.Router();

router.use(express.json({ limit: "20kb" }));
router.use(sameOrigin);
router.use(loadUser);

const authLimiter = rateLimit({ max: 20, windowMs: 15 * 60 * 1000 });
const contactLimiter = rateLimit({ max: 5, windowMs: 15 * 60 * 1000 });

router.post("/auth/signup", authLimiter, auth.signup);
router.post("/auth/login", authLimiter, auth.login);
router.post("/auth/logout", auth.logout);
router.get("/auth/me", auth.me);
router.get("/users/:username", users.profile);
router.patch("/users/me", requireUser, users.updateMe);
router.delete("/users/me", requireUser, users.deleteMe);
router.get("/perfumes", perfumes.list);
router.get("/perfumes/check", perfumes.check);
router.post("/perfumes", requireUser, imageBody, perfumes.create);
router.patch("/perfumes/:slug", requireUser, perfumes.update);
router.delete("/perfumes/:slug", requireUser, perfumes.remove);
router.put("/perfumes/:slug/image", requireUser, imageBody, perfumes.updateImage);
router.get("/perfumes/:slug/performance", perfumes.performance);
router.put("/perfumes/:slug/performance", requireUser, perfumes.votePerformance);
router.put("/perfumes/:slug/wear", requireUser, perfumes.voteWear);
router.put("/perfumes/:slug/agree", requireUser, perfumes.voteAgree);
router.put("/perfumes/:slug/notes", requireUser, perfumes.updateNotes);
router.get("/perfumes/:slug/reviews", reviews.forPerfume);
router.post("/perfumes/:slug/reviews", requireUser, reviews.create);
router.put("/reviews/:id", requireUser, reviews.update);
router.delete("/reviews/:id", requireUser, reviews.remove);
router.put("/perfumes/:slug/like", requireUser, perfumes.like);
router.delete("/perfumes/:slug/like", requireUser, perfumes.unlike);
router.get("/reviews", reviews.list);
router.put("/reviews/:id/like", requireUser, reviews.markHelpful);
router.delete("/reviews/:id/like", requireUser, reviews.unmarkHelpful);
router.put("/users/:username/follow", requireUser, users.follow);
router.delete("/users/:username/follow", requireUser, users.unfollow);
router.get("/users/:username/followers", users.followers);
router.get("/users/:username/following", users.following);
router.get("/members", users.search);
router.get("/members/top", users.top);
router.get("/members/all", users.directory);
router.get("/activity", users.activity);
router.get("/groups", groups.list);
router.get("/groups/check", groups.check);
router.post("/groups", requireUser, groups.create);
router.get("/groups/:slug", groups.show);
router.patch("/groups/:slug", requireUser, groups.update);
router.delete("/groups/:slug", requireUser, groups.remove);
router.put("/groups/:slug/membership", requireUser, groups.join);
router.delete("/groups/:slug/membership", requireUser, groups.leave);
router.get("/groups/:slug/members", groups.members);
router.get("/groups/:slug/posts", groups.posts);
router.get("/groups/:slug/posts/:id/replies", groups.replies);
router.post("/groups/:slug/posts", requireUser, groups.createPost);
router.patch("/group-posts/:id", requireUser, groups.updatePost);
router.delete("/group-posts/:id", requireUser, groups.deletePost);
router.put("/group-posts/:id/like", requireUser, groups.likePost);
router.delete("/group-posts/:id/like", requireUser, groups.unlikePost);
router.get("/stats/group-posts", stats.groupPosts);
router.get("/conversations", requireUser, messages.conversations);
router.post("/conversations", requireUser, messages.open);
router.get("/conversations/:id/messages", requireUser, messages.messages);
router.get("/messages/unread", requireUser, messages.unread);
router.get("/stats/review-trends", stats.reviewTrends);
router.post("/contact", contactLimiter, contact.create);

/* ---------- Fallbacks ---------- */
router.use((req, res) => res.status(404).json({ error: "Not found." }));

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err.type === "entity.too.large") return res.status(413).json({ error: "That file is too large (max 5 MB)." });
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid request." });
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

module.exports = router;
