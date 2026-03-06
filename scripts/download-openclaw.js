/**
 * CI / local build script: download platform-specific Node.js runtime
 * and install openclaw into runtime/ directory.
 *
 * Usage: node scripts/download-openclaw.js
 *
 * Environment variables:
 *   OPENCLAW_VERSION  - openclaw npm version (default: "latest")
 *   NODE_VERSION      - Node.js version to bundle (default: "22.17.0")
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const https = require("https");
const { createWriteStream } = require("fs");
const { pipeline } = require("stream/promises");

const OPENCLAW_VERSION = process.env.OPENCLAW_VERSION || "latest";
const NODE_VERSION = process.env.NODE_VERSION || "22.17.0";

const RUNTIME_DIR = path.join(__dirname, "..", "runtime");
const NODE_DIR = path.join(RUNTIME_DIR, "node");
const OPENCLAW_DIR = path.join(RUNTIME_DIR, "openclaw");

function getPlatformArch() {
  const platform = process.platform; // darwin | win32 | linux
  const arch = process.arch; // arm64 | x64
  return { platform, arch };
}

function getNodeDownloadUrl() {
  const { platform, arch } = getPlatformArch();
  const ext = platform === "win32" ? "zip" : "tar.gz";
  let os = platform;
  if (platform === "darwin") os = "darwin";
  if (platform === "win32") os = "win";

  const filename = `node-v${NODE_VERSION}-${os}-${arch}`;
  return {
    url: `https://nodejs.org/dist/v${NODE_VERSION}/${filename}.${ext}`,
    filename,
    ext,
  };
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (url) => {
      https.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: ${res.statusCode} ${url}`));
          return;
        }
        const file = createWriteStream(dest);
        pipeline(res, file).then(resolve).catch(reject);
      }).on("error", reject);
    };
    follow(url);
  });
}

async function main() {
  console.log("=== ClawBox Runtime Bundler ===");
  console.log(`Platform: ${process.platform}-${process.arch}`);
  console.log(`Node.js version to bundle: ${NODE_VERSION}`);
  console.log(`OpenClaw version: ${OPENCLAW_VERSION}`);
  console.log();

  // Clean previous runtime
  if (fs.existsSync(RUNTIME_DIR)) {
    fs.rmSync(RUNTIME_DIR, { recursive: true });
  }
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  fs.mkdirSync(NODE_DIR, { recursive: true });

  // Step 1: Download Node.js
  const { url, filename, ext } = getNodeDownloadUrl();
  const archivePath = path.join(RUNTIME_DIR, `node.${ext}`);

  console.log(`[1/3] Downloading Node.js from ${url}`);
  await download(url, archivePath);
  console.log("      Downloaded.");

  // Step 2: Extract Node.js - we only need the node binary
  console.log("[2/3] Extracting Node.js runtime...");

  if (ext === "tar.gz") {
    // Extract just the bin/node binary
    execSync(
      `tar -xzf "${archivePath}" -C "${NODE_DIR}" --strip-components=1 "${filename}/bin/node"`,
      { stdio: "inherit" }
    );
    // Also extract lib/node_modules/npm for npm usage during openclaw install
    try {
      execSync(
        `tar -xzf "${archivePath}" -C "${NODE_DIR}" --strip-components=1 "${filename}/bin/npm" "${filename}/bin/npx" "${filename}/lib"`,
        { stdio: "inherit" }
      );
    } catch {
      console.log("      Warning: Could not extract npm, will use system npm for openclaw install");
    }
  } else {
    // Windows zip
    execSync(
      `powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${RUNTIME_DIR}' -Force"`,
      { stdio: "inherit" }
    );
    // Move contents up from nested dir
    const nestedDir = path.join(RUNTIME_DIR, filename);
    if (fs.existsSync(nestedDir)) {
      // Copy node.exe
      fs.cpSync(path.join(nestedDir, "node.exe"), path.join(NODE_DIR, "node.exe"));
      // Copy npm
      if (fs.existsSync(path.join(nestedDir, "npm.cmd"))) {
        fs.cpSync(path.join(nestedDir, "npm.cmd"), path.join(NODE_DIR, "npm.cmd"));
        fs.cpSync(path.join(nestedDir, "npx.cmd"), path.join(NODE_DIR, "npx.cmd"));
        fs.cpSync(path.join(nestedDir, "node_modules"), path.join(NODE_DIR, "node_modules"), { recursive: true });
      }
      fs.rmSync(nestedDir, { recursive: true });
    }
  }

  // Clean up archive
  fs.unlinkSync(archivePath);
  console.log("      Extracted.");

  // Step 3: Install openclaw using the bundled or system node
  console.log(`[3/3] Installing openclaw@${OPENCLAW_VERSION}...`);

  const bundledNode = process.platform === "win32"
    ? path.join(NODE_DIR, "node.exe")
    : path.join(NODE_DIR, "bin", "node");

  // Use system npm with bundled node to install openclaw into OPENCLAW_DIR
  fs.mkdirSync(OPENCLAW_DIR, { recursive: true });

  // Initialize a minimal package.json so npm install works in the dir
  fs.writeFileSync(
    path.join(OPENCLAW_DIR, "package.json"),
    JSON.stringify({ name: "clawbox-openclaw-runtime", private: true }, null, 2)
  );

  execSync(
    `npm install openclaw@${OPENCLAW_VERSION} --prefix "${OPENCLAW_DIR}"`,
    { stdio: "inherit", env: { ...process.env, PATH: process.env.PATH } }
  );

  // Verify the openclaw binary exists
  const openclawBin = process.platform === "win32"
    ? path.join(OPENCLAW_DIR, "node_modules", ".bin", "openclaw.cmd")
    : path.join(OPENCLAW_DIR, "node_modules", ".bin", "openclaw");

  if (!fs.existsSync(openclawBin)) {
    console.error("ERROR: openclaw binary not found after install!");
    process.exit(1);
  }

  // Write a manifest for the app to read at runtime
  const manifest = {
    nodeVersion: NODE_VERSION,
    openclawVersion: OPENCLAW_VERSION,
    platform: process.platform,
    arch: process.arch,
    builtAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(RUNTIME_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );

  console.log();
  console.log("=== Runtime bundle complete ===");
  console.log(`  Node:     ${bundledNode}`);
  console.log(`  OpenClaw: ${openclawBin}`);
  console.log(`  Manifest: ${path.join(RUNTIME_DIR, "manifest.json")}`);
}

main().catch((err) => {
  console.error("Failed to prepare runtime:", err);
  process.exit(1);
});
