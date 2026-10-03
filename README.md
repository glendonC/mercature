# Mercature

A local workspace for turning visitor concerns into reviewed site improvement plans.

Requires Node.js 22.12 or newer. Run `npm ci`, then `npm run dev` and open the address printed by the server. `npm run build` checks TypeScript and produces the application in `dist`. With the preview running, `npm test` runs the browser checks (install Chromium with `npx playwright install chromium` if needed).

Home opens saved work, imported JSON projects, an authored courtyard example, or an unlisted local place. The example supports manual concern confirmation, reversible move/remove proposals, deterministic comparison, undo and saved improvement plans. Local places retain photos/video and notes for inspection. The interface is under active refinement. Place names and cover photographs do not establish a measured model. No real-site accessibility, phone performance or operator-benefit claim has been validated. The first local Korean/English model evaluation failed its quality gate; AI matching is unavailable and manual association remains usable. See [language evaluation](docs/language.md) and [plan contracts](docs/contracts.md). Production builds include offline shell caching; a complete offline restart test is still required.

See [attribution](ATTRIBUTION.md) for reused code, photographs and fonts.
