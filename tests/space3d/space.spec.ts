import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { decodeArea } from '../../src/space3d/space.ts';

for (const folder of ['qorikancha', 'narikala']) test(`${folder}'s published 3D areas decode, match their record, sit within 0.5 m and stay in the phone budget`, () => {
  const dir = `public/places/${folder}/pieces/`;
  const space = JSON.parse(readFileSync(`${dir}space.json`, 'utf8'));
  const record = JSON.parse(readFileSync(`public/places/${folder}/place.json`, 'utf8'));
  let total = 0;
  for (const piece of space.pieces) {
    const bytes = readFileSync(`${dir}${piece.id}.bin`);
    total += bytes.length;
    const area = decodeArea(piece.id, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), piece.points);
    expect(area.n).toBe(piece.points);
    expect(area.colours.length).toBe(piece.points * 3);
    expect(piece.residual_rms_m).toBeLessThanOrEqual(0.5);
    // Every photo behind an area is in the package, so its contributor is credited.
    for (const photo of piece.photos) expect(record.photos.some((p: { id: string }) => p.id === photo)).toBe(true);
  }
  expect(total).toBeLessThan(5_000_000);
  expect(space.left_out.every((item: { reason: string }) => item.reason.length > 0)).toBe(true);
});
