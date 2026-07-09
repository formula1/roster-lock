// Bundles the compiled dist/index.js (and its workspace/node_modules deps) into a
// single CJS file, so `pkg` can package it into a standalone binary without needing
// to resolve pnpm's symlinked node_modules layout itself.
const esbuild = require("esbuild");
const { join } = require("node:path");

esbuild.buildSync({
  entryPoints: [join(__dirname, "..", "dist", "index.js")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: join(__dirname, "..", "pkg-build", "bundle.cjs"),
});

console.log("Bundled to pkg-build/bundle.cjs");
