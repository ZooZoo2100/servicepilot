import { afterEach, it, expect, vi } from "vitest";
import { api } from "../src/client/api.js";
afterEach(() => vi.unstubAllGlobals());
it("plain-text proxy rate limit becomes an actionable message", async () => {
  vi.stubGlobal(
    "fetch",
    async () => new Response("Too many requests", { status: 429 }),
  );
  await expect(api("/api/test")).rejects.toThrow("wait a minute");
});
it("JSON API error keeps its actionable message", async () => {
  vi.stubGlobal("fetch", async () =>
    Response.json({ error: "Try again later" }, { status: 429 }),
  );
  await expect(api("/api/test")).rejects.toThrow("Try again later");
});
it("unreadable upstream response never suggests the action succeeded", async () => {
  vi.stubGlobal(
    "fetch",
    async () => new Response("<html>gateway failure</html>", { status: 502 }),
  );
  await expect(api("/api/test")).rejects.toThrow("not confirmed");
});
