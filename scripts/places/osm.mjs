#!/usr/bin/env node
// Asks Overpass once for what OpenStreetMap says along a recorded walk and keeps the answer in .local/osm/<id>.json,
// which package.mjs reads, so packaging itself needs no network and the same answer gives the same bytes.
// Usage: node scripts/places/osm.mjs <id>. Data © OpenStreetMap contributors, ODbL 1.0.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { accessQuery } from '../../src/osm/access.ts';

const id = process.argv[2];
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
if (!id || !/^[a-z0-9-]+$/.test(id)) { console.error('Usage: node scripts/places/osm.mjs <id>'); process.exit(1); }
const record = JSON.parse(readFileSync(join(root, '.local/routes', id, 'route.json'), 'utf8'));
const response = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: new URLSearchParams({ data: accessQuery(record.route.line) }), headers: { 'user-agent': 'mercature-places' } });
if (!response.ok) throw new Error(`Overpass answered ${response.status}.`);
const answer = await response.json();
mkdirSync(join(root, '.local/osm'), { recursive: true });
writeFileSync(join(root, '.local/osm', `${id}.json`), `${JSON.stringify(answer)}\n`);
console.log(`${answer.elements.length} elements, OpenStreetMap as of ${answer.osm3s?.timestamp_osm_base}`);
