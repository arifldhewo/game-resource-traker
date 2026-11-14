import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "src");
const docsDir = path.join(root, "docs");

function hash(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name !== ".DS_Store")
    .map(entry => entry.name)
    .sort();
}

if (!fs.existsSync(srcDir)) {
  console.error("sync-docs: src/ not found");
  process.exit(1);
}
fs.mkdirSync(docsDir, { recursive: true });

const srcFiles = listFiles(srcDir);
const docsFiles = listFiles(docsDir);
const extra = docsFiles.filter(name => !srcFiles.includes(name));

for (const name of srcFiles) {
  const from = path.join(srcDir, name);
  const to = path.join(docsDir, name);
  fs.copyFileSync(from, to);
  if (hash(from) !== hash(to)) {
    console.error("sync-docs: hash mismatch for " + name);
    process.exit(1);
  }
}

if (extra.length) {
  console.warn("sync-docs: extra files in docs/ (left untouched): " + extra.join(", "));
}

console.log("Synced " + srcFiles.length + " files from src/ to docs/.");
