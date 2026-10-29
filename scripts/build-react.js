// Compiles the React components (client/react/**, JSX) into the files the page loads (public/js/react/*.js).
// React and ReactDOM stay globals from /vendor, so JSX compiles to React.createElement.
const path = require("path");
const esbuild = require("esbuild");

const COMPONENTS = ["video-banner", "notes-canvas", "top-reviewers"];
const root = path.join(__dirname, "..");

esbuild.build({
  entryPoints: COMPONENTS.map((name) => ({ in: path.join(root, "client/react", name, "index.jsx"), out: name })),
  outdir: path.join(root, "public/js/react"),
  bundle: true,
  format: "iife",
  target: "es2020",
  jsx: "transform",
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
  logLevel: "info",
}).catch(() => process.exit(1));
