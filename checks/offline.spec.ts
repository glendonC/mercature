import { test, expect, chromium, type BrowserContext } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
test("a cold offline restart completes a fresh manual concern and reopens its checked plan", async () => {
  test.setTimeout(60000);
  const profile = await mkdtemp(path.resolve(".local/offline-browser-"));
  let context: BrowserContext | undefined;
  const open = async (offline: boolean) => {
    context = await chromium.launchPersistentContext(profile, {
      headless: true,
      viewport: { width: 1280, height: 720 },
    });
    await context.setOffline(offline);
    return context.pages()[0] ?? (await context.newPage());
  };
  try {
    let page = await open(false);
    await page.goto("http://127.0.0.1:4173/");
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
    await context!.close();
    page = await open(true);
    const response = await page.goto("http://127.0.0.1:4173/");
    expect(response!.fromServiceWorker()).toBe(true);
    await page.getByRole("textbox", { name: "Explore a place" }).fill("Visitor courtyard");
    await page
      .getByRole("button", { name: "Visitor courtyard · Authored editing demo" })
      .click();
    await page.getByRole("button", { name: "Add a visitor message" }).click();
    const text = `입구 옆 벤치 때문에 지나가기 어려웠어요. ${crypto.randomUUID()}`;
    await page.getByLabel("Original visitor message").fill(text);
    await page.getByLabel("Message language").selectOption("ko");
    await page.getByRole("button", { name: "Find the feature →" }).click();
    await page.getByRole("button", { name: "Yes, this feature →" }).click();
    await page.getByRole("button", { name: "Move bench →" }).click();
    await page.getByRole("button", { name: "Try the open corner →" }).click();
    await expect(page.locator(".compact-comparison")).toContainText("Blocked");
    await expect(page.locator(".compact-comparison")).toContainText(
      "Connected",
    );
    await page.screenshot({ path: ".local/guide-desktop.png" });
    await page.getByRole("button", { name: "Save improvement plan →" }).click();
    await expect(
      page.getByRole("heading", { name: "Plan saved." }),
    ).toBeVisible();
    await context!.close();
    page = await open(true);
    const reopened = await page.goto("http://127.0.0.1:4173/");
    expect(reopened!.fromServiceWorker()).toBe(true);
    await page.getByRole("button", { name: "Search places" }).click();
    await page
      .getByRole("button", { name: /Move reviewed movable bench/ })
      .click();
    await page.getByRole("button", { name: "Details", exact: true }).click();
    await page.getByText("Original visitor message", { exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText(text);
    await page.getByRole("button", { name: "Close details" }).click();
    await page.getByRole("button", { name: "Inspect Garden entrance" }).click();
    await page.getByRole("button", { name: "Evidence", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Evidence", exact: true }),
    ).toContainText("Connected");
    await page.getByRole("button", { name: "Close evidence" }).click();
    await page.getByRole("button", { name: "↶ Undo" }).click();
    await page.getByRole("button", { name: "Evidence", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Evidence", exact: true }),
    ).toContainText("Blocked");
  } finally {
    await context?.close();
    await rm(profile, { recursive: true, force: true });
  }
});
