/**
 * Patch @electron/osx-sign walker to avoid EMFILE on large resource trees.
 *
 * Root cause:
 *   walkAsync() recursively scans app contents with Promise.all over every
 *   directory entry, which can exhaust file descriptors on GitHub macOS runners.
 *
 * Strategy:
 *   Rewrite walkAsync() to sequential traversal for both CJS/ESM builds.
 */

const fs = require("fs");
const path = require("path");

const PATCH_MARKER = "clawbox-emfile-patch";

const targets = [
  path.join(__dirname, "..", "node_modules", "@electron", "osx-sign", "dist", "cjs", "util.js"),
  path.join(__dirname, "..", "node_modules", "@electron", "osx-sign", "dist", "esm", "util.js"),
];

function patchCjs(content) {
  if (content.includes(PATCH_MARKER)) {
    return { changed: false, content };
  }

  const pattern = /async function walkAsync\(dirPath\) \{[\s\S]*?return compactFlattenedList\(allPaths\);\n\}/;
  const replacement = `async function walkAsync(dirPath) {
    // ${PATCH_MARKER}
    (0, exports.debugLog)('Walking... ' + dirPath);
    async function _walkSequential(currentDirPath) {
        const children = await fs.readdir(currentDirPath);
        const collected = [];
        for (const child of children) {
            const filePath = path.resolve(currentDirPath, child);
            const stat = await fs.stat(filePath);
            if (stat.isFile()) {
                switch (path.extname(filePath)) {
                    case '.cstemp':
                        (0, exports.debugLog)('Removing... ' + filePath);
                        await fs.remove(filePath);
                        break;
                    default:
                        collected.push(await getFilePathIfBinary(filePath));
                        break;
                }
            }
            else if (stat.isDirectory() && !stat.isSymbolicLink()) {
                const walkResult = await _walkSequential(filePath);
                switch (path.extname(filePath)) {
                    case '.app':
                    case '.framework':
                        walkResult.push(filePath);
                }
                collected.push(walkResult);
            }
        }
        return compactFlattenedList(collected);
    }
    return await _walkSequential(dirPath);
}`;

  if (!pattern.test(content)) {
    throw new Error("CJS walkAsync block not found");
  }

  return { changed: true, content: content.replace(pattern, replacement) };
}

function patchEsm(content) {
  if (content.includes(PATCH_MARKER)) {
    return { changed: false, content };
  }

  const pattern = /export async function walkAsync\(dirPath\) \{[\s\S]*?return compactFlattenedList\(allPaths\);\n\}/;
  const replacement = `export async function walkAsync(dirPath) {
    // ${PATCH_MARKER}
    debugLog('Walking... ' + dirPath);
    async function _walkSequential(currentDirPath) {
        const children = await fs.readdir(currentDirPath);
        const collected = [];
        for (const child of children) {
            const filePath = path.resolve(currentDirPath, child);
            const stat = await fs.stat(filePath);
            if (stat.isFile()) {
                switch (path.extname(filePath)) {
                    case '.cstemp':
                        debugLog('Removing... ' + filePath);
                        await fs.remove(filePath);
                        break;
                    default:
                        collected.push(await getFilePathIfBinary(filePath));
                        break;
                }
            }
            else if (stat.isDirectory() && !stat.isSymbolicLink()) {
                const walkResult = await _walkSequential(filePath);
                switch (path.extname(filePath)) {
                    case '.app':
                    case '.framework':
                        walkResult.push(filePath);
                }
                collected.push(walkResult);
            }
        }
        return compactFlattenedList(collected);
    }
    return await _walkSequential(dirPath);
}`;

  if (!pattern.test(content)) {
    throw new Error("ESM walkAsync block not found");
  }

  return { changed: true, content: content.replace(pattern, replacement) };
}

function patchFile(target) {
  if (!fs.existsSync(target)) {
    return { target, status: "missing" };
  }

  const original = fs.readFileSync(target, "utf8");
  const result = target.includes(`${path.sep}cjs${path.sep}`)
    ? patchCjs(original)
    : patchEsm(original);

  if (result.changed) {
    fs.writeFileSync(target, result.content, "utf8");
    return { target, status: "patched" };
  }

  return { target, status: "already-patched" };
}

function main() {
  const outcomes = targets.map(patchFile);
  for (const outcome of outcomes) {
    console.log(`[patch-osx-sign] ${outcome.status}: ${outcome.target}`);
  }
}

main();
