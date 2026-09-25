import { it, expect } from "vitest";
import { Store } from "../src/server/store.js";
import { ToolLayer } from "../src/server/tools.js";
import { Agent } from "../src/server/agent.js";
import { SimulationPlanner } from "../src/server/planner.js";
import type { Handoff } from "../src/shared/domain.js";
it("a later safety issue upgrades the existing handoff without creating a duplicate", async () => {
  const store = new Store(":memory:", () => new Date("2026-09-24T10:00:00Z"));
  try {
    const agent = new Agent(
      store,
      new ToolLayer(store),
      new SimulationPlanner(),
    );
    const c = agent.create("c-nora");
    await agent.message(c, "Is my repair covered by warranty?");
    await agent.message(c, "My brakes barely work");
    const handoffs = store.all<Handoff>("handoffs");
    expect(handoffs).toHaveLength(1);
    expect(handoffs[0].urgency).toBe("urgent");
    expect(handoffs[0].summary).toContain("brakes barely work");
  } finally {
    store.close();
  }
});
it("relative dates use Copenhagen calendar day around UTC midnight", async () => {
  const store = new Store(":memory:", () => new Date("2026-09-24T22:30:00Z"));
  try {
    const agent = new Agent(
      store,
      new ToolLayer(store),
      new SimulationPlanner(),
    );
    const c = agent.create("c-nora");
    await agent.message(c, "Book routine service for Golf tomorrow");
    expect(c.context.date).toBe("2026-09-26");
  } finally {
    store.close();
  }
});
it("live planner spending is capped persistently before making another request", () => {
  const store = new Store();
  try {
    expect(store.consumeModelBudget(2)).toBe(true);
    expect(store.consumeModelBudget(2)).toBe(true);
    expect(store.consumeModelBudget(2)).toBe(false);
  } finally {
    store.close();
  }
});
it("repeated handoffs keep audit data bounded without recursive trace embedding", async () => {
  const store = new Store();
  try {
    const agent = new Agent(
      store,
      new ToolLayer(store),
      new SimulationPlanner(),
    );
    const c = agent.create("c-nora");
    for (let i = 0; i < 12; i++) await agent.message(c, "I want a human");
    expect(store.all("handoffs")).toHaveLength(1);
    expect(JSON.stringify(c).length).toBeLessThan(100000);
  } finally {
    store.close();
  }
});
it("invalid daily budget fails closed", () => {
  const store = new Store();
  try {
    expect(store.consumeModelBudget(NaN)).toBe(false);
    expect(store.consumeModelBudget(Infinity)).toBe(false);
  } finally {
    store.close();
  }
});
