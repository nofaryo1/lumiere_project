const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    perfume: { type: String, required: true, index: true },   // perfume slug
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, required: true, trim: true },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],   // "helpful" votes
    likesCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// A member can review the same perfume more than once (not unique)
reviewSchema.index({ user: 1, perfume: 1 });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ likesCount: -1, createdAt: -1 });

module.exports = mongoose.model("Review", reviewSchema);
