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
  await page.getByRole("button", { name: "Check the passage" }).click();
  await page.getByRole("button", { name: "Yes, this feature" }).click();
  await page.getByRole("button", { name: "Move bench", exact: true }).click();
  await page.getByRole("button", { name: "Try the open corner" }).click();
}
test("one guided change is compared, saved once, reopened and undone", async ({
  page,
}) => {
  await openExample(page);
  await makeProposal(page);
  await expect(page.locator(".compact-comparison")).toContainText("Blocked");
  await expect(page.locator(".compact-comparison")).toContainText("Connected");
  await page.getByRole("button", { name: "Save improvement plan" }).click();
  await expect(
    page.getByRole("heading", { name: "Plan saved." }),
  ).toBeVisible();
  await page.getByRole("button", {name: "Scene options", exact: true}).click();
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await page
    .getByLabel("Next actions and unresolved questions")
    .fill("Check placement with the operator before moving anything.");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save improvement plan" })
    .click();
  await page.getByRole("button", { name: "Back to home" }).click();
  await expect(
    page.getByRole("button", { name: "Search places" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Search places" }).click();
  await page
    .getByRole("button", { name: /Move reviewed movable bench/ })
    .click();
  await page.getByRole("button", {name: "Scene options", exact: true}).click();
  await page.getByRole("button", { name: "↶ Undo" }).click();
  await expect(page.getByRole("button", { name: "↶ Undo" })).toHaveCount(0);
  await page.getByRole("button", {name: "Scene options", exact: true}).click();
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
    const action = page.getByRole("button", { name: "Check the passage" });
    await expect(action).toBeVisible();
    const box = await action.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(size.width);
    await page.screenshot({path:`.local/dialogue-start-${size.width}.png`});
    await makeProposal(page);
    await expect(
      page.getByRole("button", { name: "Save improvement plan" }),
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
  await page.getByRole("button", { name: "Find the feature" }).click();
  await page.getByRole("button", { name: "Yes, this feature" }).click();
  await page.getByRole("button", { name: "Remove bench" }).click();
  await page.getByRole("button", { name: "Save improvement plan" }).click();
  await page.getByRole("button", {name: "Scene options", exact: true}).click();
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await page.getByText("Original visitor message", { exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(text);
  await expect(page.getByRole("dialog")).toContainText("Private report");
});
test("leaving map placement restores feature selection and step focus", async ({
  page,
}) => {
  await openExample(page);
  await page.getByRole("button", { name: "Check the passage" }).click();
  await expect(page.locator(".guide-action")).toBeFocused();
  await page.getByRole("button", { name: "Yes, this feature" }).click();
  await page.getByRole("button", { name: "Move bench", exact: true }).click();
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
  await page.getByRole("button", { name: "Check the passage" }).click();
  await page.getByRole("button", { name: "Yes, this feature" }).click();
  await page.getByRole("button", { name: "Remove bench" }).click();
  await page.getByRole("button", {name: "Scene options", exact: true}).click();
  await page.getByRole("button", { name: "Evidence", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Evidence", exact: true }),
  ).toContainText("Removed in this proposal.");
  await expect(
    page.getByRole("dialog", { name: "Evidence", exact: true }),
  ).toContainText("Original authored layout gap");
  await page.getByRole("button", { name: "Close evidence" }).click();
  await page.getByRole("button", { name: "Try another change" }).click();
  await page.getByRole("button", { name: "Move bench", exact: true }).click();
  await page.getByRole("button", { name: "Try the open corner" }).click();
  await expect(page.locator(".compact-comparison")).toContainText("Connected");
});
test("material changes reset approval and exact placement errors remain visible", async ({
  page,
}) => {
  await openExample(page);
  await makeProposal(page);
  await page.getByRole("button", {name: "Scene options", exact: true}).click();
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await page.getByLabel("Decision", { exact: true }).selectOption("approved");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save improvement plan" })
    .click();
  await page.getByRole("button", {name: "Scene options", exact: true}).click();
  await page.getByRole("button", { name: "↶ Undo" }).click();
  await page.getByRole("button", {name: "Scene options", exact: true}).click();
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await expect(page.getByLabel("Decision", { exact: true })).toHaveValue(
    "planned",
  );
  await page.getByRole("button", { name: "Close details" }).click();
  await page.getByRole("button", { name: "Move bench", exact: true }).click();
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
  await page.getByRole("button", { name: "Save improvement plan" }).click();
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
  await page.getByRole("button", {name: "Scene options", exact: true}).click();
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
  await page.getByRole("button", {name: "Scene options", exact: true}).click();
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
  await page.getByRole("button", { name: "Save improvement plan" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download backup" }).click();
  const file = await (await downloadPromise).path();
  const context = await browser.newContext({ baseURL: `http://127.0.0.1:${process.env.MERCATURE_PORT ?? "4173"}` });
  const restored = await context.newPage();
  try {
    await restored.goto("/");
    await restored.locator("input[type=file][accept*=json]").setInputFiles(file!);
    await expect(
      restored.getByRole("heading", { name: "Plan saved." }),
    ).toBeVisible();
    await restored.reload();
    await restored.getByRole("button", { name: "Search places" }).click();
    await restored
      .getByRole("button", { name: /Move reviewed movable bench/ })
      .click();
    await restored.getByRole("button", {name: "Scene options"}).click();
    await expect(
      restored.getByRole("button", { name: "↶ Undo" }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

test('the contextual guide follows selection and options preserve keyboard return', async ({page}) => {
  await openExample(page);
  await expect(page.locator('.contextual-guide')).toBeVisible();
  await expect(page.getByRole('button', {name:'Details',exact:true})).toBeHidden();
  await expect(page.locator('.guide-header')).toHaveCount(0);
  await expect.poll(async () => {
    const bot = await page.locator('.contextual-guide').boundingBox();
    const panel = await page.locator('.scene-dialogue').boundingBox();
    return Math.abs(bot!.x - (panel!.x - 76));
  }).toBeLessThan(2);
  await page.screenshot({path:'.local/dialogue-start-1280.png'});
  await page.getByRole('button', {name:'Check the passage',exact:true}).click();
  await expect(page.locator('.contextual-guide')).toHaveAttribute('data-role','evidence');
  await expect(page.locator('.contextual-guide')).toHaveAttribute('data-feature','bench');
  await page.getByRole('button', {name:'Inspect North dividing wall',exact:true}).click();
  const featureId = await page.getByRole('button', {name:'Inspect North dividing wall',exact:true}).getAttribute('data-feature-id');
  await expect(page.locator('.contextual-guide')).toHaveAttribute('data-feature',featureId!);
  await expect.poll(async () => {
    const bot = await page.locator('.contextual-guide').boundingBox();
    const wall = await page.getByRole('button', {name:'Inspect North dividing wall',exact:true}).boundingBox();
    return Math.abs(bot!.x - (wall!.x + wall!.width + 8));
  }).toBeLessThan(8);
  await page.getByRole('button', {name:'Scene options',exact:true}).click();
  await page.getByRole('button', {name:'Evidence',exact:true}).click();
  await expect(page.getByRole('dialog', {name:'Evidence',exact:true})).toContainText('North dividing wall');
  await page.getByRole('button', {name:'Close evidence',exact:true}).click();
  await expect(page.getByRole('button', {name:'Scene options',exact:true})).toBeFocused();
  await page.screenshot({path:'.local/dialogue-inspection-1280.png'});
});

for (const size of [{width:1280,height:720},{width:390,height:844}]) {
  test(`scene, narration and actions stay distinct through review at ${size.width}`, async ({page}) => {
    await page.setViewportSize(size);
    await openExample(page);
    const initialScene = await page.locator('.guide-scene').boundingBox();
    await page.getByRole('button', {name:'Add a visitor message',exact:true}).click();
    await page.getByLabel('Original visitor message').fill('The bench makes the entrance hard to pass.');
    const withForm = await page.locator('.guide-scene').boundingBox();
    expect(withForm!.width).toBeCloseTo(initialScene!.width,0);
    expect(withForm!.height).toBeCloseTo(initialScene!.height,0);
    await expect(page.getByRole('region',{name:'Guide dialogue'}).getByRole('button')).toHaveCount(0);
    await page.getByRole('button', {name:'Find the feature',exact:true}).click();
    await page.getByText('Feature details',{exact:true}).click();
    await expect(page.locator('.feature-facts')).toContainText('0.70 × 1.20');
    expect((await page.locator('.guide-scene').boundingBox())!.height).toBeCloseTo(initialScene!.height,0);
    await page.getByText('Feature details',{exact:true}).click();
    await page.getByRole('button', {name:'Yes, this feature',exact:true}).click();
    await page.getByRole('button', {name:'Move bench',exact:true}).click();
    await page.getByRole('button', {name:'Try the open corner',exact:true}).click();
    await expect(page.getByRole('region', {name:'Passage result'})).toContainText('Connected');
    await expect(page.getByRole('region', {name:'Next action'})).not.toContainText('Blocked');
    await expect(page.getByRole('region', {name:'Guide dialogue'})).toContainText('opens a route');
    await page.getByRole('button', {name:'Before',exact:true}).click();
    await expect(page.getByRole('button', {name:'Before',exact:true})).toHaveAttribute('aria-pressed','true');
    await page.getByRole('button', {name:'After',exact:true}).click();
    const scene = await page.locator('.guide-scene').boundingBox();
    const context = await page.locator('.context-panel').boundingBox();
    if (size.width > 700) expect(scene!.x + scene!.width).toBeLessThan(context!.x);
    else expect(scene!.y + scene!.height).toBeLessThan(context!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
    await page.screenshot({path:`.local/scene-review-${size.width}.png`,fullPage:true});
  });
}

test('a blocked proposal prioritizes another change and can still be saved for review', async ({page}) => {
  await openExample(page);
  await page.getByRole('button',{name:'Check the passage',exact:true}).click();
  await page.getByRole('button',{name:'Yes, this feature',exact:true}).click();
  await page.getByRole('button',{name:'Move bench',exact:true}).click();
  await page.getByRole('button',{name:'Enter a position',exact:true}).click();
  await page.getByLabel('X (m)',{exact:true}).fill('5.4');
  await page.getByLabel('Y (m)',{exact:true}).fill('3');
  await page.getByRole('button',{name:'Preview move',exact:true}).click();
  await expect(page.getByRole('region',{name:'Guide dialogue'})).toContainText('still blocked');
  await expect(page.locator('.context-panel .primary')).toHaveText('Try another change');
  await expect(page.getByRole('region',{name:'Passage result'})).toContainText('Blocked');
  await page.getByRole('button',{name:'Save for review',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Plan saved.',exact:true})).toBeVisible();
});
