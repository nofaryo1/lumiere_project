require("dotenv").config();
const http = require("http");
const express = require("express");

const connectDB = require("./config/db");
const { PUBLIC } = require("./src/paths");
const { attachRealtime } = require("./src/socket/realtime");

const app = express();
const PORT = process.env.PORT || 3000;

// behind a hosting proxy (e.g. Render) req.ip must be the visitor, not the proxy
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);

app.use(express.static(PUBLIC));
app.use("/api", require("./src/routes/api"));
require("./src/utils/startup");

connectDB();

app.use(require("./src/routes/pages"));

const server = http.createServer(app);
attachRealtime(server);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
