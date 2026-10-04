<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/mark-dark.svg">
    <img src="docs/assets/mark-light.svg" width="88" alt="Mercature">
  </picture>
</p>

<h1 align="center">Mercature</h1>

<p align="center"><strong>An editable spatial accessibility model</strong></p>

<p align="center">
  An entry to the World Bank x Hack-Nation Small AI for Development challenge, tourism track.<br>
  A static Vite, React and TypeScript web app. The model runs on the device, in the browser.<br>
  Live app: <a href="https://glendonc.github.io/mercature/"><strong>glendonc.github.io/mercature</strong></a>
</p>

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

<p align="center">
  <img src="docs/assets/hero.gif" width="840" alt="The guide on the Calle Loreto steps in Cusco: a street photo with the steps outlined and OpenStreetMap's record of 5 steps with no handrail and no ramp, her answer, the way around OpenStreetMap suggests, then the route Before and Now">
  <br>
  <sub>The guide on the Calle Loreto steps, then Before / Now. Street photo by jaderbavaresco on Mapillary, CC BY-SA 4.0.</sub>
</p>

## The problem

A small tour operator like Noor, the persona in the brief, gets questions and complaints about
access from visitors who write in languages she cannot read. She has no record of what on her
route might stop a visitor, such as steps with no handrail, so she cannot answer with confidence or
warn the next group.

<sub>Peru had 4,157,469 international visitors in 2025, preliminary (MINCETUR, <a href="https://www.gob.pe/institucion/mincetur/informes-publicaciones/7619520-reportes-de-turismo-reporte-mensual-de-turismo-diciembre-2025">Reporte Mensual de Turismo, diciembre 2025</a>), and 71.7% of its employed people work in units of 1 to 10 people, 88.6% of them informally (INEI, <a href="https://m.inei.gob.pe/media/MenuRecursivo/boletines/01-informe-tecnico-empleo-nacional.pdf">mercado laboral, enero a diciembre 2025</a>). More figures, and what they do not cover, are in <a href="docs/evidence.md">evidence</a>.</sub>

## What it does

Mercature keeps a real tour route on her phone, in Cusco from the Plaza de Armas to the Qorikancha
ticket booth, built from public street photos and OpenStreetMap.

<table>
  <tr>
    <td width="50%" valign="top">
      <strong>1. The guide checks the route with her, spot by spot.</strong><br>
      At each spot that might stop a visitor, it shows the clearest street photo with the outline a
      segmentation model drew, what OpenStreetMap records there and who it affects. She answers
      what is there now. If she has no way around a set of steps, the guide shows the one
      OpenStreetMap's router suggests, and she decides whether it works.
    </td>
    <td width="50%" valign="top">
      <strong>2. She edits it.</strong><br>
      Edit adds what the photos missed or changes a spot, and lists her changes with Undo. Before /
      Now compares the route as prepared with her changes. Some spots also open in 3D, built from
      the street photos.
    </td>
  </tr>
  <tr>
    <td align="center"><img src="docs/assets/check.gif" width="260" alt="On a phone: the check card for the Calle Loreto steps, a 2023 street photo with the steps outlined and its Mapillary credit; the guide says OpenStreetMap adds 5 steps, no handrail, no ramp, and asks whether the steps are still there"></td>
    <td align="center"><img src="docs/assets/edit.gif" width="260" alt="On a phone: the same spot in 3D built from street photos, the route Before and Now, then the Edit menu with her two changes and Undo"></td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <strong>3. Visitor messages, read on her phone.</strong><br>
      A small model reads messages in English, Spanish and Korean on the phone, offline after one
      download. It places each one on the spot it means, or says it is not sure and offers up to
      three; when it cannot tell, the guide tells her to ask the visitor. The reply, in the
      visitor's language, is filled from fixed templates and her answers.
    </td>
    <td width="50%" valign="top">
      <strong>4. A route note for the next visitors.</strong><br>
      Her answers become a note for visitors in English, Spanish or Korean, which she copies.
    </td>
  </tr>
  <tr>
    <td align="center"><img src="docs/assets/messages.gif" width="260" alt="On a phone: a Korean Example message about steep stone steps, the one-time 84 MB download, the model not sure between three spots numbered on the map, her choice, a reply in Korean with Copy, then a Spanish message the guide cannot place and a reply asking the visitor where"></td>
    <td align="center"><img src="docs/assets/note.png" width="260" alt="On a phone: the route note for visitors, with English, Spanish and Korean tabs and a Copy button"></td>
  </tr>
</table>

<sub>Messages shipped with the app are labelled Example. Street photos are by Mapillary contributors under CC BY-SA 4.0, credited on screen with each photo; map data © OpenStreetMap contributors (ODbL).</sub>

## Why it is small AI

- **Small and on the device.** One model, [multilingual-e5-small](https://huggingface.co/intfloat/multilingual-e5-small)
  (MIT), int8 and trimmed to Latin and Korean script, with three small trained heads (16 KB). It is
  an 84 MB download (83,783,194 bytes stored, about 52 MB over the network because GitHub Pages
  compresses it). It runs in the browser with ONNX Runtime Web and needs no connection after that
  one download.
- **Per message.** A median of 25 to 38 ms in Chromium on the development Mac, and 156 to 221 ms
  with the CPU slowed six times. No phone has been measured.
- **Not sure, so she decides.** It answers only from fixed lists: the kind of message and the
  place's own spots. When it is unsure it says so and offers up to three spots, and she taps the
  right one. Messages that do not look like English, Spanish or Korean, such as Quechua, always get
  Not sure.
- **It learns from her, on the phone.** Each message she places on a spot leaves an example on the
  device: its numbers and a sketch of its spelling, never the text. A later message that fails the
  language check and resembles one puts that spot first, still as Not sure.
- **No generated text.** Replies, the route note and the guide's lines are written in advance and
  filled from her answers, so the model cannot invent a place or a promise.
- **Why not keywords.** Exact keyword matching finds the right spot about as often (46 of 48), but
  it would flag a place for all 15 praise, negation and resolved messages in the test, and on the
  route it picks exactly the right spots for only 3 of 34 messages.

## How it works

<p align="center">
  <img src="docs/assets/how-it-works.svg" width="840" alt="How it works. Once, on a GPU: Mapillary street photos, SAM 3 outlines, VGGT partial 3D and OpenStreetMap records, recorded once and never checked by a person, become a place package of static files, 4.3 MB for Qorikancha and 8.5 MB for Narikala. On her phone, offline: a message in English, Spanish or Korean goes through ONNX Runtime Web and three small heads to up to 3 ranked spots; a sure answer is filed on its spot, otherwise Not sure and she taps the spot; replies come from fixed templates; a memory on the device helps only messages that fail the language check. Her edits: her answers, Edit, Before and Now, and the route note and replies, stored on the device. Search for any place is the one online part, with no photos read">
</p>

- **Prepared once.** Large models ran once, on a GPU, when each route was prepared: SAM 3 outlined
  what the street photos show, such as steps and kerbs, and VGGT built partial 3D from them. With
  OpenStreetMap's records and a route on foot from Valhalla, they are packed into one package per
  place: 4.3 MB for Qorikancha and 8.5 MB for Narikala.
- **On the phone, everything else.** The app, the package and the model are static files. There is
  no server and no account; messages and her edits stay on the device.
- **No retraining for a new place.** The model compares a message with each spot's names and the
  words visitors use for it, so a new spot list is all it needs.
- **One online feature.** Search, described under [Get started](#get-started).

Details: [architecture](docs/architecture.md) and [model and evaluation](docs/language.md).

## Evidence

| Measure | Result |
| --- | --- |
| Right spot first, held-out English, Spanish and Korean messages (preregistered) | 46 of 48 |
| Right spot first on the Qorikancha route, with no retraining | 28 of 31, all 31 in the top three |
| Held-out Quechua messages that get Not sure, with the language check added after that run | 22 of 22 |
| Machine-translated Quechua, right spot first after she links three messages per spot | 9.4 of 16 (mean of 20 draws), from 5 |
| One message, median, Chromium on the development Mac | 25 to 38 ms; 156 to 221 ms with the CPU slowed six times |
| Possible barriers flagged on the Qorikancha route, from 403 street photos and OpenStreetMap | 8, at 5 spots; none checked by a person |

After one download, a browser restarted with networking off still reads a new message, with no
network request. The model's heads were trained on synthetic messages about Noor's farm from the
brief, and the route results use them with no retraining. Every test message is synthetic, written
by a large language model, and none has been reviewed by a native speaker. How each test was run,
and what failed, is in [model and evaluation](docs/language.md); the route's data and the limits of
every dataset are in [evidence](docs/evidence.md).

## Scale

- **Any place from search.** Home search finds a place on OpenStreetMap and builds a route to it
  on the device from the map alone, with no street photos read. Such a route is labelled as from
  the map.
- **Narikala, Tbilisi.** A second route, from the cable car to the fortress gate, prepared with
  the same pipeline: 1,020 m, 359 street photos, 49 possible barriers at 14 spots.
- **Add a place.** Record the route, write its spots with the words visitors use, package it and
  register it, then check the model with 10 to 20 labelled messages. The steps are in
  [architecture](docs/architecture.md#add-a-place).

## Responsible AI and limits

- It never claims widths, heights, slopes or reachability, and never says a place is accessible. A
  stretch with nothing flagged means only that nothing was flagged in its photos.
- Flags say "might". The photo outlines, the 3D and the OpenStreetMap records were made or fetched
  once and none has been checked by a person, and a way around is only OpenStreetMap's router's
  suggestion.
- The messages shipped with the app are labelled Example, and the Quechua ones also
  Machine-translated.
- The Spanish interface, and the Spanish and Korean replies and notes, have not been reviewed by a
  native speaker.
- She makes the final call. Nothing on her map changes without her tap, and she copies every reply
  herself.

Privacy, consent, bias and oversight: [responsible AI](docs/product.md#responsible-ai). Every
limit: [honesty limits](docs/product.md#honesty-limits).

## Get started

Try it at [glendonc.github.io/mercature](https://glendonc.github.io/mercature/). The 84 MB model downloads only when you tap Download on a message; after that one download, it works offline. Interface in English and Spanish. The Spanish interface, and the Spanish and Korean notes and replies, have not been reviewed by a native speaker.

Search is the one feature that goes online. Typing filters the prepared places on your device;
Enter sends the typed words to OpenStreetMap's Nominatim. Building a route asks the Valhalla server
at openstreetmap.de for the route on foot, and the Overpass API (overpass-api.de, or maps.mail.ru as
a second server) for map data near it. A built route is kept on the device. Visitor messages, her
answers and her edits never leave it.

To run it locally, you need Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open [127.0.0.1:4173](http://127.0.0.1:4173) and tap **Qorikancha**. The model downloads only when you tap Download on a message. A fresh
clone fetches the full 146,524,765-byte files from Hugging Face; to serve the trimmed 83,783,194-byte copy as the live
site does, run `bash scripts/release/model.sh` first (it needs [uv](https://docs.astral.sh/uv/); see [deploy](docs/deploy.md)). To try the installable offline build, run
`npm run build` and `npm run preview`.

## Checks

```sh
npx playwright install chromium
npm run check:fast
npm run check:ui
bash scripts/checks/gate.sh
```

- `check:fast` type-checks and runs the domain checks in about four seconds, or about twenty once the
  model is provisioned and its checks run too.
- `check:ui` runs the browser checks against a server you already started.
- `gate.sh` builds the app, starts its own preview, runs everything, and restarts a browser with
  networking off to test the offline loop.

Set `MERCATURE_PORT` to use a port other than 4173.

## Data and credits

Street photos are by Mapillary contributors under CC BY-SA 4.0, credited on every photo; this
repository ships the routes' packages in `public/places/qorikancha` and `public/places/narikala`, with
27 and 72 credited photo views. Places, paths and the records along each route are from OpenStreetMap
(ODbL), the routes on foot and the ways around from Valhalla, outlines from SAM 3, and partial 3D from
VGGT, published in thinned pieces under CC BY-SA 4.0 like the photos they come from. The model is
multilingual-e5-small (MIT), run with ONNX Runtime Web (MIT). Search uses OpenStreetMap's Nominatim,
the Valhalla server at openstreetmap.de and the Overpass API. Test messages are synthetic (CC0) and
none has been reviewed by a native speaker. The font is Outfit (SIL Open Font License 1.1), and the
guide is drawn with bot-avatars (MIT). The sources behind every figure, and what the data does not
cover, are in [evidence](docs/evidence.md); licenses are in [attribution](ATTRIBUTION.md).

## Documentation

| Start here | Go deeper |
| --- | --- |
| [Product](docs/product.md) | [Architecture](docs/architecture.md) |
| [Model and evaluation](docs/language.md) | [Deploy](docs/deploy.md) |
| [Evidence and data](docs/evidence.md) | [Attribution](ATTRIBUTION.md) |
