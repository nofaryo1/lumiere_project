// Login sessions: a random token in an httpOnly cookie, stored hashed in MongoDB.
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const Session = require("../models/Session");
const User = require("../models/User");

const COOKIE = "lumiere_session";
const SESSION_DAYS = 30;

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

const hashPassword = (password) => bcrypt.hash(password, 12);
const checkPassword = (password, hash) => bcrypt.compare(password, hash);

function readCookie(req, name) {
  return cookieFrom(req.headers.cookie, name);
}

function cookieFrom(header = "", name) {
  for (const part of String(header).split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

async function startSession(res, user) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await Session.create({ tokenHash: sha256(token), user: user._id, expiresAt });
  res.cookie(COOKIE, token, { ...cookieOptions(), expires: expiresAt });
}

async function endSession(req, res) {
  const token = readCookie(req, COOKIE);
  if (token) await Session.deleteOne({ tokenHash: sha256(token) });
  res.clearCookie(COOKIE, cookieOptions());
}

// The signed-in user for a Cookie header (used by the API and the live chat connection)
async function userFromCookieHeader(header) {
  const token = cookieFrom(header, COOKIE);
  if (!token) return null;
  const session = await Session.findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } });
  return session ? User.findById(session.user) : null;
}

// Attaches req.user when the browser has a valid session
async function loadUser(req, res, next) {
  req.user = await userFromCookieHeader(req.headers.cookie);
  next();
}

function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Please log in first." });
  next();
}

// Mutating requests must come from this site (extra CSRF protection on top of SameSite cookies)
function sameOrigin(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin && new URL(origin).host !== req.headers.host) {
    return res.status(403).json({ error: "Request blocked." });
  }
  next();
}

// Small in-memory limiter for login / sign-up attempts
function rateLimit({ max, windowMs }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    const entry = hits.get(key);
    if (!entry || entry.reset < now) {
      hits.set(key, { count: 1, reset: now + windowMs });
      return next();
    }
    if (++entry.count > max) {
      return res.status(429).json({ error: "Too many attempts. Please wait a few minutes and try again." });
    }
    next();
  };
}

module.exports = {
  hashPassword, checkPassword, startSession, endSession,
  loadUser, requireUser, sameOrigin, rateLimit, userFromCookieHeader,
};
