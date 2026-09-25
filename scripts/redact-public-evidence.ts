import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
const root = process.cwd();
const home = homedir();
const manifestFile = "docs/final/evidence-redactions.json";
type Entry = {
  file: string;
  originalSha256: string;
  publicSha256: string;
  transformation: string;
  privateOriginal: string;
};
const entries: Entry[] = existsSync(manifestFile)
  ? JSON.parse(readFileSync(manifestFile, "utf8"))
  : [];
const hash = (value: Buffer | string) =>
  createHash("sha256").update(value).digest("hex");
const files = execFileSync("git", [
  "ls-files",
  "--cached",
  "--others",
  "--exclude-standard",
  "-z",
])
  .toString()
  .split("\0");
for (const file of files) {
  if (
    !/\.(txt|md|json)$/.test(file) ||
    !existsSync(file) ||
    file === manifestFile
  )
    continue;
  const original = readFileSync(file);
  const text = original.toString();
  if (!text.includes(root) && !text.includes(home)) continue;
  const publicText = text
    .split(root)
    .join("<repository>")
    .split(home)
    .join("<home>");
  const archive = path.join("docs/private-evidence", file);
  mkdirSync(path.dirname(archive), { recursive: true });
  const target =
    existsSync(archive) && hash(readFileSync(archive)) !== hash(original)
      ? `${archive}.${hash(original).slice(0, 12)}`
      : archive;
  if (!existsSync(target)) writeFileSync(target, original);
  writeFileSync(file, publicText);
  entries.push({
    file,
    originalSha256: hash(original),
    publicSha256: hash(publicText),
    transformation:
      "Replace workstation repository/home paths with <repository>/<home>; no other edits",
    privateOriginal: target,
  });
}
writeFileSync(manifestFile, JSON.stringify(entries, null, 2));
console.log(
  `Public evidence path redactions recorded: ${entries.length}. Originals retained in ignored local archive.`,
);
