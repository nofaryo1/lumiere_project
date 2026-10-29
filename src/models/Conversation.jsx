const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    // the two members, always stored sorted so each pair has one conversation
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
    key: { type: String, required: true, unique: true },
    lastMessage: {
      text: { type: String, default: "" },
      sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      at: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1, updatedAt: -1 });

conversationSchema.statics.keyFor = (a, b) => [String(a), String(b)].sort().join(":");

module.exports = mongoose.model("Conversation", conversationSchema);
