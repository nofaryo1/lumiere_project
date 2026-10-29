const mongoose = require("mongoose");

const groupMemberSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

groupMemberSchema.index({ group: 1, user: 1 }, { unique: true });
groupMemberSchema.index({ user: 1 });
groupMemberSchema.index({ createdAt: -1 });

module.exports = mongoose.model("GroupMember", groupMemberSchema);
