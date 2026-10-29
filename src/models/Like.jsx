const mongoose = require("mongoose");

const likeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    perfume: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

likeSchema.index({ user: 1, perfume: 1 }, { unique: true });
likeSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Like", likeSchema);
