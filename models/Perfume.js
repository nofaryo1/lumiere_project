const mongoose = require("mongoose");

const perfumeSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    brand: { type: String, default: "", trim: true },
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, index: true },
    nameKey: { type: String, required: true, index: true },
    tags: [String],
    notes: [String],
    image: { type: String, default: "" },
    source: { type: String, enum: ["catalog", "community"], default: "community" },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    notesAddedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Perfume", perfumeSchema);
