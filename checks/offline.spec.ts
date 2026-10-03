import { test, expect, chromium, type BrowserContext } from "@playwright/test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
const origin = `http://127.0.0.1:${process.env.MERCATURE_PORT ?? "4173"}/`;
test("a cold offline restart links a fresh Korean message by hand and reopens its saved fix exactly", async () => {
  await mkdir(".local", { recursive: true });
  const profile = await mkdtemp(path.resolve(".local/offline-browser-"));
  let context: BrowserContext | undefined;
  // Every start is a cold browser launch on the same profile, so offline only the service worker can serve the app.
  const start = async (offline: boolean) => {
    await context?.close();
    context = await chromium.launchPersistentContext(profile, {
      headless: true,
      viewport: { width: 1280, height: 720 },
    });
    await context.setOffline(offline);
    const page = context.pages()[0] ?? (await context.newPage());
    const response = await page.goto(origin);
    if (offline) expect(response!.fromServiceWorker()).toBe(true);
    return page;
  };
  try {
    let page = await start(false);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller)
        await new Promise<void>((resolve) =>
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            () => resolve(),
            { once: true },
          ),
        );
    });
    await expect
      .poll(() =>
        page.evaluate(async () =>
          (await caches.keys()).some((key) => key.startsWith("mercature-app-")),
        ),
      )
      .toBe(true);

    page = await start(true);
    await page.getByRole("textbox", { name: "Explore a place" }).fill("Visitor courtyard");
    await page.getByRole("button", { name: /^Visitor courtyard/ }).click();
    await page.getByRole("button", { name: "Load scene", exact: true }).click();
    await page.getByRole("button", { name: "Enter scene", exact: true }).click();
    await page.getByRole("tab", { name: "Messages", exact: true }).click();
    const text = `커피 자루 때문에 시음 테이블로 가기 어려웠어요. ${crypto.randomUUID()}`;
    await page.getByLabel("Original visitor message").fill(text);
    await page.getByRole("button", { name: "Find the spot", exact: true }).click();
    // No model is stored in a fresh offline profile, so the spot is chosen by hand.
    await expect(page.getByRole("button", { name: "Yes, this spot" })).toBeVisible();
    await page.getByLabel("Choose a spot", { exact: true }).selectOption("coffee-sacks");
    await page.getByRole("button", { name: "Yes, this spot" }).click();
    await page.getByRole("button", { name: "Storage corner", exact: true }).click();
    const paths = page.getByRole("table", { name: "All path results" });
    await expect(
      paths.getByRole("row").filter({ hasText: "Tasting table" }),
    ).toHaveText("Tasting tableBlockedConnected");
    await page.getByRole("button", { name: "Save plan", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Plan saved." })).toBeVisible();

    page = await start(true);
    await page.getByRole("button", { name: "Search places", exact: true }).click();
    await page.getByRole("button", { name: /Move coffee sacks/ }).click();
    await expect(page.getByRole("heading", { name: "Plan saved." })).toBeVisible();
    await expect(
      page.getByRole("tabpanel", { name: "Changes" }).getByText(text, { exact: true }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Messages", exact: true }).click();
    await expect(page.getByLabel("Original visitor message")).toHaveValue(text);
  } finally {
    await context?.close();
    await rm(profile, { recursive: true, force: true });
  }
});
