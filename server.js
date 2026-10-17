const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config();

const app = express();

app.use(express.static(path.join(__dirname, "public")));
app.use("/vendor/d3", express.static(path.join(__dirname, "node_modules", "d3", "dist")));
app.use("/vendor/react", express.static(path.join(__dirname, "node_modules", "react", "umd")));
app.use("/vendor/react-dom", express.static(path.join(__dirname, "node_modules", "react-dom", "umd")));
app.use("/vendor/jquery", express.static(path.join(__dirname, "node_modules", "jquery", "dist")));
app.use("/api", require("./routes/api"));
require("./lib/startup");   // loads the built-in catalog once MongoDB is connected

// חיבור ל-MongoDB
mongoose
  .connect(process.env.MONGO_URI, { dbName: "lumiere" })
  .then(() => console.log("MongoDB connected"))
  .catch((error) => console.log("MongoDB connection error:", error.message));

app.use(require("./routes/pages"));

// HTTP server shared by Express and the live messenger (Socket.io)
const server = require("http").createServer(app);
require("./lib/realtime").attachRealtime(server);

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});