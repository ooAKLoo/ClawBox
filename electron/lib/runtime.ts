import path from "path";
import fs from "fs";
import { app } from "electron";
import { spawn } from "child_process";

const isDev = !app.isPackaged;

export interface RuntimePaths {
  nodeBin: string;
  openclawBin: string;
  runtimeDir: string;
}

export function getBundledRuntimeDir(): string {
  if (isDev) {
    // __dirname is dist-electron/ after bundling (vite-plugin-electron bundles into single file)
    return path.join(__dirname, "..", "runtime");
  }
  return path.join(process.resourcesPath, "runtime");
}

export function getRuntimePaths(): RuntimePaths {
  const runtimeDir = getBundledRuntimeDir();
  const isWin = process.platform === "win32";

  return {
    nodeBin: isWin
      ? path.join(runtimeDir, "node", "node.exe")
      : path.join(runtimeDir, "node", "bin", "node"),
    openclawBin: isWin
      ? path.join(runtimeDir, "openclaw", "node_modules", ".bin", "openclaw.cmd")
      : path.join(runtimeDir, "openclaw", "node_modules", ".bin", "openclaw"),
    runtimeDir,
  };
}

export function getOpenClawCommand(): { cmd: string; args: string[]; env: NodeJS.ProcessEnv } {
  const paths = getRuntimePaths();
  const hasBundled = fs.existsSync(paths.nodeBin) && fs.existsSync(paths.openclawBin);

  if (hasBundled) {
    let openclawEntry: string;

    if (process.platform === "win32") {
      // Windows: .cmd is a batch wrapper, not a symlink — resolve JS entry from package.json
      const pkgJsonPath = path.join(paths.runtimeDir, "openclaw", "node_modules", "openclaw", "package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
      const binEntry = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.openclaw;
      openclawEntry = path.join(path.dirname(pkgJsonPath), binEntry);
    } else {
      openclawEntry = fs.realpathSync(paths.openclawBin);
    }

    return {
      cmd: paths.nodeBin,
      args: [openclawEntry],
      env: { ...process.env },
    };
  }

  // Fallback for dev mode without bundled runtime: use global openclaw
  return {
    cmd: "openclaw",
    args: [],
    env: { ...process.env },
  };
}

export function detectBundledRuntime(): {
  available: boolean;
  nodeVersion: string | null;
  openclawVersion: string | null;
  manifest: Record<string, string> | null;
} {
  const paths = getRuntimePaths();
  const nodeExists = fs.existsSync(paths.nodeBin);
  const openclawExists = fs.existsSync(paths.openclawBin);

  let manifest = null;
  const manifestPath = path.join(paths.runtimeDir, "manifest.json");
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    } catch { /* ignore */ }
  }

  return {
    available: nodeExists && openclawExists,
    nodeVersion: manifest?.nodeVersion ?? null,
    openclawVersion: manifest?.openclawVersion ?? null,
    manifest,
  };
}

export function runShell(cmd: string, args: string[], useShell = true): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { shell: useShell });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => resolve({ code: code ?? 1, stdout: stdout.trim(), stderr: stderr.trim() }));
    proc.on("error", () => resolve({ code: 1, stdout: "", stderr: "spawn error" }));
  });
}

export function runOpenClaw(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const { cmd, args: baseArgs } = getOpenClawCommand();
  return runShell(cmd, [...baseArgs, ...args], false);
}
