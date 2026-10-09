const mongoose = require("mongoose");

// A perfume someone liked (the heart button)
const likeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    perfume: { type: String, required: true, index: true },   // perfume slug
  },
  { timestamps: true }
);

likeSchema.index({ user: 1, perfume: 1 }, { unique: true });

module.exports = mongoose.model("Like", likeSchema);
