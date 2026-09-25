import "dotenv/config";
import { parse } from "dotenv";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// Reports file names only, never matching values or source lines.
const failures = new Set<string>();
const names = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "ADMIN_TOKEN",
  "DEMO_SESSION_SECRET",
];
const secrets = names
  .map((name) => process.env[name])
  .filter((v): v is string => !!v);
const tracked = execFileSync("git", ["ls-files", "-z"])
  .toString()
  .split("\0")
  .filter(Boolean);
const candidates = execFileSync("git", [
  "ls-files",
  "--cached",
  "--others",
  "--exclude-standard",
  "-z",
])
  .toString()
  .split("\0")
  .filter(Boolean);
function scan(file: string, data: Buffer) {
  if (
    secrets.some((secret) => data.includes(Buffer.from(secret))) ||
    /\bsk-[A-Za-z0-9_-]{32,}\b/.test(data.toString())
  )
    failures.add(file);
}
for (const file of new Set(candidates)) {
  if (existsSync(file)) scan(file, readFileSync(file));
}
// Scan the index too: editing a working file cannot hide a previously staged secret.
for (const file of tracked) {
  if (
    path.basename(file).startsWith(".env") &&
    path.basename(file) !== ".env.example"
  )
    failures.add(file);
  scan(`index:${file}`, execFileSync("git", ["show", `:${file}`]));
}
function scanTree(dir: string) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) scanTree(file);
    else scan(file, readFileSync(file));
  }
}
scanTree("dist/client");
const example = parse(readFileSync(".env.example"));
for (const name of names) {
  if (example[name]?.trim())
    failures.add(".env.example (credential must remain blank)");
}
for (const file of [
  ".env",
  ".env.local",
  ".env.production",
  ".env.secret",
  "evals/runs/check-live.json",
]) {
  try {
    execFileSync("git", ["check-ignore", "-q", file]);
  } catch {
    failures.add(`${file} (not ignored)`);
  }
}
if (failures.size) {
  console.error("Credential safety check failed:", [...failures].join(", "));
  process.exitCode = 1;
} else {
  console.log(
    `Credential safety check passed: ${new Set(candidates).size} repository candidates, ${tracked.length} index entries, browser assets, blank example and ignore rules. No credential values printed.`,
  );
}
