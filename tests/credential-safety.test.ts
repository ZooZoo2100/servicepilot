import { afterEach, expect, it, vi } from "vitest";
import { LivePlanner, SimulationPlanner } from "../src/server/planner.js";
import {
  RunBudgetPlanner,
  liveEvalReadiness,
} from "../src/server/live-eval.js";
import { Store, vehicles } from "../src/server/store.js";
import { Agent } from "../src/server/agent.js";
import { ToolLayer } from "../src/server/tools.js";
import { secretJsonReplacer } from "../src/server/secrets.js";

const secret = "sk-" + "proj-" + "credentialSafetySentinel".repeat(3);
const stores: Store[] = [];
it("JSON sinks redact nested API responses, report transcripts and legacy trace strings", () => {
  vi.stubEnv("OPENAI_API_KEY", secret);
  vi.stubEnv("ADMIN_TOKEN", "internal-access-sentinel");
  const serialized = JSON.stringify(
    {
      traces: [{ args: { text: secret }, result: "internal-access-sentinel" }],
      messages: [secret],
    },
    secretJsonReplacer,
  );
  expect(serialized.includes(secret)).toBe(false);
  expect(serialized.includes("internal-access-sentinel")).toBe(false);
  expect(serialized).toContain("[REDACTED]");
});

it("JSON sinks also remove a recognizable unconfigured API credential", () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  expect(
    JSON.stringify({ text: secret }, secretJsonReplacer).includes(secret),
  ).toBe(false);
});
function setup(planner = new SimulationPlanner()) {
  const store = new Store(":memory:");
  stores.push(store);
  const agent = new Agent(store, new ToolLayer(store), planner);
  return { store, agent, c: agent.create("c-nora") };
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  stores.splice(0).forEach((s) => s.close());
});

it("redacts accidentally supplied credentials before conversation persistence", async () => {
  vi.stubEnv("OPENAI_API_KEY", secret);
  const { agent, c, store } = setup();
  await agent.message(c, `Please get a human. ${secret}`);
  expect(JSON.stringify(c).includes(secret)).toBe(false);
  expect(
    JSON.stringify(store.conversation(c.id, c.customerId)).includes(secret),
  ).toBe(false);
});

it("scrubs provider input, structured output and diagnostic metadata; debug logging stays off", async () => {
  vi.stubEnv("OPENAI_API_KEY", secret);
  vi.stubEnv("OPENAI_LOG", "debug");
  const logs = ["debug", "info", "warn", "error", "log"].map((method) =>
    vi.spyOn(console, method as "log").mockImplementation(() => {}),
  );
  const { c } = setup();
  const plan = await new SimulationPlanner().plan(
    "hello",
    c,
    vehicles,
    new Date(),
  );
  let requestBody = "";
  const fetch = vi.fn(async (_input: unknown, init?: RequestInit) => {
    requestBody = String(init?.body);
    return new Response(
      JSON.stringify({
        id: secret,
        choices: [
          {
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: JSON.stringify({ ...plan, summary: secret }),
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 10 },
      }),
      { headers: { "content-type": "application/json" } },
    );
  });
  const planner = new LivePlanner("openai", {
    fetch: fetch as typeof globalThis.fetch,
  });
  const result = await planner.plan(`hello ${secret}`, c, vehicles, new Date());
  expect(requestBody.includes(secret)).toBe(false);
  expect(JSON.stringify(result).includes(secret)).toBe(false);
  expect(JSON.stringify(planner.lastCall).includes(secret)).toBe(false);
  expect(logs.every((log) => log.mock.calls.length === 0)).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("rejects oversized planner input before any network attempt", async () => {
  vi.stubEnv("OPENAI_API_KEY", secret);
  const fetch = vi.fn();
  const planner = new LivePlanner("openai", { fetch });
  await expect(
    planner.plan("x".repeat(40000), setup().c, vehicles, new Date()),
  ).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});

it("reserves the paid budget before concurrent attempts and counts failures", async () => {
  const inner = {
    label: "openai",
    plan: vi.fn(async () => {
      throw new Error("transport failed");
    }),
  };
  const budget = new RunBudgetPlanner(inner, 2);
  const { c } = setup();
  await Promise.allSettled(
    Array.from({ length: 20 }, () =>
      budget.plan("hello", c, vehicles, new Date()),
    ),
  );
  expect(inner.plan).toHaveBeenCalledTimes(2);
  expect(budget.calls).toBe(2);
});

it.each([undefined, "false", "TRUE", "1", " true"])(
  "paid gate fails closed for %s",
  (flag) => {
    expect(
      liveEvalReadiness({
        AGENT_PROVIDER: "openai",
        OPENAI_API_KEY: secret,
        OPENAI_MODEL: "gpt-4.1-mini-2025-04-14",
        MAX_LIVE_EVAL_CALLS: "10",
        ALLOW_PAID_EVALS: flag,
      }).missing,
    ).toContain("ALLOW_PAID_EVALS=true");
  },
);
