#!/usr/bin/env node
// Asks Valhalla and Overpass once for the way around a recorded walk's mapped steps and keeps the raw requests and
// answers in .local/routes-around/<id>.json, which scripts/places/package.mjs reads, so packaging needs no network and
// the same answers give the same bytes. The record built from them goes to .local/routes-around/<id>.way_around.json to read.
// Usage: node scripts/routes/around.mjs <id>. Routing by the FOSSGIS Valhalla server; data © OpenStreetMap contributors, ODbL 1.0.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { askWayAround, recordWalk, wayAroundFrom } from '../../src/routes/around.ts';
import { VALHALLA } from '../../src/routes/valhalla.ts';

const id = process.argv[2];
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
if (!id || !/^[a-z0-9-]+$/.test(id)) { console.error('Usage: node scripts/routes/around.mjs <id>'); process.exit(1); }
const file = join(root, '.local/routes', id, 'route.json');
if (!existsSync(file)) throw new Error(`Missing ${file}; link .local/routes first.`);
const record = JSON.parse(readFileSync(file, 'utf8'));
if (record.schema !== 'mercature-route/1' || record.id !== id) throw new Error('Unexpected route record.');
const { version } = await (await fetch(`${VALHALLA}/status`)).json();
const walk = recordWalk(record);
// The public Overpass server turns a busy address away for a while, so a missing answer is asked again after a pause.
let answers, around;
for (let attempt = 1; ; attempt++) {
  answers = { ...(await askWayAround(record.route.line, undefined, undefined, new Date(), walk.steps.length > 0)), version };
  around = wayAroundFrom(answers, walk);
  if (around.status !== 'found' || answers.overpass) break;
  if (attempt === 4) throw new Error('Overpass did not answer; run it again later.');
  await new Promise(resolve => setTimeout(resolve, 20000 * attempt));
}
mkdirSync(join(root, '.local/routes-around'), { recursive: true });
writeFileSync(join(root, '.local/routes-around', `${id}.json`), `${JSON.stringify(answers)}\n`);
writeFileSync(join(root, '.local/routes-around', `${id}.way_around.json`), `${JSON.stringify(around, null, 1)}\n`);
const steps = around.avoids.map(item => `way ${item.way}${item.name ? ` on ${item.name}` : ''} (stretches ${item.stretches.join(', ')})`).join('; ') || 'none';
console.log(`Valhalla ${version}. Mapped steps on the walk: ${steps}. Way around: ${around.status}${around.lengthMetres ? `, ${around.lengthMetres} m against ${around.walkMetres} m, via ${around.streets.join(', ')}, apart from ${around.apart.leaves} m to ${around.apart.rejoins} m of the walk, ${around.findings.length} OpenStreetMap findings` : ''}.`);
