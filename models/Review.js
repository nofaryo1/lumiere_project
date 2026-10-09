const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    perfume: { type: String, required: true, index: true },   // perfume slug
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

// One review per person per perfume (editing replaces it)
reviewSchema.index({ user: 1, perfume: 1 }, { unique: true });

module.exports = mongoose.model("Review", reviewSchema);
