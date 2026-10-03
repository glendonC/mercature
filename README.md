<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/mark-dark.svg">
    <img src="docs/assets/mark-light.svg" width="88" alt="Mercature">
  </picture>
</p>

<h1 align="center">Mercature</h1>

<p align="center">
  Understand your visitors. Fix the right spot.
</p>

<p align="center">
  <a href="#get-started">Get started</a> ·
  <a href="docs/product.md">Product</a> ·
  <a href="docs/language.md">Model</a> ·
  <a href="docs/evidence.md">Evidence</a>
</p>

<p align="center">
  <a href="https://github.com/glendonC/mercature/actions/workflows/check.yml"><img src="https://github.com/glendonC/mercature/actions/workflows/check.yml/badge.svg?branch=main" alt="Checks"></a>
  <a href="package.json"><img src="https://img.shields.io/badge/Node.js-22.12%2B-3c4043" alt="Node.js 22.12 or newer"></a>
</p>

Peru welcomed over four million international visitors in 2025, and 7 in 10 of its workers are
in businesses of ten people or fewer. Small tour operators live on what visitors tell them. Much
of it arrives in languages they cannot read, about parts of the site they cannot see the way a
visitor does.

Mercature turns a visitor's message into a decision on the operator's own site. A small
multilingual model on the phone says whether the message is a problem, praise or a question, and
which parts of the site it most likely means. The operator confirms the spot, tries a fix on an
editable 3D map of the place, and sees what changes before the next visit. After one download, it
works offline.

Built for the World Bank Small AI for Development challenge, tourism track.

<sub>Figures: 4,157,469 international visitors to Peru in 2025, preliminary (MINCETUR, <a href="https://www.gob.pe/institucion/mincetur/informes-publicaciones/7619520-reportes-de-turismo-reporte-mensual-de-turismo-diciembre-2025">Reporte Mensual de Turismo, diciembre 2025</a>, 14 January 2026); 71.7% of Peru's employed people work in units of 1 to 10 people, 88.6% of them informally (INEI, <a href="https://m.inei.gob.pe/media/MenuRecursivo/boletines/01-informe-tecnico-empleo-nacional.pdf">mercado laboral, enero a diciembre 2025</a>, February 2026).</sub>

## Small AI, by the rules

| The challenge asks | Mercature |
| --- | --- |
| Runs on a device the user already has | A web app installed from the browser on a phone |
| Core feature works offline | After one download, messages are understood and checked with no connection |
| Model files small enough to side-load | One quantized multilingual encoder with small classifier heads ([sizes](docs/language.md)) |
| At least one local language | Spanish interface; Quechua tested as the less-supported language ([results](docs/language.md)) |
| A person makes the final call | The model suggests; the operator confirms every spot and every change |
| Avoid hallucinations | Fixed lists only; unclear results say "Not sure" |

## Get started

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open [127.0.0.1:4173](http://127.0.0.1:4173) and search for **Noor's farm**. The first visit
downloads the model once; after that the core loop works with no connection. To try the
installable offline build, run `npm run build` and `npm run preview`.

The recorded destination examples on Home need local capture data that is not part of this
repository; see [architecture](docs/architecture.md#retained-destinations).

## Checks

```sh
npx playwright install chromium
bash scripts/checks/gate.sh
```

The gate builds the app, starts its own preview, runs the domain and browser checks, and restarts
a browser with networking off to test the offline loop. Set `MERCATURE_PORT` to use a port other
than 4173.

## Documentation

| Start here | Go deeper |
| --- | --- |
| [Product](docs/product.md) | [Architecture](docs/architecture.md) |
| [Model and evaluation](docs/language.md) | [Plan records](docs/contracts.md) |
| [Evidence and data](docs/evidence.md) | [Attribution](ATTRIBUTION.md) |

## Limits

- Noor and her farm are fictional, like the persona in the challenge brief. The farm map is
  authored and labeled synthetic.
- The path check is geometric planning with an illustrative 0.9 m width. It is not accessibility
  certification.
- No real visitor messages were used, and the Korean and Quechua examples have not been reviewed
  by native speakers. What the data does not cover is listed in [evidence](docs/evidence.md).

Photographs, fonts, map data and libraries keep their own terms; see [attribution](ATTRIBUTION.md).
