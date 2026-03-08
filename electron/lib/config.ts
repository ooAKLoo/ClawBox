import path from "path";
import fs from "fs";
import { app } from "electron";
import { encryptValue, decryptValue, ENC_PREFIX } from "./security";

export const configDir = path.join(app.getPath("userData"), "clawbox-config");
export const openclawConfigDir = path.join(app.getPath("home"), ".openclaw");
export const openclawConfigPath = path.join(openclawConfigDir, "openclaw.json");

// Ensure config directory exists
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

export function readJsonFile(filename: string) {
  const filepath = path.join(configDir, filename);
  if (fs.existsSync(filepath)) {
    return JSON.parse(fs.readFileSync(filepath, "utf-8"));
  }
  return null;
}

export function writeJsonFile(filename: string, data: unknown) {
  fs.writeFileSync(path.join(configDir, filename), JSON.stringify(data, null, 2));
}

/** Write a JSON config file with specified fields encrypted */
export function writeSecureJsonFile(filename: string, data: Record<string, unknown>, sensitiveKeys: string[]) {
  const clone = JSON.parse(JSON.stringify(data));
  for (const key of sensitiveKeys) {
    if (typeof clone[key] === "string" && clone[key] && !clone[key].startsWith(ENC_PREFIX)) {
      clone[key] = encryptValue(clone[key]);
    }
  }
  writeJsonFile(filename, clone);
}

/** Read a JSON config file and decrypt specified fields */
export function readSecureJsonFile(filename: string, sensitiveKeys: string[]): Record<string, unknown> | null {
  const raw = readJsonFile(filename);
  if (!raw) return null;
  for (const key of sensitiveKeys) {
    if (typeof raw[key] === "string" && raw[key].startsWith(ENC_PREFIX)) {
      raw[key] = decryptValue(raw[key]);
    }
  }
  return raw;
}
