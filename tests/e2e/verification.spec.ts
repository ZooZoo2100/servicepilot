import { test, expect } from "@playwright/test";
const empty = {
  conversations: [],
  handoffs: [],
  requests: [],
  bookings: [],
  provider: "simulation",
  database: "isolated UI fixture",
};
test("keyboard operations tabs, empty states and mobile reflow (explicit UI fixture)", async ({
  page,
}) => {
  await page.route("**/api/internal/overview", (r) =>
    r.fulfill({ json: empty }),
  );
  await page.route("**/api/internal/evaluations", (r) =>
    r.fulfill({ json: [] }),
  );
  await page.goto("/operations");
  await page.getByLabel("Operations access token").fill("ui-fixture-only");
  await page.getByRole("button", { name: "Open operations" }).click();
  await expect(
    page.getByRole("heading", { name: "No handoffs waiting" }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/verification/evidence/empty-desktop.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Handoffs 0" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Conversations 0" }),
  ).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "No conversations yet" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("tab", { name: "Evaluation Lab 0" }).click();
  await expect(
    page.getByRole("heading", { name: "No evaluation evidence yet" }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/verification/evidence/lab-empty-mobile.png",
    fullPage: true,
  });
});
test("long conversation, long unbroken text, mobile composer and reduced motion (UI fixture)", async ({
  page,
}) => {
  await page.route("**/api/config", (r) =>
    r.fulfill({ json: { provider: "simulation", demoMode: true } }),
  );
  const messages = Array.from({ length: 30 }, (_, i) => ({
    id: String(i),
    role: i % 2 ? "assistant" : "user",
    text:
      i === 28
        ? "x".repeat(1900)
        : `Conversation entry ${i}: Please review the workshop information and assessment scope.`,
    at: "2026-09-24T10:00:00Z",
  }));
  await page.addInitScript(() =>
    sessionStorage.setItem("sp_conversation", "ui-long"),
  );
  await page.route("**/api/conversations/ui-long", (r) =>
    r.fulfill({
      json: { id: "ui-long", messages, revision: 15, provider: "simulation" },
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("log").locator("article")).toHaveCount(30);
  await page.screenshot({
    path: "docs/verification/evidence/long-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByLabel("Your message", { exact: true })
    .fill("A keyboard-accessible reply");
  await expect(
    page.getByRole("button", { name: "Send message", exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: "docs/verification/evidence/long-mobile.png",
    fullPage: false,
  });
});
test("non-JSON rate-limit errors are readable and preserve draft (transport fixture)", async ({
  page,
}) => {
  await page.route("**/api/config", (r) =>
    r.fulfill({ json: { provider: "simulation", demoMode: true } }),
  );
  await page.route("**/api/session", (r) =>
    r.fulfill({
      status: 429,
      contentType: "text/plain",
      body: "Too many requests",
    }),
  );
  await page.goto("/");
  await page
    .getByLabel("Your message", { exact: true })
    .fill("Please book a service");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("wait a minute");
  await expect(page.getByLabel("Your message", { exact: true })).toHaveValue(
    "Please book a service",
  );
});
