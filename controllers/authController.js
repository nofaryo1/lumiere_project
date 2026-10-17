// Sign up, log in, log out, and who is signed in
const User = require("../models/User");
const { hashPassword, checkPassword, startSession, endSession } = require("../lib/auth");
const { text, meJSON } = require("../lib/helpers");

exports.signup = async (req, res) => {
  const displayName = text(req.body.displayName, 40);
  const username = text(req.body.username, 40).toLowerCase();
  const email = text(req.body.email, 120).toLowerCase();
  const password = typeof req.body.password === "string" ? req.body.password : "";

  const fields = {};
  if (!displayName) fields.displayName = "Please enter your name.";
  if (!/^[a-z0-9_.]{3,20}$/.test(username)) fields.username = "3–20 characters: letters, numbers, _ or .";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = "Please enter a valid email.";
  if (password.length < 8) fields.password = "At least 8 characters.";
  if (password.length > 200) fields.password = "That password is too long.";
  if (Object.keys(fields).length) return res.status(400).json({ error: "Please fix the highlighted fields.", fields });

  const taken = await User.findOne({ $or: [{ username }, { email }] });
  if (taken) {
    const field = taken.username === username ? "username" : "email";
    return res.status(409).json({
      error: field === "username" ? "That username is taken." : "An account with this email already exists.",
      fields: { [field]: field === "username" ? "Already taken — try another." : "Already registered — log in instead." },
    });
  }

  const user = await User.create({ displayName, username, email, passwordHash: await hashPassword(password) });
  await startSession(res, user);
  res.status(201).json(await meJSON(user));
};

// Compared against when an account doesn't exist, so timing stays the same
const DUMMY_HASH = require("bcryptjs").hashSync("not-a-real-password", 12);

exports.login = async (req, res) => {
  const login = text(req.body.login, 120).toLowerCase();
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const user = login ? await User.findOne({ $or: [{ email: login }, { username: login }] }) : null;
  // Always run bcrypt so response time doesn't reveal which accounts exist
  const ok = await checkPassword(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) return res.status(401).json({ error: "Wrong email/username or password." });
  await startSession(res, user);
  res.json(await meJSON(user));
};

exports.logout = async (req, res) => {
  await endSession(req, res);
  res.json({ ok: true });
};

exports.me = async (req, res) => {
  res.json(req.user ? await meJSON(req.user) : { user: null, likes: [], reviews: [] });
};
