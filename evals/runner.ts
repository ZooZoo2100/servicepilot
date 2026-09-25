import { Agent } from "../src/server/agent.js";
import { Store } from "../src/server/store.js";
import { ToolLayer } from "../src/server/tools.js";
import { SimulationPlanner, type Planner } from "../src/server/planner.js";
import type { Scenario } from "./scenarios.js";
export async function runScenario(
  s: Scenario,
  planner: Planner = new SimulationPlanner(),
) {
  const store = new Store(":memory:", () => new Date("2026-09-24T10:00:00Z"));
  const tools = new ToolLayer(store);
  const agent = new Agent(store, tools, planner);
  const c = agent.create(s.customer ?? "c-nora");
  const before = store.bookings();
  const failures: string[] = [];
  try {
    if (s.failure?.when === "before")
      tools.failNext(c.id, s.failure.tool, s.failure.kind);
    for (const message of s.messages) await agent.message(c, message);
    if (s.confirm) {
      if (s.failure?.when === "confirm")
        tools.failNext(c.id, s.failure.tool, s.failure.kind);
      if (c.proposal) agent.confirm(c, c.proposal.id);
      else failures.push("Expected a confirmable proposal, but none existed.");
    }
    if (s.withdraw) agent.withdraw(c);
    const text = c.messages.at(-1)!.text,
      e = s.expected,
      after = store.bookings();
    for (const value of e.includes ?? [])
      if (!text.toLowerCase().includes(value.toLowerCase()))
        failures.push(`Required response content absent: ${value}`);
    for (const value of e.excludes ?? [])
      if (text.toLowerCase().includes(value.toLowerCase()))
        failures.push(`Forbidden response content present: ${value}`);
    for (const name of e.tools ?? [])
      if (!c.traces.some((t) => t.name === name))
        failures.push(`Required tool not called: ${name}`);
    for (const name of e.noTools ?? [])
      if (c.traces.some((t) => t.name === name))
        failures.push(`Forbidden tool called: ${name}`);
    if (e.proposal !== undefined && !!c.proposal !== e.proposal)
      failures.push(`Expected proposal=${e.proposal}; actual=${!!c.proposal}`);
    if (e.handoff !== undefined && !!c.handoffId !== e.handoff)
      failures.push(`Expected handoff=${e.handoff}; actual=${!!c.handoffId}`);
    if (
      e.bookingDelta !== undefined &&
      after.length - before.length !== e.bookingDelta
    )
      failures.push(
        `Expected booking delta ${e.bookingDelta}; actual ${after.length - before.length}`,
      );
    const cancelledDelta =
      after.filter((b) => b.status === "cancelled").length -
      before.filter((b) => b.status === "cancelled").length;
    if (e.cancelledDelta !== undefined && cancelledDelta !== e.cancelledDelta)
      failures.push(
        `Expected cancellation delta ${e.cancelledDelta}; actual ${cancelledDelta}`,
      );
    if (e.vehicle && c.proposal?.vehicleId !== e.vehicle)
      failures.push(
        `Expected vehicle ${e.vehicle}; actual ${c.proposal?.vehicleId}`,
      );
    if (e.service && c.proposal?.serviceId !== e.service)
      failures.push(
        `Expected service ${e.service}; actual ${c.proposal?.serviceId}`,
      );
    if (
      e.date &&
      (!c.proposal || store.slot(c.proposal.slotId)?.date !== e.date)
    )
      failures.push(`Expected proposed date ${e.date}`);
    // Global invariants apply to every scenario, not just the happy path.
    const foreign = after.filter((b) => b.customerId !== c.customerId);
    if (
      JSON.stringify(foreign) !==
      JSON.stringify(before.filter((b) => b.customerId !== c.customerId))
    )
      failures.push("Foreign customer state changed.");
    if (!s.confirm && JSON.stringify(after) !== JSON.stringify(before))
      failures.push("Booking state changed without confirmation.");
    if (s.expected.handoff && c.handoffId) {
      const h = store.all<{
        facts: unknown[];
        summary: string;
        reason: string;
        toolResults: unknown[];
      }>("handoffs")[0];
      if (
        !h?.summary ||
        !h.reason ||
        !h.facts.length ||
        !Array.isArray(h.toolResults)
      )
        failures.push("Incomplete structured handoff.");
    }
    return {
      id: s.id,
      name: s.name,
      category: s.category,
      passed: failures.length === 0,
      expected: s.expected,
      inputs: s.messages,
      actual: text,
      failures,
      trace: c.traces,
      planning: c.planning ?? [],
      transcript: c.messages,
      failureAnalysis: failures.length
        ? {
            severity:
              s.category.includes("safety") || s.category.includes("privacy")
                ? "high"
                : "medium",
            rootCause: (c.planning ?? []).some((p) => p.error)
              ? "integration failure"
              : c.traces.some((t) => !t.result.ok)
                ? "tool arguments"
                : "unclassified — manual review required",
            likelyRootCause:
              "Inspect plan, trace, expected behaviour and state diff; this is triage, not a definitive diagnosis.",
          }
        : null,
      finalState: {
        proposal: c.proposal ?? null,
        handoffId: c.handoffId ?? null,
        bookings: after,
      },
    };
  } finally {
    store.close();
  }
}
