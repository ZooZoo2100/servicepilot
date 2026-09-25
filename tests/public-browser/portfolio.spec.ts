import { test, expect, type Page } from "@playwright/test";
async function send(page: Page, text: string) {
  await page.getByLabel("Your message", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Checking your request" }),
  ).toHaveCount(0);
}
test("public booking, reload and cancellation use the real workflow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText(/Temporary simulation/)).toBeVisible();
  await send(page, "Book a tyre change for my Golf");
  await expect(
    page.getByRole("region", { name: "Appointment proposal" }),
  ).toContainText("Volkswagen Golf");
  await page.getByRole("button", { name: "Confirm appointment" }).click();
  await expect(page.getByRole("log")).toContainText(
    "Your appointment is confirmed",
  );
  await page.reload();
  await expect(page.getByRole("log")).toContainText(
    "Your appointment is confirmed",
  );
  await send(page, "Cancel booking BK-DEMO-NORA");
  await expect(
    page.getByRole("region", { name: "Appointment proposal" }),
  ).toContainText(/cancel/i);
  await page.getByRole("button", { name: /Confirm cancellation/ }).click();
  await expect(page.getByRole("log")).toContainText("cancelled");
});
test("public operations and lab expose safe read-only evidence with keyboard tabs", async ({
  page,
}) => {
  await page.goto("/operations");
  await expect(
    page.getByRole("heading", { name: "Needs a human." }),
  ).toBeVisible();
  await expect(page.getByLabel("Operations access token")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /failure controls/ })).toHaveCount(
    0,
  );
  await page.getByRole("tab", { name: /Handoffs/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /Conversations/ })).toBeFocused();
  await page.getByRole("tab", { name: /Evaluation Lab/ }).click();
  await expect(
    page.getByRole("heading", { name: "Evaluation Lab", exact: true }),
  ).toBeVisible();
  const firstRun = await page
    .getByLabel("Recorded run")
    .locator("option")
    .last()
    .getAttribute("value");
  await page.getByLabel("Recorded run").selectOption(firstRun!);
  await page.getByRole("button", { name: /Failures only/ }).click();
  await page
    .locator("details.record")
    .first()
    .locator("summary")
    .first()
    .click();
  await expect(page.locator(".result-badge.fail").first()).toBeVisible();
  await expect(page.getByText(/Expected behaviour/i).first()).toBeVisible();
});
test("public mobile safety, clarification, human handoff and long conversation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await send(page, "Book routine service for Golf and Model 3");
  await expect(
    page.getByRole("button", { name: "Confirm appointment" }),
  ).toHaveCount(0);
  await send(page, "My brakes barely work");
  await expect(page.getByRole("log")).toContainText("Avoid driving");
  await send(page, "I want a human");
  await expect(page.getByRole("log")).toContainText("simulated queue");
  for (let i = 0; i < 10; i++) await send(page, "What are your opening hours?");
  await send(page, "A long message ".repeat(100));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.getByLabel("Your message", { exact: true })).toBeVisible();
});
test("public HTTP entry refuses origin bypass, tampering and failure injection", async ({
  request,
}) => {
  expect(
    (
      await request.post("/api/demo", {
        data: { path: "/api/session", body: { customerId: "c-nora" } },
      })
    ).status(),
  ).toBe(403);
  const headers = { Origin: "http://localhost:3400" };
  expect(
    (
      await request.post("/api/demo", {
        headers,
        data: { path: "/api/internal/failure", body: {} },
      })
    ).status(),
  ).toBe(403);
  expect((await request.get("/api/internal/overview")).status()).toBe(404);
  const r = await request.post("/api/demo", {
    headers,
    data: { path: "/api/conversations/nonexistent", state: "a".repeat(80) },
  });
  expect(r.status()).toBe(401);
  expect(await r.text()).not.toMatch(/stack|DEMO_SESSION_SECRET|credential/i);
});
test("public case study, navigation, mobile layout and skip link", async ({
  page,
}) => {
  await page.goto("/case-study");
  await expect(
    page.getByRole("heading", { name: /A conversation is easy/ }),
  ).toBeVisible();
  await expect(
    page.getByText(/intentionally not performed/).first(),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page
    .getByRole("link", { name: /Explore scenarios in the Evaluation Lab/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Evaluation Lab", exact: true }),
  ).toBeVisible();
});
