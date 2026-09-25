import { it, expect, vi } from "vitest";
import { LivePlanner } from "../src/server/planner.js";
import { Store } from "../src/server/store.js";
import { Agent } from "../src/server/agent.js";
import { ToolLayer } from "../src/server/tools.js";
it("concurrent model requests keep provider observations scoped to their conversation", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-only");
  const s = new Store();
  try {
    const fetch = async (_url: unknown, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));
      const input = JSON.parse(request.messages[1].content);
      const first = input.request === "first";
      await new Promise((r) => setTimeout(r, first ? 5 : 25));
      return Response.json({
        id: first ? "first-request" : "second-request",
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                intent: "unknown",
                serviceId: null,
                vehicleId: null,
                date: null,
                time: null,
                bookingId: null,
                safetyCritical: false,
                correction: false,
                withdraw: false,
                summary: input.request,
                clarification: null,
              }),
            },
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      });
    };
    const planner = new LivePlanner("openai", {
      fetch: fetch as typeof globalThis.fetch,
    });
    const a = new Agent(s, new ToolLayer(s), planner);
    const first = a.create("c-nora"),
      second = a.create("c-erik");
    await Promise.all([a.message(first, "first"), a.message(second, "second")]);
    expect(first.planning?.[0].providerCall?.requestId).toBe("first-request");
    expect(first.planning?.[0].providerCall?.rawOutput).toContain("first");
    expect(second.planning?.[0].providerCall?.requestId).toBe("second-request");
  } finally {
    s.close();
    vi.unstubAllEnvs();
  }
});
it("a budget-denied turn does not reuse an earlier request observation or token usage", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-only");
  vi.stubEnv("MAX_DAILY_MODEL_CALLS", "1");
  const s = new Store();
  try {
    const fetch = async () =>
      Response.json({
        id: "one-real-attempt",
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                intent: "hours",
                serviceId: null,
                vehicleId: null,
                date: null,
                time: null,
                bookingId: null,
                safetyCritical: false,
                correction: false,
                withdraw: false,
                summary: "hours",
                clarification: null,
              }),
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 10 },
      });
    const p = new LivePlanner("openai", {
      fetch: fetch as typeof globalThis.fetch,
    });
    const a = new Agent(s, new ToolLayer(s), p);
    const c = a.create("c-nora");
    await a.message(c, "When do you open?");
    await a.message(c, "When do you close?");
    expect(c.planning?.[0].providerCall?.inputTokens).toBe(10);
    expect(c.planning?.[1].providerCall).toBeUndefined();
  } finally {
    s.close();
    vi.unstubAllEnvs();
  }
});
