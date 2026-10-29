const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    bio: { type: String, default: "", trim: true },
    seeded: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function () {
  return {
    username: this.username,
    displayName: this.displayName,
    bio: this.bio,
    joinedAt: this.createdAt,
  };
};

module.exports = mongoose.model("User", userSchema);
