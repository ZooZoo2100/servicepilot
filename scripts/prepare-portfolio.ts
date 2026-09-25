import { localizeHistoricalDisplay } from "./localize-historical-display.js";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { Agent } from "../src/server/agent.js";
import { Store } from "../src/server/store.js";
import { ToolLayer } from "../src/server/tools.js";
import { SimulationPlanner } from "../src/server/planner.js";
const files = readdirSync("evals/runs")
  .filter((f) => f.endsWith(".json") && !f.endsWith("-live.json"))
  .sort();
const first = files[0],
  latest = files.at(-1)!;
const selected = [...new Set([latest, first])];
const runs = selected.map((f) => {
  const original = JSON.parse(readFileSync(`evals/runs/${f}`, "utf8"));
  if (original.workshop?.currency === "DKK") return original;
  return {
    ...localizeHistoricalDisplay(original) as typeof original,
    localizationNote: "Historical run: Danish labels and currency are applied for display only. This is not a Danish rerun; original evidence and unchanged scores are preserved in GitHub.",
    originalArtifact: `https://github.com/ZooZoo2100/servicepilot/blob/main/evals/runs/${f}`,
  };
});
if (runs.some((r) => r.provider !== "simulation" || r.total !== 100))
  throw new Error("Only reviewed simulation evidence is publishable");
const store = new Store(":memory:", () => new Date("2026-09-24T10:00:00Z"));
const tools = new ToolLayer(store),
  agent = new Agent(store, tools, new SimulationPlanner());
for (const [text, failure] of [
  ["My brakes barely work. I need the car tomorrow.", false],
  ["Is the Model 3 battery repair covered by warranty?", false],
  ["Book a tyre change for my Golf", true],
] as const) {
  const c = agent.create("c-nora");
  await agent.message(c, text);
  if (failure && c.proposal) {
    tools.failNext(c.id, "create_booking", "timeout");
    agent.confirm(c, c.proposal.id);
  }
}
const evidence = {
  provenance: {
    description:
      "Curated fictional demonstration conversations generated with the real simulation workflow. Current Danish evaluation is a fresh run. Historical run display is explicitly localized; original source artifacts and scores remain unchanged.",
    sources: selected.map((file) => ({
      file: `evals/runs/${file}`,
      sha256: createHash("sha256")
        .update(readFileSync(`evals/runs/${file}`))
        .digest("hex"),
    })),
  },
  overview: {
    conversations: store.all("conversations"),
    handoffs: store.all("handoffs"),
    requests: store.all("requests"),
    bookings: store.bookings(),
    provider: "simulation",
    database: "Read-only fictional Danish evidence / localization revision",
  },
  runs,
};
store.close();
writeFileSync("src/server/portfolio-evidence.json", JSON.stringify(evidence));
console.log("Prepared read-only fictional evidence from", selected.join(", "));
