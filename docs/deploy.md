# Deploy

Mercature is a static site. [`pages.yml`](../.github/workflows/pages.yml) publishes `main` to GitHub Pages at https://glendonc.github.io/mercature/. The repository's Pages source must be set to GitHub Actions once.

## What the workflow does

1. Installs the app, Node.js 24 and [uv](https://docs.astral.sh/uv/).
2. Downloads the pinned encoder from the Hugging Face Hub and checks its hashes. The files are cached by encoder revision.
3. Trims the vocabulary to Latin and Hangul ([model](language.md)).
4. Stops unless the trimmed files match the sizes and SHA-256 hashes the app pins, and give identical embeddings for all evaluation texts. Otherwise the app would fall back to the larger Hub download.
5. Puts the encoder's [MIT license](../licenses/multilingual-e5-small-MIT.txt) beside the trimmed files as `LICENSE.txt`.
6. Builds and publishes `dist`.

The app then downloads the model from the site itself rather than the Hub, and the service worker keeps the app for offline use.

| First use | Bytes |
| --- | ---: |
| `onnx/model_quantized.onnx` | 68,375,897 |
| `tokenizer.json` | 4,273,447 |
| `tokenizer_config.json` | 443 |
| `ort-wasm-simd-threaded.wasm` | 11,133,407 |
| **Model total** | **83,783,194** |
| App, places and icons, precached | about 4 MB |

## Check a build like the deploy

```sh
bash scripts/release/model.sh
npm run build
npx playwright install chromium
node scripts/release/proof.mjs --serve dist
```

`serve.mjs` serves `dist` under `/mercature/` the way Pages does. `proof.mjs` uses a 390 px phone viewport:

1. Opens Home, Narikala and its 3D from its published package, then the Qorikancha reveal and route from its own.
2. Downloads the model, checks every file came from the site and that its license is served beside it.
3. Checks the service worker scope is `/mercature/`.
4. Reads the messages in the guide: the model answers the Korean demo message, and filing its first spot gives a reply with Copy.
5. Stops the server, restarts the browser with no network, answers it again, and opens Narikala and its 3D, which are kept the first time they open.

Screenshots and `report.json` go to `.local/release/`. To check the live site, pass its URL instead of `--serve dist`.

`--ui inbox` runs the same proof on the message inbox. `--browser webkit` runs the proof in Safari's engine (`npx playwright install webkit`). Playwright's WebKit cannot start the app offline, so there the model answers the second time online, from its stored copy.
