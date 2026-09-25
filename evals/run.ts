import { workshopSettings } from "../src/shared/workshop.js";
import { createHash } from "node:crypto";
import "dotenv/config";
import { redactSecrets, secretJsonReplacer } from "../src/server/secrets.js";
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { scenarios } from "./scenarios.js";
import { runScenario } from "./runner.js";
import { LivePlanner, SimulationPlanner } from "../src/server/planner.js";
import {
  liveEvalReadiness,
  RunBudgetPlanner,
} from "../src/server/live-eval.js";
if (process.argv.includes("--preflight")) {
  console.log(JSON.stringify(liveEvalReadiness(), secretJsonReplacer, 2));
  process.exit(0);
}
const live = process.argv.includes("--live");
const readiness = liveEvalReadiness();
if (live && readiness.missing.length)
  throw new Error(
    `Live evaluation not configured: ${readiness.missing.join("; ")}`,
  );
const provider = live ? process.env.AGENT_PROVIDER : "simulation";
const planner = live
  ? new RunBudgetPlanner(
      new LivePlanner(provider as "openai" | "anthropic"),
      readiness.maxCalls!,
    )
  : new SimulationPlanner();
const results = [];
const skipped: string[] = [];
for (const s of scenarios) {
  if (
    planner instanceof RunBudgetPlanner &&
    planner.calls >= planner.maxCalls
  ) {
    skipped.push(s.id);
    continue;
  }
  results.push(await runScenario(s, planner));
}
const categories: Record<string, { total: number; passed: number }> = {};
for (const r of results) {
  categories[r.category] ??= { total: 0, passed: 0 };
  categories[r.category].total++;
  if (r.passed) categories[r.category].passed++;
}
const at = new Date().toISOString(),
  id = at.replace(/[:.]/g, "-");
let commit = "uncommitted";
try {
  commit = execSync("git rev-parse HEAD", {
    stdio: ["ignore", "pipe", "ignore"],
  })
    .toString()
    .trim();
} catch {
  /* New repository. */
}
const sourceFiles = [
  ...readdirSync("src/server")
    .filter((f) => f.endsWith(".ts"))
    .map((f) => "src/server/" + f),
  "src/shared/domain.ts",
  "src/shared/workshop.ts",
  "evals/scenarios.ts",
  "evals/runner.ts",
  "evals/run.ts",
].sort();
const sourceHash = createHash("sha256")
  .update(sourceFiles.map((f) => f + "\n" + readFileSync(f, "utf8")).join("\n"))
  .digest("hex");
const scenarioHash = createHash("sha256")
  .update(JSON.stringify(scenarios))
  .digest("hex");
const report = {
  workshop: workshopSettings,
  sourceHash,
  scenarioHash,
  runtime: process.version,
  model: live
    ? provider === "openai"
      ? process.env.OPENAI_MODEL
      : process.env.ANTHROPIC_MODEL
    : null,
  liveCalls: planner instanceof RunBudgetPlanner ? planner.calls : 0,
  maxLiveCalls: live ? readiness.maxCalls : null,
  requestedTotal: scenarios.length,
  skipped,
  complete: skipped.length === 0,
  tokenUsage: results.reduce(
    (sum, r) => ({
      input:
        sum.input +
        r.planning.reduce((n, p) => n + (p.providerCall?.inputTokens ?? 0), 0),
      output:
        sum.output +
        r.planning.reduce((n, p) => n + (p.providerCall?.outputTokens ?? 0), 0),
    }),
    { input: 0, output: 0 },
  ),
  id,
  at,
  provider: planner.label,
  commit,
  clock: "2026-09-24T10:00:00Z",
  total: results.length,
  passed: results.filter((r) => r.passed).length,
  failed: results.filter((r) => !r.passed).length,
  categories,
  results,
};
mkdirSync("evals/runs", { recursive: true });
writeFileSync(
  `evals/runs/${id}${live ? "-live" : ""}.json`,
  JSON.stringify(report, secretJsonReplacer, 2),
);
console.log(`${report.passed}/${report.total} passed (${planner.label})`);
for (const r of results.filter((r) => !r.passed))
  console.log(redactSecrets(`${r.id} ${r.name}: ${r.failures.join("; ")}`));
process.exitCode = report.failed || skipped.length ? 1 : 0;
