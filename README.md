<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/mark-dark.svg">
    <img src="docs/assets/mark-light.svg" width="88" alt="Mercature">
  </picture>
</p>

<h1 align="center">Mercature</h1>

<!-- Subtitle pending the Home text decision. -->

<p align="center">
  <a href="#get-started">Get started</a> ·
  <a href="docs/product.md">Product</a> ·
  <a href="docs/language.md">Model</a> ·
  <a href="docs/evidence.md">Evidence</a> ·
  <a href="docs/architecture.md">Architecture</a>
</p>

<p align="center">
  <a href="https://github.com/glendonC/mercature/actions/workflows/check.yml"><img src="https://github.com/glendonC/mercature/actions/workflows/check.yml/badge.svg?branch=main" alt="Checks"></a>
  <a href="package.json"><img src="https://img.shields.io/badge/Node.js-22.12%2B-3c4043" alt="Node.js 22.12 or newer"></a>
</p>

Peru welcomed over four million international visitors in 2025, and 7 in 10 of its workers are
in businesses of ten people or fewer. Small tour operators live on what visitors tell them, and much
of it arrives in languages they cannot read, about places they cannot easily check.

Mercature turns a visitor's message into a checked spot on a real route. A small multilingual model
on the phone reads the message and lights up the spots it most likely means. The operator opens the
real street photo for each one and decides: Confirm, Not a barrier, or Check on site. She then adds
a note for future visitors and copies a pre-written reply. After one download, it works offline.

Built for the World Bank Small AI for Development challenge, tourism track.

<sub>Figures: 4,157,469 international visitors to Peru in 2025, preliminary (MINCETUR, <a href="https://www.gob.pe/institucion/mincetur/informes-publicaciones/7619520-reportes-de-turismo-reporte-mensual-de-turismo-diciembre-2025">Reporte Mensual de Turismo, diciembre 2025</a>, 14 January 2026); 71.7% of Peru's employed people work in units of 1 to 10 people, 88.6% of them informally (INEI, <a href="https://m.inei.gob.pe/media/MenuRecursivo/boletines/01-informe-tecnico-empleo-nacional.pdf">mercado laboral, enero a diciembre 2025</a>, February 2026).</sub>

## The Qorikancha walk

A real route in Cusco, from the Plaza de Armas to the Qorikancha ticket booth: 594 m in 60
stretches, seen through 403 Mapillary street photos taken between 2015 and 2023. A large
segmentation model outlined steps and kerbs once, when the route was prepared; 8 of its 52 findings
are flagged as possible barriers, and none is verified until the operator checks the photo. A
stretch with no flagged barrier means only that no barrier was seen in the photos: Mercature claims
no widths, slopes or reachability.

Noor's farm, the persona from the brief, is a second, authored place labeled Example, where an
obstruction can be moved and the path rechecked.

## The model

[multilingual-e5-small](https://huggingface.co/intfloat/multilingual-e5-small) (MIT), int8 and
trimmed to Latin and Korean script, with three small trained heads, runs in the browser with ONNX
Runtime Web. It downloads once and then works with no connection: 83,783,194 bytes stored on the device, about 52 MB over the network because GitHub Pages compresses it. It answers only
from fixed lists and says Not sure when unsure. On 48 held-out English, Spanish and Korean messages
about the farm it put the right spot first 46 times; moved to the Qorikancha walk with no new
training, 28 of 31. It failed on Quechua, so messages that do not look like English, Spanish or
Korean now always get Not sure. About 29 ms per message on the development Mac; no phone has been measured.
All test messages are synthetic, written by a large language model. Details: [model and
evaluation](docs/language.md).

## Get started

Try it at [glendonc.github.io/mercature](https://glendonc.github.io/mercature/). Open it once online to download the model, then it works offline. Interface in English and Spanish. The Spanish interface, and the Spanish and Korean notes and replies, have not been reviewed by a native speaker.

To run it locally, you need Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open [127.0.0.1:4173](http://127.0.0.1:4173) and choose **Open** on Qorikancha, or open
**Noor's farm**, the example. The first visit downloads the model once. To try the installable offline build, run
`npm run build` and `npm run preview`.

## Checks

```sh
npx playwright install chromium
npm run check:fast
npm run check:ui
bash scripts/checks/gate.sh
```

- `check:fast` type-checks and runs the domain checks in about four seconds.
- `check:ui` runs the browser checks against a server you already started.
- `gate.sh` builds the app, starts its own preview, runs everything, and restarts a browser with
  networking off to test the offline loop.

Set `MERCATURE_PORT` to use a port other than 4173.

## Data and credits

Street photos are by Mapillary contributors under CC BY-SA 4.0, credited on every photo; this
repository ships 27 credited crops of the route in `public/places/qorikancha`. Places and paths are
from OpenStreetMap (ODbL), the walking route from Valhalla, outlines from SAM 3. Partial 3D from VGGT
exists only in a local install; the published package has no points. Test messages are synthetic (CC0) and none has been reviewed by a native speaker. The sources
behind every figure, and what the data does not cover, are in [evidence](docs/evidence.md); licenses
are in [attribution](ATTRIBUTION.md).

## Documentation

| Start here | Go deeper |
| --- | --- |
| [Product](docs/product.md) | [Architecture](docs/architecture.md) |
| [Model and evaluation](docs/language.md) | [Plan records](docs/contracts.md) |
| [Evidence and data](docs/evidence.md) | [Attribution](ATTRIBUTION.md) |
