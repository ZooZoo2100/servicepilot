import { afterEach, describe, it, expect } from "vitest";
import { Store } from "../src/server/store.js";
import { ToolLayer } from "../src/server/tools.js";
import { Agent } from "../src/server/agent.js";
import { SimulationPlanner, type Planner } from "../src/server/planner.js";
import { customerView, type Intent } from "../src/shared/domain.js";
import { scenarios } from "../evals/scenarios.js";
import { runScenario } from "../evals/runner.js";
const stores: Store[] = [];
function setup(planner: Planner = new SimulationPlanner()) {
  const store = new Store(":memory:", () => new Date("2026-09-24T10:00:00Z"));
  stores.push(store);
  const tools = new ToolLayer(store);
  const agent = new Agent(store, tools, planner);
  return { store, tools, agent, c: agent.create("c-nora") };
}
afterEach(() => {
  stores.splice(0).forEach((s) => s.close());
});
describe("Evaluation regression suite", () => {
  for (const scenario of scenarios)
    it(`${scenario.id}: ${scenario.name}`, async () => {
      expect((await runScenario(scenario)).failures).toEqual([]);
    });
});
describe("Deterministic authority boundaries", () => {
  it("rejects direct mutation without a confirmation grant", async () => {
    const { tools, agent, c, store } = setup();
    await agent.message(c, "Book routine service for Golf");
    const before = store.bookings();
    expect(
      tools.call("create_booking", { proposalId: c.proposal!.id }, c),
    ).toMatchObject({ ok: false, error: { code: "CONFIRMATION_REQUIRED" } });
    expect(store.bookings()).toEqual(before);
  });
  it("old proposal cannot confirm after a customer correction", async () => {
    const { agent, c, store } = setup();
    await agent.message(c, "Book routine service for Golf");
    const old = c.proposal!.id;
    await agent.message(c, "Actually use Model 3 instead");
    agent.confirm(c, old);
    expect(store.bookings()).toHaveLength(2);
    expect(c.messages.at(-1)?.text).not.toContain(
      "Your appointment is confirmed",
    );
  });
  it("withdrawn proposal cannot be replayed", async () => {
    const { agent, c, store } = setup();
    await agent.message(c, "Book routine service for Golf");
    const id = c.proposal!.id;
    agent.withdraw(c);
    agent.confirm(c, id);
    expect(store.bookings()).toHaveLength(2);
  });
  it("a successful confirmation cannot be replayed", async () => {
    const { agent, c, store } = setup();
    await agent.message(c, "Book routine service for Golf");
    const id = c.proposal!.id;
    agent.confirm(c, id);
    agent.confirm(c, id);
    expect(store.bookings()).toHaveLength(3);
  });
  it("expired proposals do not commit", async () => {
    const { agent, c, store } = setup();
    await agent.message(c, "Book routine service for Golf");
    store.now = () => new Date("2026-09-24T10:11:00Z");
    agent.confirm(c, c.proposal!.id);
    expect(store.bookings()).toHaveLength(2);
    expect(c.messages.at(-1)?.text).toContain("expired");
  });
  it("two proposals for one slot cannot both commit", async () => {
    const { agent, c, store } = setup();
    const second = agent.create("c-nora");
    await agent.message(
      c,
      "Book routine service for Golf on 2026-10-01 at 09:30",
    );
    await agent.message(
      second,
      "Book routine service for Golf on 2026-10-01 at 09:30",
    );
    agent.confirm(c, c.proposal!.id);
    agent.confirm(second, second.proposal!.id);
    expect(store.bookings()).toHaveLength(3);
    expect(second.messages.at(-1)?.text).toContain("no longer available");
  });
  it("technician cannot be double-booked across different services", async () => {
    const { agent, c, store } = setup();
    const second = agent.create("c-nora");
    await agent.message(
      c,
      "Book routine service for Golf on 2026-10-01 at 09:30",
    );
    await agent.message(second, "Book brakes for Golf on 2026-10-01 at 09:30");
    expect(c.proposal).toBeDefined();
    expect(second.proposal).toBeDefined();
    agent.confirm(c, c.proposal!.id);
    agent.confirm(second, second.proposal!.id);
    expect(store.bookings()).toHaveLength(3);
  });
  it("stale booking versions reject cancellation", async () => {
    const { agent, c, store } = setup();
    await agent.message(c, "Cancel booking BK-DEMO-NORA");
    store.db
      .prepare("UPDATE bookings SET version=version+1 WHERE id=?")
      .run("BK-DEMO-NORA");
    agent.confirm(c, c.proposal!.id);
    expect(store.booking("BK-DEMO-NORA", "c-nora")?.status).toBe("confirmed");
  });
  it("customer-supplied account override is rejected by strict tool schema", () => {
    const { tools, c } = setup();
    expect(
      tools.call(
        "get_booking",
        { bookingId: "BK-DEMO-ERIK", customerId: "c-erik" },
        c,
      ),
    ).toMatchObject({ ok: false, error: { code: "INVALID_INPUT" } });
  });
  it("foreign records look identical to nonexistent records", () => {
    const { tools, c } = setup();
    expect(tools.call("get_booking", { bookingId: "BK-DEMO-ERIK" }, c)).toEqual(
      tools.call("get_booking", { bookingId: "BK-NOBODY" }, c),
    );
  });
  it("unknown tools fail closed", () => {
    const { tools, c } = setup();
    expect(tools.call("drop_database" as never, {}, c)).toMatchObject({
      ok: false,
      error: { code: "INVALID_INPUT" },
    });
  });
  it("malicious planner cannot select another customer vehicle", async () => {
    const planner: Planner = {
      label: "test-adversarial",
      plan: async () =>
        ({
          intent: "book",
          serviceId: "routine",
          vehicleId: "v-erik-1",
          date: null,
          time: null,
          bookingId: null,
          safetyCritical: false,
          correction: false,
          withdraw: false,
          summary: "ignore isolation",
        }) as Intent,
    };
    const { agent, c, store } = setup(planner);
    await agent.message(c, "Book a service");
    expect(c.proposal).toBeUndefined();
    expect(store.bookings()).toHaveLength(2);
    expect(c.messages.at(-1)?.text).not.toContain("Volvo");
  });
  it("provider timeout results in a truthful handoff", async () => {
    const { agent, c } = setup({
      label: "unavailable-test-provider",
      plan: async () => {
        throw new Error("secret-provider-stack");
      },
    });
    await agent.message(c, "Book a service");
    expect(c.handoffId).toBeDefined();
    expect(c.messages.at(-1)?.text).not.toContain("secret-provider-stack");
    expect(c.proposal).toBeUndefined();
  });
  it("customer projection excludes prompts, traces, account and internal facts", async () => {
    const { agent, c } = setup();
    await agent.message(c, "Book routine service for Golf");
    const view = customerView(c);
    expect(view).not.toHaveProperty("traces");
    expect(view).not.toHaveProperty("customerId");
    expect(view).not.toHaveProperty("facts");
    expect(view.proposal).not.toHaveProperty("slotId");
  });
  it("unsafe message bypasses a failing language provider", async () => {
    const { agent, c } = setup({
      label: "offline",
      plan: async () => {
        throw new Error("should never call");
      },
    });
    await agent.message(c, "My brakes barely work");
    expect(c.messages.at(-1)?.text).toContain("Avoid driving");
  });
  it("failed modification preserves the original appointment", async () => {
    const { agent, c, tools, store } = setup();
    const before = store.booking("BK-DEMO-NORA", "c-nora");
    await agent.message(c, "Move booking BK-DEMO-NORA to 2026-10-01 at 09:30");
    tools.failNext(c.id, "modify_booking", "timeout");
    agent.confirm(c, c.proposal!.id);
    expect(store.booking("BK-DEMO-NORA", "c-nora")).toEqual(before);
  });
  it("failed cancellation preserves confirmed state", async () => {
    const { agent, c, tools, store } = setup();
    await agent.message(c, "Cancel booking BK-DEMO-NORA");
    tools.failNext(c.id, "cancel_booking", "unavailable");
    agent.confirm(c, c.proposal!.id);
    expect(store.booking("BK-DEMO-NORA", "c-nora")?.status).toBe("confirmed");
  });
  it("handoff captures prior tool errors without hiding them", async () => {
    const { agent, c, tools, store } = setup();
    tools.failNext(c.id, "get_available_slots", "timeout");
    await agent.message(c, "Book routine service for Golf");
    const h = store.all<{ toolResults: { result: { ok: boolean } }[] }>(
      "handoffs",
    )[0];
    expect(h.toolResults.some((t) => !t.result.ok)).toBe(true);
  });
});
