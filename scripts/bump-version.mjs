import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packageFile = path.join(root, "package.json");
const changelogFile = path.join(root, "CHANGELOG.md");

const args = process.argv.slice(2);
const kind = args[0];
const noteIndex = args.indexOf("--note");
const note = noteIndex >= 0 ? args[noteIndex + 1] : "";

if (!kind || kind === "--help" || kind === "-h") {
  console.log(
    'Usage: node scripts/bump-version.mjs <patch|minor|major|x.y.z> [--note "change"]',
  );
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
  if (bump === "major") return major + 1 + ".0.0";
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

const pkg = JSON.parse(fs.readFileSync(packageFile, "utf8"));
const current = pkg.version;
parseVersion(current);
const next = nextVersion(current, kind);
parseVersion(next);
if (compareVersions(next, current) <= 0) {
  fail("next version must be greater than " + current + ": " + next);
}

pkg.version = next;
fs.writeFileSync(packageFile, JSON.stringify(pkg, null, 2) + "\n");

if (note) {
  const date = new Date().toISOString().slice(0, 10);
  let changelog = fs.readFileSync(changelogFile, "utf8");
  if (changelog.includes("## [" + next + "]")) {
    console.log("changelog: " + next + " already present, skipping insert");
  } else {
    const marker = "## [Unreleased]\n\n";
    if (!changelog.includes(marker)) {
      fail("CHANGELOG.md is missing the '## [Unreleased]' section");
    }
    const entry =
      "## [" + next + "] - " + date + "\n\n### Changed\n\n- " + note + "\n\n";
    changelog = changelog.replace(marker, marker + entry);
    fs.writeFileSync(changelogFile, changelog);
  }
} else {
  console.warn("changelog: no --note supplied; add the entry manually");
}

console.log("\nBumped " + current + " -> " + next);
console.log("\nNext:");
console.log('  git add -A && git commit -m "chore(release): v' + next + '"');
console.log('  git tag -a v' + next + ' -m "v' + next + '"');
console.log("  git push origin HEAD");
console.log("  git push origin v" + next);
console.log(
  "\nThe v" + next + " tag triggers the Pages deploy (master pushes do not).",
);
console.log(
  "Note: NEXT_PUBLIC_APP_VERSION is injected from package.json at build time.",
);
