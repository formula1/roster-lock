#!/usr/bin/env node
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Get target triple from rustc
const rustInfo = execSync("rustc -vV").toString();
const targetTripleMatch = /host: (\S+)/g.exec(rustInfo);
if (!targetTripleMatch) {
  console.error("Failed to determine platform target triple");
  process.exit(1);
}
const targetTriple = targetTripleMatch[1];
console.log(`Target triple: ${targetTriple}`);

const isWindows = process.platform === "win32";
const extension = isWindows ? ".exe" : "";

const pkgTargetMap = {
  "x86_64-unknown-linux-gnu": "node22-linux-x64",
  "x86_64-apple-darwin": "node22-macos-x64",
  "aarch64-apple-darwin": "node22-macos-arm64",
  "x86_64-pc-windows-msvc": "node22-win-x64",
};

const pkgTarget = pkgTargetMap[targetTriple];
if (!pkgTarget) {
  console.error(`Unsupported target triple: ${targetTriple}`);
  console.error("Supported targets:", Object.keys(pkgTargetMap).join(", "));
  process.exit(1);
}

const scriptDir = __dirname;
const sidecarRoot = path.dirname(scriptDir);
const distDir = path.join(sidecarRoot, "dist");
const inputFile = path.join(distDir, "index.js");
const bundleFile = path.join(distDir, "bundle.mjs");
const outputDir = path.join(sidecarRoot, "..", "src-tauri", "binaries");
const outputFile = path.join(outputDir, `node-sidecar-${targetTriple}${extension}`);

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

if (!fs.existsSync(inputFile)) {
  console.error(`Input file not found: ${inputFile}`);
  console.error("Run \"npm run build:ts\" first");
  process.exit(1);
}

console.log(`Building sidecar for ${pkgTarget}...`);

(async () => {

  // Step 1: Bundle with esbuild — ESM format supports top-level await
  console.log("Bundling with esbuild...");
  const esbuild = require("esbuild");
  try {
    await esbuild.build({
      entryPoints: [inputFile],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile: bundleFile,
      logLevel: "info",
    });
  } catch (error) {
    console.error("❌ esbuild bundling failed:", error.message);
    process.exit(1);
  }

  // Step 2: Package with pkg
  console.log("Packaging with pkg...");
  try {
    execSync(
      `npx @yao-pkg/pkg "${bundleFile}" --target ${pkgTarget} --output "${outputFile}"`,
      { stdio: "inherit", cwd: sidecarRoot }
    );
    console.log(`✅ Sidecar built successfully: ${outputFile}`);
  } catch (error) {
    console.error("❌ Failed to build sidecar:", error.message);
    process.exit(1);
  }

})();
