import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const origin = process.env.SCREENSHOT_ORIGIN ?? "http://localhost:3000";
const dir = "docs/screenshots/portfolio";
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
async function shot(name: string, fullPage = true) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage });
}
async function send(text: string) {
  await page.getByLabel("Your message", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Checking your request" })
    .waitFor({ state: "hidden" });
}
await page.goto(origin);
await page.getByText(/Temporary simulation/).waitFor();
await shot("01-service-desk");
await send(
  "My Model 3 has a knocking noise from the front. I need the car tomorrow. Can you look at it today?",
);
await shot("02-conversation");
await page.getByRole("button", { name: "New conversation" }).click();
await send("Book a tyre change for my Golf");
await page.getByRole("region", { name: "Appointment proposal" }).waitFor();
await shot("03-confirmation");
await page.getByRole("button", { name: "Confirm appointment" }).click();
await page
  .getByRole("log")
  .getByText(/Your appointment is confirmed/)
  .waitFor();
await shot("03b-booking-confirmed");
await page.setViewportSize({ width: 390, height: 844 });
await shot("08-mobile");
await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(`${origin}/operations`);
await page.getByRole("heading", { name: "Needs a human." }).waitFor();
await page.locator("details.record").first().locator("summary").first().click();
await shot("04-operations");
await page.getByRole("tab", { name: /Evaluation Lab/ }).click();
await page
  .getByRole("heading", { name: "Evaluation Lab", exact: true })
  .waitFor();
await shot("05-evaluation-lab", false);
const oldest = await page
  .getByLabel("Recorded run")
  .locator("option")
  .last()
  .getAttribute("value");
await page.getByLabel("Recorded run").selectOption(oldest!);
await page.getByRole("button", { name: /Failures only/ }).click();
await page.locator(".filter-row select").selectOption("services");
await page.locator("details.record").first().locator("summary").first().click();
await page
  .locator("details.record")
  .first()
  .locator("details.trace")
  .first()
  .locator("summary")
  .click();
await shot("06-failure-investigation");
await page.setViewportSize({ width: 390, height: 844 });
await shot("08b-mobile-lab");
await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(`${origin}/case-study`);
await page.getByText("Latest recorded run").waitFor();
await shot("07-case-study");
await shot("07b-case-study-introduction", false);
await page.setViewportSize({ width: 390, height: 844 });
await shot("08c-mobile-case-study");
for (const width of [1440, 768, 390, 320]) {
  await page.setViewportSize({ width, height: 844 });
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    errors.push(`Case study overflow at ${width}`);
}
await browser.close();
writeFileSync(
  "docs/final/screenshot-check.json",
  JSON.stringify(
    {
      mode: "public simulation production build",
      browserErrors: errors,
      fictionalDataOnly: true,
      screenshotDirectory: dir,
    },
    null,
    2,
  ),
);
if (errors.length)
  throw new Error(
    "Screenshot inspection found browser errors; inspect the recorded check.",
  );
console.log(
  "Captured twelve fictional portfolio screenshots; no browser errors or case-study overflow.",
);
