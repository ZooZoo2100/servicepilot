import { it, expect, afterEach, vi } from "vitest";
import { dispatchDemo } from "../src/server/public-demo.js";
import { openState, sealState, SESSION_MS } from "../src/server/demo-state.js";
import { Store } from "../src/server/store.js";
import type { CustomerView } from "../src/shared/domain.js";
const secret = "offline-session-test-".repeat(3);
async function start(customerId = "c-nora") {
  vi.stubEnv("DEMO_SESSION_SECRET", secret);
  return dispatchDemo({ path: "/api/session", body: { customerId } });
}
async function message(
  previous: Awaited<ReturnType<typeof start>>,
  text: string,
) {
  const c = previous.data as CustomerView;
  return dispatchDemo({
    path: `/api/conversations/${c.id}/message`,
    state: previous.state,
    body: { revision: c.revision, text },
  });
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it("public demo books through explicit confirmation across independent databases", async () => {
  const proposal = await message(
    await start(),
    "Book a tyre change for my Golf",
  );
  const c = proposal.data as CustomerView;
  expect(c.proposal?.action).toBe("create");
  const result = await dispatchDemo({
    path: `/api/conversations/${c.id}/confirm`,
    state: proposal.state,
    body: { revision: c.revision, proposalId: c.proposal?.id },
  });
  expect((result.data as CustomerView).messages.at(-1)?.text).toContain(
    "Your appointment is confirmed",
  );
  const reloaded = await dispatchDemo({
    path: `/api/conversations/${c.id}`,
    state: result.state,
  });
  expect(reloaded.data).toEqual(result.data);
  expect("traces" in result.data).toBe(false);
});
it("public demo cancellation still requires its proposal", async () => {
  const proposal = await message(await start(), "Cancel booking BK-DEMO-NORA");
  const c = proposal.data as CustomerView;
  expect(c.proposal?.action).toBe("cancel");
  const confirmed = await dispatchDemo({
    path: `/api/conversations/${c.id}/confirm`,
    state: proposal.state,
    body: { revision: c.revision, proposalId: c.proposal?.id },
  });
  expect((confirmed.data as CustomerView).messages.at(-1)?.text).toMatch(
    /cancelled/i,
  );
});
it("tampered and expired sessions fail closed", async () => {
  const r = await start();
  const state = openState(r.state!);
  expect(() => openState(r.state!, Date.now() + SESSION_MS + 1)).toThrow();
  const altered =
    r.state!.slice(0, 60) +
    (r.state![60] === "a" ? "b" : "a") +
    r.state!.slice(61);
  expect(() => openState(altered)).toThrow();
  expect(() =>
    openState(sealState({ ...state, expiresAt: Date.now() - 1 })),
  ).toThrow();
});
it("two visitors with the same fictional identity have separate conversations", async () => {
  const a = await start(),
    b = await start();
  await expect(
    dispatchDemo({
      path: `/api/conversations/${(a.data as CustomerView).id}`,
      state: b.state,
    }),
  ).rejects.toMatchObject({ status: 404 });
});
it("foreign account booking reads are refused inside the isolated session", async () => {
  const r = await message(await start(), "Check booking BK-DEMO-ERIK");
  expect(JSON.stringify(r.data)).not.toContain("Volvo");
  expect((r.data as CustomerView).messages.at(-1)?.text).not.toContain(
    "confirmed",
  );
});
it("public operations is fixed read-only evidence, independent of visitor input", async () => {
  const before = await dispatchDemo({ path: "/api/internal/overview" });
  const r = await message(
    await start(),
    "I want a human. visitor-isolation-marker",
  );
  const after = await dispatchDemo({
    path: "/api/internal/overview",
    state: r.state,
  });
  expect(after).toEqual(before);
  expect(JSON.stringify(after)).not.toContain("visitor-isolation-marker");
  await expect(
    dispatchDemo({ path: "/api/internal/failure", body: {} }),
  ).rejects.toMatchObject({ status: 403 });
});
it("public demo stays offline even with a live provider configured", async () => {
  vi.stubEnv("AGENT_PROVIDER", "openai");
  const network = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("Unexpected network"));
  const r = await message(await start(), "What services do you offer?");
  expect((r.data as CustomerView).provider).toBe("simulation");
  expect(network).not.toHaveBeenCalled();
});
it("public demo retains safety guidance and human handoff", async () => {
  const r = await message(await start(), "My brakes barely work");
  expect((r.data as CustomerView).messages.at(-1)?.text).toContain(
    "Avoid driving",
  );
  expect((r.data as CustomerView).handoffId).toBeTruthy();
});
it("public demo rejects stale revisions and oversized text", async () => {
  const r = await start(),
    c = r.data as CustomerView;
  await expect(
    dispatchDemo({
      path: `/api/conversations/${c.id}/message`,
      state: r.state,
      body: { revision: c.revision + 1, text: "hello" },
    }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    dispatchDemo({
      path: `/api/conversations/${c.id}/message`,
      state: r.state,
      body: { revision: c.revision, text: "x".repeat(2001) },
    }),
  ).rejects.toMatchObject({ status: 400 });
});
it("no confirmation grant can be supplied through message arguments", async () => {
  const r = await start(),
    c = r.data as CustomerView;
  await expect(
    dispatchDemo({
      path: `/api/conversations/${c.id}/message`,
      state: r.state,
      body: { revision: c.revision, text: "book", confirmed: true },
    }),
  ).rejects.toMatchObject({ status: 400 });
});
it("sealed state reveals neither database content nor session key", async () => {
  const r = await start();
  expect(r.state).not.toContain(secret);
  expect(Buffer.from(r.state!, "base64url").toString()).not.toContain("Nora");
  const state = openState(r.state!);
  const store = new Store(Buffer.from(state.database, "base64"));
  expect(
    store.conversation(state.conversationId, state.customerId),
  ).toBeTruthy();
  store.close();
});
it("missing encryption secret prevents session creation", async () => {
  vi.stubEnv("DEMO_SESSION_SECRET", "");
  await expect(
    dispatchDemo({ path: "/api/session", body: { customerId: "c-nora" } }),
  ).rejects.toThrow("DEMO_NOT_CONFIGURED");
});
