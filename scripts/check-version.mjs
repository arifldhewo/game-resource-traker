import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function hash(relative) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, relative))).digest("hex");
}

function expect(condition, message) {
  if (!condition) problems.push(message);
}

const version = JSON.parse(read("version.json")).version;
const pkgVersion = JSON.parse(read("package.json")).version;
const runtimeMatch = /var v = "([^"]+)"/.exec(read("src/version.js"));
const runtimeVersion = runtimeMatch ? runtimeMatch[1] : "(not found)";

expect(/^\d+\.\d+\.\d+$/.test(version), "version.json is not a valid semver: " + version);
expect(pkgVersion === version, "package.json version " + pkgVersion + " != version.json " + version);
expect(runtimeVersion === version, "src/version.js version " + runtimeVersion + " != version.json " + version);
expect(read("CHANGELOG.md").includes("## [" + version + "]"), "CHANGELOG.md has no entry for " + version);

if (fs.existsSync(path.join(root, "docs", "version.js"))) {
  expect(hash("docs/version.js") === hash("src/version.js"), "docs/version.js is not in sync with src/version.js");
} else {
  problems.push("docs/version.js is missing");
}

const htmlFiles = fs.readdirSync(path.join(root, "src"))
  .filter(name => name.endsWith(".html"))
  .sort();

for (const name of htmlFiles) {
  const html = read("src/" + name);
  expect(html.includes('src="version.js"'), name + " does not load version.js");
  expect(!/v\d+\.\d+\.\d+/.test(html), name + " contains a hardcoded version");
  expect(html.includes("data-app-version"), name + " has no [data-app-version] target");
}

if (problems.length) {
  console.error("version check failed:");
  for (const problem of problems) console.error("- " + problem);
  process.exit(1);
}

console.log("version check OK: " + version);
