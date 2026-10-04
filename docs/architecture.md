# Architecture

Mercature runs entirely in the browser. There is no server: the app, the published place and the model are static files, and after one download the model answers on the device. This page shows how the pieces fit and how to add a place.

## Map

| Path | What it holds |
| --- | --- |
| `src/site/` | What a place is. `route.ts` lists the Qorikancha spots with the words visitors use, `registry.ts` lists every place with spots, `farm.ts` and `inventory.ts` hold Noor's farm, and `contracts.ts` holds the shared types and the fixed lists the model answers from. |
| `scripts/places/package.mjs` | Builds a place's published package from its recorded walk. |
| `public/places/qorikancha/` | The published package: `place.json` (route, stretches, findings, every photo as a credited record, spots) and the photo views the app shows. |
| `src/destinations/` | Loads a recorded place (`data.ts`) and shows it: the route canvas (`RouteCanvas.tsx`, `RouteMap.tsx`, `walk.ts`) and the note and reply templates (`copy.ts`). |
| `src/decisions/store.ts` | What a person decided for each stretch, and the visitor messages they linked, kept on the device. |
| `src/language/` | The on-device model. `understand.ts` is its whole interface. |
| `src/workspace/`, `src/spatial/`, `src/plans/` | Noor's farm: its canvas, the path check (Connected, Blocked, Unknown) and saved fix plans. |
| `src/home/`, `src/preparation/`, `src/App.tsx` | Home, which draws the walk and lists the places that open on this device, the reveal before a place opens, and the app shell. |
| `src/i18n/` | Interface text in English (`en.ts`) and Spanish (`es.ts`), and the switch between them. |
| `src/components/` | Pieces shared by the canvases. |

## From a recorded walk to a decision

1. **Record.** A walk is recorded once, outside this repository: street photos from Mapillary, the route on foot from Valhalla on OpenStreetMap, SAM 3 outlines of possible barriers in the photos, and the walk cut into 10 m stretches. The result is one local file, `.local/routes/<id>/route.json` (`mercature-route/1`). Point clouds and full-size photos never ship.
2. **Name the spots.** `src/site/route.ts` turns the record into spots a visitor would talk about. Each flagged stretch and each landmark gets an id, a name in English and Spanish, one plain description, and the words visitors use in English, Spanish, Korean and Quechua. Nothing in it states a width, height or slope.
3. **Package.** `node scripts/places/package.mjs cusco-qorikancha` writes `public/places/qorikancha/`: the route, stretches and findings, every photo as a credited record, only the views the app shows, and the spot list. It also needs the scan output linked at `.local/scans/<id>` (`scans.json` and `masks/`), and adds every SAM 3 mark above its threshold on the views it ships, plus the marks near the route; nobody has checked them. The same input gives the same bytes.
4. **Load.** `loadDestination` in `src/destinations/data.ts` reads the package on any host, and offline once cached. Every field is checked before use.
5. **Read a message.** `understand(message, place)` in `src/language/understand.ts` returns the message kind (problem, praise or question), an issue type for problems, and up to three spot ids, best first, or Not sure with a reason. It never writes text. The suggested spots light up on the map; the route never shows the issue type (see below).
6. **Decide.** A person confirms on the photo, marks it Not a barrier, or chooses Check on site. `src/decisions/store.ts` keeps that for each stretch, with the linked message.
7. **Answer.** The visitor note and the reply in English, Spanish or Korean come from fixed templates in `src/destinations/copy.ts`.

Noor's farm is the Example with geometry. `NOOR_FARM` in `src/site/farm.ts` has an authored layout, so a fix (move or remove an object) is checked before and after with `solveScene` in `src/spatial/solver.ts` and saved as a plan with `src/plans/` (records in `docs/contracts.md`). Nothing on the route claims geometry.

## Add a place

1. **Record the walk** into `.local/routes/<id>/route.json`, in the same `mercature-route/1` shape as `cusco-qorikancha`.
2. **Write its spots** as a `RoutePlace`, like `QORIKANCHA_PLACE` in `src/site/route.ts`: one spot for each group of flagged stretches and for each landmark people name, with the stretches it covers, its nearest landmark, names in English and Spanish, one plain sentence, and the words visitors use in each language. Give it the folder for its package and add it to `ROUTE_PLACES` in `src/site/registry.ts`. `tests/site/route.spec.ts` then checks every registered place: every flagged stretch in exactly one spot, landmarks taken from the record and near their spot, no measurements in the text.
3. **Package it** with `node scripts/places/package.mjs <id>` (Node 22.18 or newer, on macOS, which resizes views with `sips`), and commit `public/places/<folder>/`. `tests/site/package.spec.ts` fails if a registered place has no package, or if its package no longer matches its spots.
4. **Register it** in `src/destinations/data.ts`: its name and city in `DESTINATIONS`. The package folder and the route canvas come from `ROUTE_PLACES`. To list it on Home, add a cover and its credit to `covers` in `src/home/Home.tsx`.
5. **Check the model**, as below.

## What the model needs for a new place

- **No retraining for spots or message kinds.** The model compares a message with each spot's names, description and visitor words, so a new spot list is all it needs. On first use `prepareSite` embeds the spots on the device and stores the vectors; changing a spot's words recomputes them.
- **A few labeled messages to check it.** Write 10 to 20 messages in the format of `scripts/language/route-messages.json` (text, language, kind, issue type, the spots meant) and score them with `scripts/language/evaluate.mjs route`, pointed at the new place's spots instead of Qorikancha's. On Qorikancha, with heads trained only on farm messages, the right spot came first for 28 of 31 messages and was always in the top three, and the kind was right for 38 of 40.
- **The issue type needs those messages too.** It did not carry over (right for 8 of 28 problems), so the route never shows it. On a new place, keep it hidden unless its labeled messages show it holds, or retrain the issue-type head with them. Details are in `docs/language.md`.

## Words in the code

The interface says place, spot, message, fix, plan and path check. Some code names are older:

| In the code | In the interface |
| --- | --- |
| `RoutePlace` (`src/site/route.ts`), `Site` (`src/site/contracts.ts`) | A place: spots only on the route, spots and geometry on the farm |
| `RouteSpot`, `SiteFeature` | A spot the model can name |
| `Spot` in `src/destinations/walk.ts` | A map marker for a run of flagged stretches |
| `Destination`, `src/destinations/` | A recorded place, as loaded from its package |
| `Scene.destinations` in `src/spatial/` | Where the farm's path check tries to reach |
| `ImprovementPlan`, `src/plans/` | A plan: a fix on the farm and its path check |

## Checks

Tests sit under `tests/` in folders named like the code they check. `npm run check:fast` runs the type check and every test that needs no browser. `bash scripts/checks/gate.sh` builds the app and runs everything, including a restart with the network off.
