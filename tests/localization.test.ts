import { it, expect } from "vitest";
import { Store, services, workshop } from "../src/server/store.js";
import { Agent } from "../src/server/agent.js";
import { ToolLayer } from "../src/server/tools.js";
import { SimulationPlanner } from "../src/server/planner.js";
import { workshopDate } from "../src/server/time.js";
import { formatDate, formatPrice } from "../src/shared/workshop.js";
import evidence from "../src/server/portfolio-evidence.json";
const oldLabels = /NOK|Oslo|Motorverksted|nb[-_]NO|Europe\/Oslo/;
function fixture() {
  const store = new Store(":memory:", () => new Date("2026-09-24T10:00:00Z"));
  const tools = new ToolLayer(store);
  const agent = new Agent(store, tools, new SimulationPlanner());
  return { store, tools, agent, c: agent.create("c-nora") };
}
it("Danish workshop and every structured service expose DKK", () => {
  expect(workshop).toMatchObject({ name:"Varde Motorværksted", location:"Hedehusene, Denmark", currency:"DKK", locale:"da-DK", timezone:"Europe/Copenhagen" });
  const {store,tools,c}=fixture();
  try {
    expect(tools.call("get_workshop_information",{},c)).toMatchObject({ok:true,data:workshop});
    const result=tools.call("get_available_services",{},c);
    expect(result).toMatchObject({ok:true,data:services});
    expect(services.every(s=>s.currency === "DKK")).toBe(true);
    expect((store.db.prepare("SELECT data FROM services").all() as {data:string}[]).every(s=>JSON.parse(s.data).currency === "DKK")).toBe(true);
  } finally { store.close(); }
});
it("catalogue migration updates an existing database without changing amounts", () => {
  const {store}=fixture();
  store.db.prepare("UPDATE services SET data=? WHERE id='routine'").run(JSON.stringify({...services[0],currency:"NOK"}));
  const snapshot=store.db.serialize();store.close();
  const restored=new Store(snapshot);
  try { expect(JSON.parse((restored.db.prepare("SELECT data FROM services WHERE id='routine'").get() as {data:string}).data)).toEqual(services[0]); } finally {restored.close();}
});
it("agent price and location responses use verified Danish data", async () => {
  const {store,agent,c}=fixture();
  try {
    await agent.message(c,"How much does routine service cost?");
    expect(c.messages.at(-1)?.text).toContain("2.490 DKK");
    await agent.message(c,"Where are you located? What is your address?");
    expect(c.messages.at(-1)?.text).toContain("Hedehusene, Denmark");
    expect(JSON.stringify(c)).not.toMatch(oldLabels);
    expect(formatPrice(1290)).toBe("1.290 DKK");
  } finally {store.close();}
});
it.each([
  ["2026-01-01T23:30:00Z","2026-01-02"],
  ["2026-07-01T22:30:00Z","2026-07-02"],
  ["2026-03-29T00:30:00Z","2026-03-29"],
  ["2026-10-25T01:30:00Z","2026-10-25"],
])("Copenhagen calendar is correct at midnight and DST: %s", (instant,day)=> {
  expect(workshopDate(new Date(instant))).toBe(day);
});
it("Danish proposal formatting preserves ISO dates and explicit confirmation", async () => {
  const {store,agent,c}=fixture();
  try {
    await agent.message(c,"Book routine service for Golf on 2026-10-01 at 09:30");
    const proposal=c.proposal!;
    expect(proposal.summary).toContain(`${formatDate("2026-10-01")} at 09:30 (Europe/Copenhagen)`);
    expect(proposal.summary).toContain("2.490 DKK");
    expect(c.context.date).toBe("2026-10-01");
    expect(store.bookings().length).toBe(2);
    agent.confirm(c,proposal.id);
    expect(store.bookings().length).toBe(3);
  } finally {store.close();}
});
it("published demonstration evidence contains only Danish display labels",()=> {
  expect(JSON.stringify(evidence)).not.toMatch(oldLabels);
  const historical=evidence.runs.find(r=>r.passed===89);
  expect(historical).toHaveProperty("localizationNote");
});
