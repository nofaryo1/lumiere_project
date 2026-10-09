const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config();

const app = express();

app.use(express.static(path.join(__dirname, "public")));
app.use("/api", require("./routes/api"));

// חיבור ל-MongoDB
mongoose
  .connect(process.env.MONGO_URI, { dbName: "lumiere" })
  .then(() => console.log("MongoDB connected"))
  .catch((error) => console.log("MongoDB connection error:", error.message));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "home.html"));
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});