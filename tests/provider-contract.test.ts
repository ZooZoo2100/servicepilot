import { afterEach, it, expect, vi } from "vitest";
import { LivePlanner, SimulationPlanner } from "../src/server/planner.js";
import {
  RunBudgetPlanner,
  liveEvalReadiness,
} from "../src/server/live-eval.js";
import { Agent } from "../src/server/agent.js";
import { Store, vehicles } from "../src/server/store.js";
import { ToolLayer } from "../src/server/tools.js";
import type { Intent } from "../src/shared/domain.js";
const intent: Intent = {
  intent: "book",
  serviceId: "routine",
  vehicleId: "v-nora-2",
  date: null,
  time: null,
  bookingId: null,
  safetyCritical: false,
  correction: false,
  withdraw: false,
  summary: "Book Golf service",
  clarification: null,
};
const stores: Store[] = [];
function context() {
  const s = new Store(":memory:");
  stores.push(s);
  return new Agent(s, new ToolLayer(s), new SimulationPlanner()).create(
    "c-nora",
  );
}
afterEach(() => {
  vi.unstubAllEnvs();
  stores.splice(0).forEach((s) => s.close());
});
function transport(
  body: unknown,
  status = 200,
  onRequest?: (body: Record<string, unknown>) => void,
): typeof fetch {
  return vi.fn(async (_input, init) => {
    onRequest?.(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}
function openai(content = JSON.stringify(intent), finish = "stop") {
  return {
    id: "mock-openai-request",
    choices: [
      { finish_reason: finish, message: { role: "assistant", content } },
    ],
    usage: { prompt_tokens: 120, completion_tokens: 60, total_tokens: 180 },
  };
}
it("OpenAI sends bounded strict structured output request, validates response, records usage", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-transport-only");
  let request: Record<string, unknown> = {};
  const planner = new LivePlanner("openai", {
    fetch: transport(openai(), 200, (b) => (request = b)),
  });
  expect(
    await planner.plan("Book Golf service", context(), vehicles, new Date()),
  ).toEqual(intent);
  expect(request.max_completion_tokens).toBe(700);
  expect(request.response_format).toMatchObject({
    type: "json_schema",
    json_schema: { strict: true },
  });
  expect(planner.lastCall).toMatchObject({
    inputTokens: 120,
    outputTokens: 60,
    requestId: "mock-openai-request",
  });
});
it("Anthropic uses a forced structured interpretation tool with bounded output", async () => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-transport-only");
  let request: Record<string, unknown> = {};
  const planner = new LivePlanner("anthropic", {
    fetch: transport(
      {
        id: "mock-anthropic",
        type: "message",
        role: "assistant",
        model: "mock",
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "t1",
            name: "classify_request",
            input: intent,
          },
        ],
        usage: { input_tokens: 100, output_tokens: 50 },
      },
      200,
      (b) => (request = b),
    ),
  });
  expect(
    await planner.plan("Book Golf service", context(), vehicles, new Date()),
  ).toEqual(intent);
  expect(request.max_tokens).toBe(700);
  expect(request.tool_choice).toMatchObject({
    type: "tool",
    name: "classify_request",
    disable_parallel_tool_use: true,
  });
  expect(planner.lastCall?.inputTokens).toBe(100);
});
it.each(["openai", "anthropic"] as const)(
  "%s does not retry HTTP 429 or expose provider error messages",
  async (provider) => {
    vi.stubEnv(
      provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY",
      "test-only",
    );
    const fetch = transport(
      {
        error: {
          type: "rate_limit_error",
          message: "sensitive provider detail",
        },
      },
      429,
    );
    const p = new LivePlanner(provider, { fetch });
    await expect(
      p.plan("help", context(), vehicles, new Date()),
    ).rejects.not.toThrow("sensitive");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(p.lastCall?.httpStatus).toBe(429);
  },
);
it("malformed JSON fails closed and preserves bounded raw output for internal diagnosis", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-only");
  const p = new LivePlanner("openai", { fetch: transport(openai("{oops")) });
  await expect(p.plan("help", context(), vehicles, new Date())).rejects.toThrow(
    "INVALID_JSON",
  );
  expect(p.lastCall?.rawOutput).toBe("{oops");
});
it("valid JSON with invented operation fails schema validation", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-only");
  const p = new LivePlanner("openai", {
    fetch: transport(
      openai(JSON.stringify({ ...intent, intent: "complete_repair" })),
    ),
  });
  await expect(p.plan("help", context(), vehicles, new Date())).rejects.toThrow(
    "INVALID_PLAN",
  );
});
it("truncated OpenAI completion is rejected even if its prefix happens to parse", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-only");
  const p = new LivePlanner("openai", {
    fetch: transport(openai(JSON.stringify(intent), "length")),
  });
  await expect(
    p.plan("help", context(), vehicles, new Date()),
  ).rejects.toThrow();
});
it("Anthropic plain text cannot substitute for forced structured tool output", async () => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-only");
  const p = new LivePlanner("anthropic", {
    fetch: transport({
      id: "mock",
      type: "message",
      role: "assistant",
      model: "mock",
      stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify(intent) }],
      usage: { input_tokens: 1, output_tokens: 1 },
    }),
  });
  await expect(
    p.plan("help", context(), vehicles, new Date()),
  ).rejects.toThrow();
});
it("timeout aborts transport and makes only one attempt", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-only");
  const fetch = vi.fn(
    (_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      }),
  );
  const p = new LivePlanner("openai", {
    fetch: fetch as typeof globalThis.fetch,
    timeoutMs: 15,
  });
  await expect(
    p.plan("help", context(), vehicles, new Date()),
  ).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("run-wide budget is shared across separate scenario conversations", async () => {
  const underlying = { label: "mock", plan: vi.fn(async () => intent) };
  const budget = new RunBudgetPlanner(underlying, 2);
  await budget.plan("a", context(), vehicles, new Date());
  await budget.plan("b", context(), vehicles, new Date());
  await expect(
    budget.plan("c", context(), vehicles, new Date()),
  ).rejects.toThrow("BUDGET_EXHAUSTED");
  expect(underlying.plan).toHaveBeenCalledTimes(2);
});
it("readiness lists missing configuration without echoing secrets", () => {
  const report = liveEvalReadiness({
    AGENT_PROVIDER: "openai",
    OPENAI_API_KEY: "sensitive-test-value",
    OPENAI_MODEL: "explicit-model",
  });
  expect(report.state).toBe("READY_FOR_LIVE_EVAL");
  expect(report.missing).toContain("ALLOW_PAID_EVALS=true");
  expect(JSON.stringify(report)).not.toContain("sensitive-test-value");
});
it("fully configured readiness still does not claim remote credential validity", () => {
  expect(
    liveEvalReadiness({
      AGENT_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "sensitive-test-value",
      ANTHROPIC_MODEL: "explicit-model",
      ALLOW_PAID_EVALS: "true",
      MAX_LIVE_EVAL_CALLS: "150",
    }),
  ).toMatchObject({
    state: "CONFIGURED_FOR_EXPLICIT_LIVE_RUN",
    credentialsValidatedRemotely: false,
    missing: [],
  });
});
it.each(["0", "251", "NaN", "Infinity", "-1"])(
  "invalid run cap %s fails closed",
  (cap) => {
    expect(
      liveEvalReadiness({ MAX_LIVE_EVAL_CALLS: cap }).missing.some((s) =>
        s.includes("MAX_LIVE_EVAL_CALLS"),
      ),
    ).toBe(true);
  },
);
