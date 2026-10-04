import { test, expect, type Locator } from '@playwright/test';
import { coversOutline, overlaps, placeLabels, type Point } from '../../src/photo/layout';

const square = (x: number, y: number, size: number): Point[] => [[x, y], [x + size, y], [x + size, y + size], [x, y + size]];

test('label chips keep off each other and off their own outline, and wait behind the budget', () => {
  const items = [
    { id: 'steps', points: square(150, 100, 30), w: 70, h: 24 },
    { id: 'kerb', points: square(170, 120, 26), w: 60, h: 24 },
    { id: 'road', points: [[0, 160], [358, 150], [358, 240], [0, 240]] as Point[], w: 56, h: 24 },
    { id: 'crossing', points: square(60, 40, 40), w: 84, h: 24 },
    { id: 'bollard', points: square(300, 30, 12), w: 70, h: 24, force: true },
  ];
  const { placed, hidden } = placeLabels(items, { w: 358, h: 240 }, 3);
  expect(placed.map(p => p.id)).toEqual(['steps', 'kerb', 'road', 'bollard']);
  expect(hidden).toEqual(['crossing']);
  for (const p of placed) {
    expect(coversOutline(p.box, items.find(item => item.id === p.id)!.points)).toBe(false);
    expect(p.box.x >= 0 && p.box.y >= 0 && p.box.x + p.box.w <= 358 && p.box.y + p.box.h <= 240).toBe(true);
    for (const q of placed) if (q !== p) expect(overlaps({ ...p.box, y: p.box.y - 10, h: p.box.h + 20 }, { ...q.box, y: q.box.y - 10, h: q.box.h + 20 })).toBe(false);
  }
});

const boxes = (chips: Locator) => chips.evaluateAll(els => els.map(el => el.getBoundingClientRect()).map(r => ({ x: r.x, y: r.y, w: r.width, h: r.height })));

test('the labelled photo names each outline on the photo, selects by tap or key, zooms and credits the photo', async ({ page }) => {
  await page.goto('/?ui=photo');
  const photo = page.locator('.pd-guide .lp'), chips = photo.locator('.lp-chip:not([data-hidden])');
  await expect(chips.first()).toBeVisible();
  const shown = await boxes(chips);
  expect(shown.length).toBeGreaterThan(2);
  // 44 px targets: neighbours keep 20 px apart above and below, 8 px to the sides.
  for (const a of shown) for (const b of shown) if (a !== b) expect(overlaps({ ...a, x: a.x - 4, y: a.y - 10, w: a.w + 8, h: a.h + 20 }, { ...b, x: b.x - 4, y: b.y - 10, w: b.w + 8, h: b.h + 20 })).toBe(false);
  await expect(photo.locator('.lp-more')).toHaveText(/^\+\d+$/);

  // The credit stays readable: contributor, date, licence and a Mapillary link at 13 px or more.
  const creditLine = photo.locator('.lp-credit');
  await expect(creditLine).toContainText(/, \w{3} \d{4} · CC BY-SA 4\.0 · Mapillary/);
  await expect(creditLine.getByRole('link', { name: 'Mapillary' })).toHaveAttribute('href', /mapillary\.com/);
  expect(parseFloat(await creditLine.evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(13);

  // A tap on an outline selects it; Tab and Enter select a chip.
  const target = await photo.locator('.lp-mark:not([data-selected])').evaluateAll(marks => {
    for (const mark of marks) {
      const r = mark.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      if (document.elementFromPoint(x, y)?.closest('.lp-mark') === mark) return { id: mark.getAttribute('data-mark-id'), x, y };
    }
    return null;
  });
  expect(target).not.toBeNull();
  await page.mouse.click(target!.x, target!.y);
  await expect(photo.locator('.lp-mark[data-selected]')).toHaveAttribute('data-mark-id', target!.id!);
  const otherId = await photo.locator('.lp-chip:not([data-selected])').first().getAttribute('data-mark-id');
  const other = photo.locator(`.lp-chip[data-mark-id="${otherId}"]`);
  await other.focus();
  await page.keyboard.press('Enter');
  await expect(other).toHaveAttribute('aria-pressed', 'true');

  // Double click zooms in, the button brings back the whole photo, and the wheel zooms where it points.
  const frame = photo.locator('.lp-frame');
  await frame.dblclick({ position: { x: 60, y: 60 } });
  await expect(frame).toHaveAttribute('data-zoomed', 'true');
  await photo.getByRole('button', { name: 'Whole photo' }).click();
  await expect(frame).not.toHaveAttribute('data-zoomed');
  const box = (await frame.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -300);
  await expect(frame).toHaveAttribute('data-zoomed', 'true');
});

test('trace draws the outlines and lands every label, and is still under reduced motion', async ({ page }) => {
  await page.goto('/?ui=photo');
  await expect(page.locator('.pd-trace .lp')).toHaveAttribute('data-traced', 'true', { timeout: 8000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Replay' }).click();
  await expect(page.locator('.pd-trace .lp')).toHaveAttribute('data-traced', 'true', { timeout: 500 });
  await expect(page.locator('.pd-trace .lp')).not.toHaveAttribute('data-trace');
});

test('her answers recolour each chip and outline, Before shows the photo as read, and a photo nobody read shows only its credit', async ({ page }) => {
  await page.goto('/?ui=photo');
  const guide = page.locator('.pd-guide');
  const fixed = guide.locator('.lp-chip[data-answer=fixed]');
  await expect(fixed).toHaveCount(0);
  await guide.getByRole('button', { name: 'Now' }).click();
  await expect(fixed.first()).toBeVisible();
  await expect(fixed.first()).toHaveAttribute('aria-label', /You marked it gone or fixed$/);
  await expect(guide.locator('.lp-mark[data-answer=fixed]').first()).toBeAttached();
  await expect(guide.locator('.lp-note')).toHaveText(/^You checked this on 4 October$/);
  await guide.getByRole('button', { name: 'Before' }).click();
  await expect(guide.locator('[data-answer]')).toHaveCount(0);

  const bare = page.locator('.pd-bare .lp');
  await expect(bare.locator('.lp-image')).toBeVisible();
  await expect(bare.locator('.lp-chip, .lp-mark, .lp-more, .lp-note')).toHaveCount(0);
  await expect(bare.locator('.lp-credit')).toContainText('CC BY-SA 4.0');
});
