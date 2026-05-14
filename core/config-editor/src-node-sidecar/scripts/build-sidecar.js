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

// Determine platform-specific settings
const isWindows = process.platform === "win32";
const extension = isWindows ? ".exe" : "";

// Map target triple to pkg target
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

// Paths
const scriptDir = __dirname;
const sidecarRoot = path.dirname(scriptDir);
const distDir = path.join(sidecarRoot, "dist");
const inputFile = path.join(distDir, "index.js");
const bundleFile = path.join(distDir, "bundle.mjs");
const outputDir = path.join(sidecarRoot, "..", "src-tauri", "binaries");
const outputFile = path.join(outputDir, `node-sidecar-${targetTriple}${extension}`);

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Check if input file exists
if (!fs.existsSync(inputFile)) {
  console.error(`Input file not found: ${inputFile}`);
  console.error("Run \"npm run build:ts\" first");
  process.exit(1);
}

console.log(`Building sidecar for ${pkgTarget}...`);
console.log(`Input: ${inputFile}`);
console.log(`Output: ${outputFile}`);

(async () => {

  // Step 1: Bundle with esbuild — produces a single ESM file (ESM supports top-level await)
  console.log("Bundling with esbuild...");
  const esbuild = require("esbuild");

  // webrtc-polyfill/lib/Blob.js uses a top-level await that breaks CJS bundling.
  // globalThis.Blob is always defined in Node 22, so the await branch is dead code —
  // we substitute the file with a synchronous equivalent.
  const webrtcBlobFix = {
    name: "webrtc-polyfill-blob-fix",
    setup(build) {
      build.onLoad({ filter: /webrtc-polyfill[/\\]lib[/\\]Blob\.js$/ }, () => ({
        contents: "const _Blob = globalThis.Blob ?? require(\"node:buffer\").Blob;\nexport default _Blob;\n",
        loader: "js",
      }));
    }
  };

  // Some packages (e.g. webtorrent) declare "exports": {} which blocks normal
  // resolution. This plugin falls back to their "main" field in that case.
  const emptyExportsFallback = {
    name: "empty-exports-fallback",
    setup(build) {
      build.onResolve({ filter: /^[^./]/ }, async (args) => {
        if (args.kind === "entry-point") return undefined;

        let pkgJsonPath;
        try {
          pkgJsonPath = require.resolve(
            path.join(args.path, "package.json"),
            { paths: [args.resolveDir] }
          );
        } catch {
          return undefined;
        }

        let pkgJson;
        try {
          pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
        } catch {
          return undefined;
        }

        const exports = pkgJson.exports;
        if (exports && typeof exports === "object" && Object.keys(exports).length === 0) {
          const mainField = pkgJson.main || "index.js";
          return { path: path.resolve(path.dirname(pkgJsonPath), mainField) };
        }

        return undefined;
      });
    }
  };

  try {
    await esbuild.build({
      entryPoints: [inputFile],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile: bundleFile,
      external: ["*.node", "@aws-sdk/client-s3", "esbuild"],
      plugins: [webrtcBlobFix, emptyExportsFallback],
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
