import { it, expect, afterEach } from "vitest";
import { Agent } from "../src/server/agent.js";
import { Store } from "../src/server/store.js";
import { ToolLayer } from "../src/server/tools.js";
import { SimulationPlanner, type Planner } from "../src/server/planner.js";
import {
  intentSchema,
  type Intent,
  type Handoff,
} from "../src/shared/domain.js";
const stores: Store[] = [];
function setup(planner: Planner = new SimulationPlanner()) {
  const store = new Store(":memory:", () => new Date("2026-09-24T10:00:00Z"));
  stores.push(store);
  const tools = new ToolLayer(store);
  const agent = new Agent(store, tools, planner);
  return { store, tools, agent, c: agent.create("c-nora") };
}
afterEach(() => stores.splice(0).forEach((s) => s.close()));
it("V01 unresolved relative date cannot be silently replaced by first availability", async () => {
  const { agent, c } = setup();
  await agent.message(c, "Book routine service for Golf next Friday");
  expect(c.proposal).toBeUndefined();
});
it("V02 multiple vehicles require clarification", async () => {
  const { agent, c } = setup();
  await agent.message(c, "Book routine service for Golf and Model 3");
  expect(c.proposal).toBeUndefined();
});
it("V03 explicit negated vehicle correction selects the positive vehicle", async () => {
  const { agent, c } = setup();
  await agent.message(c, "Book routine service for Model 3");
  await agent.message(c, "Not the Model 3; I meant the Golf");
  expect(c.proposal?.vehicleId).toBe("v-nora-2");
});
it("V04 unknown named vehicle is not silently replaced with a sole owned vehicle", async () => {
  const { agent } = setup();
  const c = agent.create("c-erik");
  await agent.message(c, "Book routine service for my Audi A4");
  expect(c.proposal).toBeUndefined();
});
it("V05 negated cancellation invalidates pending action", async () => {
  const { agent, c } = setup();
  await agent.message(c, "Cancel booking BK-DEMO-NORA");
  await agent.message(c, "Actually do not cancel it");
  expect(c.proposal).toBeUndefined();
});
it("V06 safety advice survives handoff failure and urgency stays high", async () => {
  const { agent, c, tools, store } = setup();
  tools.failNext(c.id, "escalate_to_human", "unavailable");
  await agent.message(c, "My brakes barely work");
  expect(c.messages.at(-1)?.text).toContain("Avoid driving");
  expect(store.all<Handoff>("handoffs")[0]?.urgency).toBe("urgent");
});
it("V07 valid long safety reports keep driving warning and urgency", async () => {
  const { agent, c, store } = setup();
  await agent.message(
    c,
    "My brakes barely work. " + "I need help with this vehicle. ".repeat(30),
  );
  expect(c.messages.at(-1)?.text).toContain("Avoid driving");
  expect(store.all<Handoff>("handoffs")[0]?.urgency).toBe("urgent");
});
it("V08 unresolved date correction invalidates stale date", async () => {
  const { agent, c } = setup();
  await agent.message(c, "Book routine service for Golf tomorrow");
  await agent.message(c, "Actually next Friday instead");
  expect(c.proposal).toBeUndefined();
  expect(c.context.date).toBeUndefined();
});
it("V09 reference-only answer preserves pending cancellation workflow", async () => {
  const { agent, c } = setup();
  await agent.message(c, "Cancel my appointment");
  await agent.message(c, "BK-DEMO-NORA");
  expect(c.proposal?.action).toBe("cancel");
});
it("V10 contradictory dates require clarification", async () => {
  const { agent, c } = setup();
  await agent.message(
    c,
    "Book routine service for Golf on 2026-10-01 or 2026-10-02, I have not decided",
  );
  expect(c.proposal).toBeUndefined();
});
it("V11 planner schema rejects impossible calendar dates and times", () => {
  const base = {
    intent: "book",
    serviceId: "routine",
    vehicleId: "v-nora-2",
    date: "2026-02-30",
    time: "99:99",
    bookingId: null,
    safetyCritical: false,
    correction: false,
    withdraw: false,
    summary: "Book service",
  };
  expect(intentSchema.safeParse(base).success).toBe(false);
});
it("V12 planner schema rejects additional authority-like properties", () => {
  const base = {
    intent: "book",
    serviceId: "routine",
    vehicleId: "v-nora-2",
    date: null,
    time: null,
    bookingId: null,
    safetyCritical: false,
    correction: false,
    withdraw: false,
    summary: "Book service",
    confirmed: true,
    price: 1,
  };
  expect(intentSchema.safeParse(base).success).toBe(false);
});
it("V13 malicious plan vehicle cannot pollute handoff with another account vehicle", async () => {
  const p: Intent = {
    intent: "human",
    serviceId: null,
    vehicleId: "v-erik-1",
    date: null,
    time: null,
    bookingId: null,
    safetyCritical: false,
    correction: false,
    withdraw: false,
    summary: "Get help",
  };
  const { agent, c, store } = setup({
    label: "adversarial",
    plan: async () => p,
  });
  await agent.message(c, "I need help");
  expect(store.all<Handoff>("handoffs")[0]?.vehicleId).not.toBe("v-erik-1");
});
it("V14 no fabricated slot can commit even with valid confirmation entrypoint", async () => {
  const { agent, c, store } = setup();
  await agent.message(c, "Book routine service for Golf");
  c.proposal!.slotId = "invented-slot";
  agent.confirm(c, c.proposal!.id);
  expect(store.bookings()).toHaveLength(2);
  expect(c.messages.at(-1)?.text).not.toContain(
    "Your appointment is confirmed",
  );
});
it("V15 model cannot execute nonallowlisted actions", async () => {
  const { agent, c, store } = setup({
    label: "malicious",
    plan: async () => ({ intent: "mark_repair_complete" }) as unknown as Intent,
  });
  await agent.message(c, "finish it");
  expect(c.proposal).toBeUndefined();
  expect(store.bookings()).toHaveLength(2);
});
it("V16 tool rejects caller-supplied price or warranty", () => {
  const { tools, c } = setup();
  expect(
    tools.call(
      "create_booking",
      { proposalId: "x", price: 1, warranty: true },
      c,
    ),
  ).toMatchObject({ ok: false, error: { code: "INVALID_INPUT" } });
});
it("V17 schema-valid model hallucinated date cannot replace a date absent from the customer request without review", async () => {
  const p: Intent = {
    intent: "book",
    serviceId: "routine",
    vehicleId: "v-nora-2",
    date: "2026-10-01",
    time: null,
    bookingId: null,
    safetyCritical: false,
    correction: false,
    withdraw: false,
    summary: "Book",
  };
  const { agent, c, store } = setup({
    label: "adversarial",
    plan: async () => p,
  });
  await agent.message(c, "Book routine service for Golf");
  expect(store.bookings()).toHaveLength(2);
  expect(c.proposal?.summary).toContain("2026-10-01");
});
it("V18 tool-call ceiling is explicit and resets for a new turn", () => {
  const { tools, c } = setup();
  tools.beginTurn(c);
  for (let i = 0; i < 8; i++)
    expect(tools.call("get_available_services", {}, c).ok).toBe(true);
  expect(tools.call("get_available_services", {}, c)).toMatchObject({
    ok: false,
    error: { code: "TOOL_LIMIT" },
  });
  tools.beginTurn(c);
  expect(tools.call("get_available_services", {}, c).ok).toBe(true);
});
it("V19 repeated unresolved ambiguity escalates rather than looping indefinitely", async () => {
  const { agent, c } = setup();
  for (let i = 0; i < 3; i++)
    await agent.message(c, "Book routine service for Golf next Friday");
  expect(c.handoffId).toBeDefined();
  expect(c.proposal).toBeUndefined();
});
it("V20 escalation tool independently rejects unowned vehicle argument", () => {
  const { tools, c, store } = setup();
  expect(
    tools.call(
      "escalate_to_human",
      {
        reason: "help",
        intent: "help",
        urgency: "normal",
        vehicleId: "v-erik-1",
      },
      c,
    ),
  ).toMatchObject({ ok: false });
  expect(store.all("handoffs")).toHaveLength(0);
});
