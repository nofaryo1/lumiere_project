const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true, unique: true },
    description: { type: String, default: "", trim: true },
    family: { type: String, default: null },
    source: { type: String, enum: ["builtin", "member"], default: "member" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Group", groupSchema);
