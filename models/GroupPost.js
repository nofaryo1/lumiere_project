const mongoose = require("mongoose");

// A post in a group's discussion. Replies are posts with a `parent`.
const groupPostSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "GroupPost", default: null },
    text: { type: String, required: true, trim: true },
    perfume: { type: String, default: null },                 // optional perfume slug it's about
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    likesCount: { type: Number, default: 0 },
    repliesCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

groupPostSchema.index({ group: 1, parent: 1, createdAt: -1 });
groupPostSchema.index({ parent: 1, createdAt: 1 });
groupPostSchema.index({ createdAt: -1 });
groupPostSchema.index({ user: 1 });

module.exports = mongoose.model("GroupPost", groupPostSchema);
