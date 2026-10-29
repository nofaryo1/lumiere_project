const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const Upload = require("../models/Upload");
const Perfume = require("../models/Perfume");

const { UPLOADS: UPLOAD_DIR } = require("../paths");

const IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const TYPE_OF = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
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

// Saves the photo in the database; every file name is new, so a browser can cache it for good
async function saveImage(slug, req) {
  const type = req.headers["content-type"];
  const file = `${slug}-${Date.now().toString(36)}.${IMAGE_TYPES[type]}`;
  const address = `/uploads/perfumes/${file}`;
  await Upload.create({ path: address, contentType: type, data: req.body });
  return address;
}

async function removeUpload(image) {
  if (!image || !image.startsWith("/uploads/perfumes/")) return;
  await Upload.deleteOne({ path: image }).catch(() => {});
  await fs.unlink(path.join(UPLOAD_DIR, path.basename(image))).catch(() => {});
}

// GET /uploads/perfumes/:file — photos that aren't on this server's disk come from the database
async function serveUpload(req, res, next) {
  try {
    const upload = await Upload.findOne({ path: `/uploads/perfumes/${path.basename(req.params.file)}` });
    if (!upload) return next();
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.type(upload.contentType).send(upload.data);
  } catch (err) {
    next(err);
  }
}

// Photos uploaded before they were kept in the database only exist on one machine's disk.
// On start, copy any such photo found here into the database, so every server can show it.
async function syncUploads() {
  const perfumes = await Perfume.find({ image: /^\/uploads\/perfumes\// }, "image");
  const stored = new Set(await Upload.distinct("path"));
  let copied = 0;
  for (const { image } of perfumes) {
    if (stored.has(image)) continue;
    const ext = path.extname(image).slice(1).toLowerCase();
    if (!TYPE_OF[ext]) continue;
    try {
      const data = await fs.readFile(path.join(UPLOAD_DIR, path.basename(image)));
      await Upload.updateOne({ path: image }, { $setOnInsert: { path: image, contentType: TYPE_OF[ext], data } }, { upsert: true });
      copied++;
    } catch (err) {}
  }
  return copied;
}

module.exports = { UPLOAD_DIR, IMAGE_TYPES, imageBody, looksLikeImage, isImage, saveImage, removeUpload, serveUpload, syncUploads };
