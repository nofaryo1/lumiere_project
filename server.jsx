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

// Photos, fonts and the video rarely change (an uploaded photo never changes: each one gets a new name): browsers may keep them for a week instead of asking again on every page view
const LONG_CACHE = /^\/(images|fonts|videos|uploads)\//;
app.use(express.static(PUBLIC, {
  setHeaders(res) {
    if (LONG_CACHE.test(res.req.path)) res.set("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
  },
}));
app.use("/api", require("./src/routes/api"));
require("./src/utils/startup");

connectDB();

app.use(require("./src/routes/pages"));

const server = http.createServer(app);
attachRealtime(server);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
