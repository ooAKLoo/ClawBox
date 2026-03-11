/**
 * Post-build smoke test: verify the core runtime chain works.
 *
 * Tests:
 *   1. Bundled runtime exists (node + openclaw binaries)
 *   2. Gateway daemon can start and listen on port
 *   3. API key connectivity (if TEST_API_KEY + TEST_API_BASE_URL are provided)
 *
 * Usage:
 *   node scripts/smoke-test.js
 *
 * Environment variables:
 *   TEST_API_KEY       - API key to test (optional, skips connectivity test if absent)
 *   TEST_API_BASE_URL  - Provider base URL (default: https://api.deepseek.com/v1)
 *   TEST_API_MODEL     - Model name (default: deepseek-chat)
 *   GATEWAY_PORT       - Port for gateway (default: 18789)
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const net = require("net");

const GATEWAY_PORT = parseInt(process.env.GATEWAY_PORT || "18789", 10);
const GATEWAY_TIMEOUT = 30000;
const POLL_INTERVAL = 500;

const RUNTIME_DIR = path.join(__dirname, "..", "runtime");
const isWin = process.platform === "win32";

let exitCode = 0;
let daemonProc = null;

function log(icon, msg) {
  console.log(`  ${icon} ${msg}`);
}

function fail(msg) {
  log("\x1b[31m✗\x1b[0m", msg);
  exitCode = 1;
}

function pass(msg) {
  log("\x1b[32m✓\x1b[0m", msg);
}

function info(msg) {
  log("\x1b[36m·\x1b[0m", msg);
}

/* ── 1. Check bundled runtime ── */
function checkRuntime() {
  console.log("\n[1/3] Checking bundled runtime...\n");

  const nodeBin = isWin
    ? path.join(RUNTIME_DIR, "node", "node.exe")
    : path.join(RUNTIME_DIR, "node", "bin", "node");

  const openclawBin = isWin
    ? path.join(RUNTIME_DIR, "openclaw", "node_modules", ".bin", "openclaw.cmd")
    : path.join(RUNTIME_DIR, "openclaw", "node_modules", ".bin", "openclaw");

  const manifest = path.join(RUNTIME_DIR, "manifest.json");

  let ok = true;
  if (fs.existsSync(nodeBin)) {
    pass(`Node binary: ${nodeBin}`);
  } else {
    fail(`Node binary missing: ${nodeBin}`);
    ok = false;
  }

  if (fs.existsSync(openclawBin)) {
    pass(`OpenClaw binary: ${openclawBin}`);
  } else {
    fail(`OpenClaw binary missing: ${openclawBin}`);
    ok = false;
  }

  if (fs.existsSync(manifest)) {
    const m = JSON.parse(fs.readFileSync(manifest, "utf-8"));
    pass(`Manifest: node=${m.nodeVersion} openclaw=${m.openclawVersion} platform=${m.platform}-${m.arch}`);
  } else {
    fail(`Manifest missing: ${manifest}`);
    ok = false;
  }

  return ok;
}

/* ── 2. Start gateway and check port ── */
function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => resolve(false));
    socket.setTimeout(2000, () => { socket.destroy(); resolve(false); });
  });
}

async function waitForPort(port, token, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(1000),
      });
      // Any HTTP response (even 404) means the server is up
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    }
  }
  return false;
}

function getOpenClawEntry() {
  const nodeBin = isWin
    ? path.join(RUNTIME_DIR, "node", "node.exe")
    : path.join(RUNTIME_DIR, "node", "bin", "node");

  let openclawEntry;
  if (isWin) {
    const pkgJsonPath = path.join(RUNTIME_DIR, "openclaw", "node_modules", "openclaw", "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
    const binEntry = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.openclaw;
    openclawEntry = path.join(path.dirname(pkgJsonPath), binEntry);
  } else {
    const symlinkPath = path.join(RUNTIME_DIR, "openclaw", "node_modules", ".bin", "openclaw");
    openclawEntry = fs.realpathSync(symlinkPath);
  }

  return { nodeBin, openclawEntry };
}

async function testGatewayStart() {
  console.log("\n[2/3] Testing gateway startup...\n");

  const busy = await isPortInUse(GATEWAY_PORT);
  if (busy) {
    fail(`Port ${GATEWAY_PORT} already in use — cannot test gateway`);
    return null;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const { nodeBin, openclawEntry } = getOpenClawEntry();

  // Write minimal openclaw config with token
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const openclawDir = path.join(homeDir, ".openclaw");
  fs.mkdirSync(openclawDir, { recursive: true });
  const configPath = path.join(openclawDir, "openclaw.json");

  // Preserve existing config if present
  let cfg = {};
  if (fs.existsSync(configPath)) {
    try { cfg = JSON.parse(fs.readFileSync(configPath, "utf-8")); } catch { /* */ }
  }
  if (!cfg.gateway) cfg.gateway = {};
  cfg.gateway.auth = { mode: "token", token };
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));

  const args = [
    openclawEntry, "gateway", "run",
    "--port", String(GATEWAY_PORT),
    "--bind", "loopback",
    "--force", "--allow-unconfigured",
    "--auth", "token", "--verbose",
  ];

  info(`Spawning: ${path.basename(nodeBin)} ${args.map(a => path.basename(a)).join(" ")}`);

  const stderrLines = [];
  daemonProc = spawn(nodeBin, args, {
    shell: false,
    env: { ...process.env, OPENCLAW_GATEWAY_TOKEN: token },
  });

  daemonProc.stdout?.on("data", (d) => {
    const line = d.toString().trim();
    if (line) info(`[stdout] ${line}`);
  });
  daemonProc.stderr?.on("data", (d) => {
    const line = d.toString().trim();
    if (line) {
      stderrLines.push(line);
      info(`[stderr] ${line}`);
    }
  });

  let earlyExit = false;
  daemonProc.on("exit", (code) => {
    earlyExit = true;
    if (code !== 0) fail(`Daemon exited early with code ${code}`);
  });

  const reachable = await waitForPort(GATEWAY_PORT, token, GATEWAY_TIMEOUT);

  if (reachable) {
    pass(`Gateway is listening on port ${GATEWAY_PORT}`);
    return token;
  } else if (earlyExit) {
    fail("Daemon process exited before port became reachable");
    if (stderrLines.length) fail(`Last stderr: ${stderrLines.slice(-5).join(" | ")}`);
    return null;
  } else {
    fail(`Gateway did not start within ${GATEWAY_TIMEOUT / 1000}s`);
    if (stderrLines.length) fail(`Last stderr: ${stderrLines.slice(-5).join(" | ")}`);
    return null;
  }
}

/* ── 3. Test API connectivity ── */
async function testApiConnectivity(gatewayToken) {
  console.log("\n[3/3] Testing API key connectivity...\n");

  const apiKey = process.env.TEST_API_KEY;
  if (!apiKey) {
    info("TEST_API_KEY not set — skipping API connectivity test");
    return;
  }

  const baseUrl = process.env.TEST_API_BASE_URL || "https://api.deepseek.com/v1";
  const model = process.env.TEST_API_MODEL || "deepseek-chat";

  info(`Provider: ${baseUrl} / ${model}`);

  try {
    const start = Date.now();
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const latency = Date.now() - start;

    if (res.ok) {
      pass(`API connection successful (${latency}ms)`);
    } else {
      const text = await res.text().catch(() => "");
      fail(`API returned ${res.status}: ${text.slice(0, 200)}`);
    }
  } catch (err) {
    fail(`API connection failed: ${err.message}`);
  }

  // Also test through the gateway if it's running
  if (gatewayToken) {
    info("Testing API through gateway proxy...");
    try {
      const res = await fetch(`http://127.0.0.1:${GATEWAY_PORT}`, {
        headers: { Authorization: `Bearer ${gatewayToken}` },
        signal: AbortSignal.timeout(5000),
      });
      pass(`Gateway proxy responds (HTTP ${res.status})`);
    } catch (err) {
      fail(`Gateway proxy unreachable: ${err.message}`);
    }
  }
}

/* ── Main ── */
async function main() {
  console.log("╔══════════════════════════════════╗");
  console.log("║   ClawBox Post-Build Smoke Test  ║");
  console.log("╚══════════════════════════════════╝");

  const runtimeOk = checkRuntime();
  if (!runtimeOk) {
    console.log("\n⚠ Runtime missing — skipping gateway & API tests\n");
    cleanup();
    process.exit(1);
  }

  const token = await testGatewayStart();
  await testApiConnectivity(token);

  cleanup();

  console.log("\n" + "─".repeat(40));
  if (exitCode === 0) {
    console.log("\x1b[32m  All smoke tests passed!\x1b[0m\n");
  } else {
    console.log("\x1b[31m  Some smoke tests failed!\x1b[0m\n");
  }
  process.exit(exitCode);
}

function cleanup() {
  if (daemonProc) {
    daemonProc.kill();
    daemonProc = null;
  }
}

process.on("SIGINT", () => { cleanup(); process.exit(1); });
process.on("SIGTERM", () => { cleanup(); process.exit(1); });

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  cleanup();
  process.exit(1);
});
