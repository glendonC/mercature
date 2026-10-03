# Mercature

Turn a visitor concern or a site check into a reviewed improvement plan.

Open the prepared courtyard, choose the affected feature, preview a move or removal, compare the result and save. The scene stays central; the guide offers one next action at a time. Evidence, movement requirements and plan details remain available on demand.

## Run locally

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open the address printed by the server. To try the offline build, stop the development server, then run `npm run build` and `npm run preview`. Open it once online to provision the application. Saved work and original evidence remain in this browser and origin; changing browser or hostname does not transfer them.

## What works

- Photographic Home with search through saved places, local place creation and JSON project import.
- A clearly synthetic courtyard with map, projected 3D and split views, shared selection and original evidence.
- Human-confirmed visitor concerns or proactive checks, supported object move/removal, deterministic comparison and undo.
- Saved improvement plans with exact source, geometry, profile and solver bindings. Local backups retain private-source restrictions.
- Local photo/video intake with hashes, original-file storage, notes and an optional geographic boundary.
- A provisioned offline manual workflow, including cold browser restart, fresh input, comparison, saving and reopening.

The guide uses [bot-avatars](https://libraries.dev/bots). Animation reflects interface state and is not evidence of AI inference.

## Boundaries

The scene is an authored control. No real site has accepted measured geometry. The solver checks horizontal support, fixed-axis square clearance and headroom; unsupported requirements remain unresolved. This is not accessibility certification or a prediction of individual passage.

The first local Korean/English matcher failed its preregistered quality gate. AI matching is unavailable; manual selection remains usable. The offline test preserves Korean text but does not demonstrate language understanding. Representative-phone performance, competent language review and operator benefit remain unverified.

Search currently covers saved work. Online place search, automatic photo geolocation, reconstruction, measured-site acceptance and live preparation jobs are not implemented. Uploaded images do not acquire invented camera positions or accepted geometry. A saved or approved plan does not mean physical work has happened.

## Checks

```sh
npx playwright install chromium
bash scripts/checks/gate.sh
```

The full gate builds the app, starts its own production preview, runs domain/browser checks and tests an offline workflow across cold browser restarts. Stop the existing Mercature preview first; the gate never stops other servers. For focused checks with a preview already running, use `npm test`. The offline check requires a production preview: `npm run test:offline`.

See [architecture](docs/architecture.md), [plan contracts](docs/contracts.md), [language evaluation](docs/language.md), and [attribution](ATTRIBUTION.md).
