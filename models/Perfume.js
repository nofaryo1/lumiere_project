const mongoose = require("mongoose");

const perfumeSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },    // used in URLs: #perfume/<slug>
    brand: { type: String, default: "", trim: true },
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, index: true },      // normalized "brand name" for duplicate checks
    nameKey: { type: String, required: true, index: true },  // normalized name only
    tags: [String],                                           // scent families
    notes: [String],                                          // main notes
    image: { type: String, default: "" },
    source: { type: String, enum: ["catalog", "community"], default: "community" },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    notesAddedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },   // member who added the notes
  },
  { timestamps: true }
);

module.exports = mongoose.model("Perfume", perfumeSchema);
