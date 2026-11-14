import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const versionFile = path.join(root, "version.json");
const packageFile = path.join(root, "package.json");
const runtimeFile = path.join(root, "src", "version.js");
const changelogFile = path.join(root, "CHANGELOG.md");
const syncScript = path.join(root, "scripts", "sync-docs.mjs");

const args = process.argv.slice(2);
const kind = args[0];
const noteIndex = args.indexOf("--note");
const note = noteIndex >= 0 ? args[noteIndex + 1] : "";

if (!kind || kind === "--help" || kind === "-h") {
  console.log("Usage: node scripts/bump-version.mjs <patch|minor|major|x.y.z> [--note \"change\"]");
  process.exit(kind ? 0 : 1);
}
if (noteIndex >= 0 && !note) fail("--note requires a value");

function fail(message) {
  console.error("bump-version: " + message);
  process.exit(1);
}

function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) fail("invalid version: " + value);
  return match.slice(1).map(Number);
}

function nextVersion(current, bump) {
  if (/^\d+\.\d+\.\d+$/.test(bump)) return bump;
  const [major, minor, patch] = parseVersion(current);
  if (bump === "major") return (major + 1) + ".0.0";
  if (bump === "minor") return major + "." + (minor + 1) + ".0";
  if (bump === "patch") return major + "." + minor + "." + (patch + 1);
  fail("bump must be patch, minor, major, or an exact x.y.z");
}

function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
}

const current = JSON.parse(fs.readFileSync(versionFile, "utf8")).version;
parseVersion(current);
const next = nextVersion(current, kind);
parseVersion(next);
if (compareVersions(next, current) <= 0) fail("next version must be greater than " + current + ": " + next);

const runtime = `(function(){
  var v = "${next}";
  window.PRTS_VERSION = v;
  function paint(){
    var nodes = document.querySelectorAll("[data-app-version]");
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = "v" + v;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", paint);
  else paint();
})();
`;

fs.writeFileSync(versionFile, JSON.stringify({ version: next }, null, 2) + "\n");
fs.writeFileSync(runtimeFile, runtime);

const pkg = JSON.parse(fs.readFileSync(packageFile, "utf8"));
pkg.version = next;
fs.writeFileSync(packageFile, JSON.stringify(pkg, null, 2) + "\n");

if (note) {
  const date = new Date().toISOString().slice(0, 10);
  let changelog = fs.readFileSync(changelogFile, "utf8");
  if (changelog.includes("## [" + next + "]")) {
    console.log("changelog: " + next + " already present, skipping insert");
  } else {
    const marker = "## [Unreleased]\n\n";
    if (!changelog.includes(marker)) fail("CHANGELOG.md is missing the '## [Unreleased]' section");
    const entry = "## [" + next + "] - " + date + "\n\n### Changed\n\n- " + note + "\n\n";
    changelog = changelog.replace(marker, marker + entry);
    fs.writeFileSync(changelogFile, changelog);
  }
} else {
  console.warn("changelog: no --note supplied; add the entry manually");
}

const sync = spawnSync(process.execPath, [syncScript], { stdio: "inherit" });
if (sync.status !== 0) process.exit(sync.status || 1);

console.log("\nBumped " + current + " -> " + next);
console.log("Next: git add -A && git commit && git tag -a v" + next + " -m \"v" + next + "\" && git push origin master --tags");
