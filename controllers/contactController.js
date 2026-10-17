// Help center: "get back to me" requests
const ContactRequest = require("../models/ContactRequest");
const { text } = require("../lib/helpers");

/* ---------- Help center: "get back to me" requests ---------- */
exports.create = async (req, res) => {
  const name = text(req.body.name, 80);
  const email = text(req.body.email, 120).toLowerCase();
  const message = text(req.body.message, 1000);
  const fields = {};
  if (!name) fields.name = "Please enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = "Please enter a valid email.";
  if (Object.keys(fields).length) return res.status(400).json({ error: "Please fix the highlighted fields.", fields });
  await ContactRequest.create({ name, email, message, user: req.user ? req.user._id : null });
  res.status(201).json({ ok: true });
};
