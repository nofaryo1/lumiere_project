const express = require("express");
const fs = require("fs/promises");
const path = require("path");

const UPLOAD_DIR = path.join(__dirname, "..", "public", "uploads", "perfumes");

const IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const imageBody = express.raw({ type: Object.keys(IMAGE_TYPES), limit: "5mb" });

function looksLikeImage(buf, type) {
  if (type === "image/jpeg") return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (type === "image/png") return buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === "image/webp") return buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP";
  return false;
}

const isImage = (req) => {
  const type = req.headers["content-type"];
  return Buffer.isBuffer(req.body) && !!IMAGE_TYPES[type] && looksLikeImage(req.body, type);
};

async function saveImage(slug, req) {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const file = `${slug}-${Date.now().toString(36)}.${IMAGE_TYPES[req.headers["content-type"]]}`;
  await fs.writeFile(path.join(UPLOAD_DIR, file), req.body);
  return `/uploads/perfumes/${file}`;
}

const removeUpload = (image) => (image && image.startsWith("/uploads/perfumes/")
  ? fs.unlink(path.join(UPLOAD_DIR, path.basename(image))).catch(() => {}) : Promise.resolve());

module.exports = { UPLOAD_DIR, IMAGE_TYPES, imageBody, looksLikeImage, isImage, saveImage, removeUpload };
