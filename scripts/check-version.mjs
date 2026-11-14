import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function expect(condition, message) {
  if (!condition) problems.push(message);
}

const pkg = JSON.parse(read("package.json"));
const version = pkg.version;

expect(
  /^\d+\.\d+\.\d+$/.test(version),
  "package.json is not a valid semver: " + version,
);
expect(
  read("CHANGELOG.md").includes("## [" + version + "]"),
  "CHANGELOG.md has no entry for " + version,
);
expect(
  fs.existsSync(path.join(root, "next.config.ts")),
  "next.config.ts is missing",
);
expect(
  read("next.config.ts").includes("NEXT_PUBLIC_APP_VERSION"),
  "next.config.ts does not expose NEXT_PUBLIC_APP_VERSION",
);
expect(
  fs.existsSync(path.join(root, "public", "CNAME")),
  "public/CNAME is missing",
);

if (problems.length) {
  console.error("version check failed:");
  for (const problem of problems) console.error("- " + problem);
  process.exit(1);
}

console.log("version check OK: " + version);
