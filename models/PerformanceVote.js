const mongoose = require("mongoose");

const level = { type: Number, min: 1, max: 5, default: null };

const performanceVoteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    perfume: { type: String, required: true, index: true },
    longevity: level,
    sillage: level,
    value: level,
    wear: [{ type: String, enum: ["Spring", "Summer", "Fall", "Winter", "Day", "Night"] }],
    agree: [{ type: String, maxlength: 200 }],
  },
  { timestamps: true }
);

performanceVoteSchema.index({ user: 1, perfume: 1 }, { unique: true });

module.exports = mongoose.model("PerformanceVote", performanceVoteSchema);
