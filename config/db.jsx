const mongoose = require("mongoose");

function connectDB() {
  return mongoose
    .connect(process.env.MONGO_URI, { dbName: "lumiere" })
    .then(() => console.log("MongoDB connected"))
    .catch((error) => console.log("MongoDB connection error:", error.message));
}

module.exports = connectDB;
