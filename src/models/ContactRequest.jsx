const mongoose = require("mongoose");

const contactRequestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    message: { type: String, default: "", trim: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    handled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ContactRequest", contactRequestSchema);
