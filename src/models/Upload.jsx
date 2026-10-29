const mongoose = require("mongoose");

// A perfume photo a member uploaded. Kept in the database (not only on the server's disk),
// because the hosting service wipes its disk on every restart and redeploy.
const uploadSchema = new mongoose.Schema(
  {
    path: { type: String, required: true, unique: true }, // the address it is shown at, e.g. /uploads/perfumes/x.jpg
    contentType: { type: String, required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Upload", uploadSchema);
