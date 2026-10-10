const mongoose = require("mongoose");

// A discussion group, e.g. "Woody Lovers"
const groupSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },   // used in URLs: #group/<slug>
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true, unique: true }, // normalized name (no duplicate groups)
    description: { type: String, default: "", trim: true },
    family: { type: String, default: null },                 // scent family it's about (optional)
    source: { type: String, enum: ["builtin", "member"], default: "member" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Group", groupSchema);
