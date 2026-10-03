import { test, expect } from "@playwright/test";
async function openExample(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Explore a place" }).fill("Visitor courtyard");
  await page
    .getByRole("button", { name: "Visitor courtyard · Authored editing demo" })
    .click();
  await page.getByRole("button", {name: "Load scene", exact: true}).click();
  await page.getByRole("button", {name: "Enter scene", exact: true}).click();
}
async function makeProposal(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Check the passage →" }).click();
  await page.getByRole("button", { name: "Yes, this feature →" }).click();
  await page.getByRole("button", { name: "Move bench →" }).click();
  await page.getByRole("button", { name: "Try the open corner →" }).click();
}
test("one guided change is compared, saved once, reopened and undone", async ({
  page,
}) => {
  await openExample(page);
  await makeProposal(page);
  await expect(page.locator(".compact-comparison")).toContainText("Blocked");
  await expect(page.locator(".compact-comparison")).toContainText("Connected");
  await page.getByRole("button", { name: "Save improvement plan →" }).click();
  await expect(
    page.getByRole("heading", { name: "Plan saved." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await page
    .getByLabel("Next actions and unresolved questions")
    .fill("Check placement with the operator before moving anything.");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save improvement plan" })
    .click();
  await page.getByRole("button", { name: "Back to home →" }).click();
  await expect(
    page.getByRole("button", { name: "Search places" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Search places" }).click();
  await page
    .getByRole("button", { name: /Move reviewed movable bench/ })
    .click();
  await page.getByRole("button", { name: "↶ Undo" }).click();
  await expect(page.getByRole("button", { name: "↶ Undo" })).toHaveCount(0);
  await page.getByRole("button", { name: "Evidence", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Evidence", exact: true }),
  ).toContainText("Original authored layout gap");
});
for (const size of [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
])
  test(`the next action fits at ${size.width} pixels`, async ({ page }) => {
    await page.setViewportSize(size);
    await openExample(page);
    const action = page.getByRole("button", { name: "Check the passage →" });
    await expect(action).toBeVisible();
    const box = await action.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(size.width);
    await makeProposal(page);
    await expect(
      page.getByRole("button", { name: "Save improvement plan →" }),
    ).toBeVisible();
  });
test("fresh Korean text remains private and exact in a saved manual association", async ({
  page,
}) => {
  await openExample(page);
  await page.getByRole("button", { name: "Add a visitor message" }).click();
  const text = "입구 옆 벤치 때문에 지나가기 어려웠어요.";
  await page.getByLabel("Original visitor message").fill(text);
  await page.getByLabel("Message language").selectOption("ko");
  await page.getByRole("button", { name: "Find the feature →" }).click();
  await page.getByRole("button", { name: "Yes, this feature →" }).click();
  await page.getByRole("button", { name: "Remove bench" }).click();
  await page.getByRole("button", { name: "Save improvement plan →" }).click();
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await page.getByText("Original visitor message", { exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(text);
  await expect(page.getByRole("dialog")).toContainText("Private report");
});
test("leaving map placement restores feature selection and step focus", async ({
  page,
}) => {
  await openExample(page);
  await page.getByRole("button", { name: "Check the passage →" }).click();
  await expect(page.locator(".guide-action")).toBeFocused();
  await page.getByRole("button", { name: "Yes, this feature →" }).click();
  await page.getByRole("button", { name: "Move bench →" }).click();
  await page.getByRole("button", { name: "Change feature" }).click();
  await page
    .getByRole("button", { name: "Inspect North dividing wall" })
    .click();
  await expect(
    page.getByRole("heading", { name: "North dividing wall" }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
test("a removed feature retains evidence and another proposal starts from the baseline", async ({
  page,
}) => {
  await openExample(page);
  await page.getByRole("button", { name: "Check the passage →" }).click();
  await page.getByRole("button", { name: "Yes, this feature →" }).click();
  await page.getByRole("button", { name: "Remove bench" }).click();
  await page.getByRole("button", { name: "Evidence", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Evidence", exact: true }),
  ).toContainText("Removed in this proposal.");
  await expect(
    page.getByRole("dialog", { name: "Evidence", exact: true }),
  ).toContainText("Original authored layout gap");
  await page.getByRole("button", { name: "Close evidence" }).click();
  await page.getByRole("button", { name: "Try another change" }).click();
  await page.getByRole("button", { name: "Move bench →" }).click();
  await page.getByRole("button", { name: "Try the open corner →" }).click();
  await expect(page.locator(".compact-comparison")).toContainText("Connected");
});
test("material changes reset approval and exact placement errors remain visible", async ({
  page,
}) => {
  await openExample(page);
  await makeProposal(page);
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await page.getByLabel("Decision", { exact: true }).selectOption("approved");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save improvement plan" })
    .click();
  await page.getByRole("button", { name: "↶ Undo" }).click();
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await expect(page.getByLabel("Decision", { exact: true })).toHaveValue(
    "planned",
  );
  await page.getByRole("button", { name: "Close details" }).click();
  await page.getByRole("button", { name: "Move bench →" }).click();
  await page.getByRole("button", { name: "Enter a position" }).click();
  await page.getByLabel("X (m)", { exact: true }).fill("-50");
  await page.getByRole("button", { name: "Preview move" }).click();
  await expect(
    page.getByRole("dialog", { name: "Exact placement" }).getByRole("alert"),
  ).toBeVisible();
});

test("a damaged places list does not hide healthy plans or undo a successful save", async ({
  page,
}) => {
  await openExample(page);
  await makeProposal(page);
  await page.getByRole("button", { name: "Save improvement plan →" }).click();
  await page.evaluate(() =>
    localStorage.setItem("mercature:places:v1", "not json"),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "Saved places could not be read",
  );
  await page.getByRole("button", { name: "Search places" }).click();
  await page
    .getByRole("button", { name: /Move reviewed movable bench/ })
    .click();
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await page
    .getByLabel("Next actions and unresolved questions")
    .fill("Keep the original measurement record.");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save improvement plan" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Plan saved." }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Search places" }).click();
  await page
    .getByRole("button", { name: /Move reviewed movable bench/ })
    .click();
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await expect(
    page.getByLabel("Next actions and unresolved questions"),
  ).toHaveValue("Keep the original measurement record.");
});

test("a local backup restores its plan before the interface calls it saved", async ({
  page,
  browser,
}) => {
  await openExample(page);
  await makeProposal(page);
  await page.getByRole("button", { name: "Save improvement plan →" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download backup" }).click();
  const file = await (await downloadPromise).path();
  const context = await browser.newContext();
  const restored = await context.newPage();
  try {
    await restored.goto("http://127.0.0.1:4173/");
    await restored.locator("input[type=file][accept*=json]").setInputFiles(file!);
    await expect(
      restored.getByRole("heading", { name: "Plan saved." }),
    ).toBeVisible();
    await restored.reload();
    await restored.getByRole("button", { name: "Search places" }).click();
    await restored
      .getByRole("button", { name: /Move reviewed movable bench/ })
      .click();
    await expect(
      restored.getByRole("button", { name: "↶ Undo" }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
