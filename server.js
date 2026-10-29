const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// behind a hosting proxy (e.g. Render) req.ip must be the visitor, not the proxy
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);

app.use(express.static(path.join(__dirname, "public")));
app.use("/vendor/d3", express.static(path.join(__dirname, "node_modules", "d3", "dist")));
app.use("/vendor/react", express.static(path.join(__dirname, "node_modules", "react", "umd")));
app.use("/vendor/react-dom", express.static(path.join(__dirname, "node_modules", "react-dom", "umd")));
app.use("/vendor/jquery", express.static(path.join(__dirname, "node_modules", "jquery", "dist")));
app.use("/api", require("./routes/api"));
require("./lib/startup");

mongoose
  .connect(process.env.MONGO_URI, { dbName: "lumiere" })
  .then(() => console.log("MongoDB connected"))
  .catch((error) => console.log("MongoDB connection error:", error.message));

app.use(require("./routes/pages"));

const server = require("http").createServer(app);
require("./lib/realtime").attachRealtime(server);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});