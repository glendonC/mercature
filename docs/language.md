# Message understanding

A small multilingual model on the phone reads a visitor's message and answers three questions from fixed lists: is it a problem, praise or a question; for a problem, which of six issue types; and which of the site's named features it most likely concerns (up to three, best first). When it is not sure it says so, with a reason, and Noor decides. It never writes free text, so it cannot invent a place or a promise.

## What runs on the phone

- **Encoder.** [multilingual-e5-small](https://huggingface.co/intfloat/multilingual-e5-small/blob/614241f622f53c4eeff9890bdc4f31cfecc418b3/README.md) (MIT, 12 layers, 384 dimensions), as the int8 ONNX file of the [Xenova export](https://huggingface.co/Xenova/multilingual-e5-small/tree/761b726dd34fb83930e26aab4e9ac3899aa1fa78) pinned at revision `761b726d`. It follows the model card: `query: ` and `passage: ` prefixes, mean pooling, normalized embeddings.
- **Runtime.** ONNX Runtime Web 1.22 (CPU WebAssembly build, one thread), served from the app's own origin, and [@huggingface/tokenizers](https://github.com/huggingface/tokenizers) 0.2.0 for the tokenizer. Transformers.js 3.8.1 was the first plan; it cannot use the CPU-only runtime in a browser (it then finds no supported device), and its default path needs the 21.6 MB WebGPU build. The same files run directly with half the runtime download.
- **Heads.** Three small logistic regressions trained on labeled example messages, in a 16 KB JSON file shipped with the app (`src/language/heads.json`).
- **Same code everywhere.** The browser and the evaluation scripts share the tokenizer, the WebAssembly runtime, the pooling and the decision code (`src/language/policy.ts`). On the 51 dev messages the browser and Node gave identical decisions.

One-time download, kept in the browser's Cache Storage after SHA-256 checks. The app serves a trimmed copy of the encoder from its own origin (see the size study); where those files are not deployed it downloads the pinned files from the Hugging Face Hub instead. Both give the same answers for English, Spanish, Korean and Quechua.

| File | Trimmed, from the app | Pinned, from the Hub |
| --- | ---: | ---: |
| `onnx/model_quantized.onnx` (encoder, int8) | 68,375,897 | 118,308,185 |
| `tokenizer.json` | 4,273,447 | 17,082,730 |
| `tokenizer_config.json` | 443 | 443 |
| `ort-wasm-simd-threaded.wasm` (runtime) | 11,133,407 | 11,133,407 |
| **Total** | **83,783,194** | **146,524,765** |

The app shell gains about 125 KB, precached by the service worker: the language code (84 KB, 27 KB gzipped), the heads (16 KB) and the runtime loader (21 KB). The 11 MB runtime binary is not precached for every visitor; it is stored with the model when Noor asks for it.

## How a message is answered

1. The message and every feature are embedded. A feature is one passage (its names, its description and all its aliases) plus one short word list per language for English, Spanish and Korean. Its score averages the passage's cosine with its best word list's cosine. Only the order is used, never the value.
2. **Kind.** If the most likely kind is below 0.76, or the message does not look like English, Spanish or Korean (see the language check below), the answer is *Not sure* (`unclear-kind`).
3. **Issue type**, for problems. Below 0.55, *Not sure* (`unclear-kind`); the place candidates are still offered.
4. **Place or not.** Below 0.58, the message is about no place, such as price, booking or taste (`no-place`), and no features are offered.
5. **Which place.** If the top two features' scores are within 0.005, *Not sure* (`unclear-place`), with the three best offered in order. Otherwise the answer is ready.

The kind and issue-type heads do not read the embedding directly. Each reads the message's similarity to short passages describing every label, three per label in English, Spanish and Korean (`scripts/language/labels.mjs`). These passages paraphrase the label definitions written for the data before any message existed. The place head reads the full 384-dimensional embedding.

**Reuse.** None of the heads refers to the farm's feature names: a new site needs its spot list with aliases, and its layout for the path check. The heads were trained only on messages about this farm, though, so a new site should still be checked with a few labeled messages of its own before trusting them.

## Data

| File | Messages | Use |
| --- | ---: | --- |
| `scripts/language/messages.json` | 253 (77 families) | train 114, dev 51, held-out 88 |
| `scripts/language/messages-train-extra.json` | 150 (50 families) | training only |

Both files are synthetic, written by a large language model for this project, under CC0-1.0. Each family is one message written in English, Spanish and Korean as separate paraphrases with the same labels. 22 families also have a Southern Quechua (Cusco-Collao) machine translation. No text has been reviewed by a native speaker and no message comes from a real visitor.

Labels: message kind, issue type for problems (two for two-concern messages), and the features meant. Case types: direct and indirect problems, praise of a place and in general, questions about a place and in general, negations ("the pots were not in the way at all"), resolved problems, vague complaints, two concerns in one message, and off-topic problems (price, taste, timing).

Splits are by family, so translations and paraphrases of one message never cross splits. The 22 Quechua families form the held-out set, so Quechua is never used for training or thresholds. Quechua is not among the languages of XLM-R, the base of multilingual-e5-small, while English, Spanish and Korean are. Every English message was read to check labels before the split; the extra training families were written without access to the evaluation file.

Not covered: real visitor writing (length, spelling, slang, mixed languages), other sites, long reviews, voice, and any review by native speakers.

## Training and thresholds

Each head is an L2-regularized, class-balanced logistic regression. Regularization and all thresholds come from out-of-fold predictions: the 315 train, dev and extra-training messages are split into 5 folds by family, and no message is scored by a head that saw it. Each threshold maximizes correct answers minus three times confident wrong answers; the place threshold maximizes balanced accuracy. The final heads are then fitted on all 315 messages.

Out-of-fold estimates before the held-out run: kind 269 of 315, issue type 123 of 177 problems, place or not 294 of 306. Feature ranking has no trained parameters; on train and dev messages naming a feature it put a right one first in 205 of 228 and in the top three in 223 of 228.

How each feature is embedded was chosen on the same train and dev messages (top-1 ranking, of 132 before the extra training families existed):

| Passage | Top-1 | Top-3 | English | Spanish | Korean |
| --- | ---: | ---: | ---: | ---: | ---: |
| Description only | 50 | 89 | 27/44 | 12/44 | 11/44 |
| Names and description | 75 | 107 | 37/44 | 28/44 | 10/44 |
| Names, description and all aliases | 99 | 127 | 38/44 | 36/44 | 25/44 |
| Best of description and per-language alias lists | 105 | 123 | 40/44 | 28/44 | 37/44 |
| Average of full passage and best alias list (shipped) | 113 | 129 | 41/44 | 34/44 | 38/44 |

Quechua aliases stay in each feature's full passage but get no separate word list: one- to three-word lists, several of them Spanish loanwords, embedded close to everything and pulled unrelated messages (top-1 rose from 201 to 205 of 228 without them).

## Preregistered held-out evaluation

Frozen before the held-out set was scored:

- Heads `b6a40a3cfcfa` (`src/language/heads.json`, SHA-256 `cae6f446…80c1e6`) with thresholds kind 0.76, issue type 0.55, place 0.58, margin 0.005.
- Held-out set: the 88 messages with `"split": "test"` in `messages.json` (SHA-256 `0a6aa395…d2ee3e`), 22 families in English, Spanish, Korean and Quechua.
- Model file `model_quantized.onnx` (see the size study below).
- One run of `node scripts/language/evaluate.mjs test`, with fresh inference for every message.

These were committed under the title "Freeze the understanding heads, thresholds and held-out protocol before evaluation" before the run; the results below were added afterwards without changing them.

Reported: feature top-1 and top-3, both features of two-concern messages in the top three, kind and issue-type accuracy, place-or-not accuracy, confident answers and how many were right, and whether each case type got what a person should see (a right answer or *Not sure*, never a confident wrong one; praise, negations and resolved problems not reported as problems; vague complaints marked *Not sure*; messages about no place left without features). Everything is broken down by language, with the exact-alias baseline from `src/language/index.ts` alongside.

## Held-out results

One run on the 88 held-out messages, with the frozen heads and thresholds. "As expected" means a person sees a right answer or *Not sure*, never a confident wrong one; for praise, negations and resolved problems it means the message is not reported as a problem, and for messages about no place that no feature is offered.

| Language | Top-1 | Top-3 | Kind | Issue type | Place or not | Confident and right | As expected | Alias baseline finds the feature |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| English | 15/16 | 16/16 | 19/22 | 7/12 | 19/20 | 7/10 | 20/22 | 15/16 |
| Spanish | 16/16 | 16/16 | 19/22 | 8/12 | 20/20 | 5/6 | 21/22 | 15/16 |
| Korean | 15/16 | 15/16 | 18/22 | 8/12 | 19/20 | 7/10 | 18/22 | 16/16 |
| **English, Spanish, Korean** | **46/48** | **47/48** | **56/66** | **23/36** | **58/60** | **19/26** | **59/66** | 46/48 |
| Quechua | 5/16 | 10/16 | 11/22 | 2/12 | 19/20 | 1/9 | 9/22 | 2/16 |

| Case (English, Spanish, Korean) | As expected |
| --- | ---: |
| Direct problem | 15/18 |
| Problem with the place described, not named | 5/6 |
| Two concerns (both features in the top three: 3/3) | 3/3 |
| Vague complaint | 5/6 |
| Off-topic problem (price, taste, timing) | 3/3 |
| Praise of a place | 6/6 |
| General praise | 3/3 |
| Negation | 6/6 |
| Resolved problem | 3/3 |
| Question about a place | 5/6 |
| Question about no place | 5/6 |

- **Ranking.** In English, Spanish and Korean the right feature came first for 46 of 48 messages that name one, and was in the top three for 47.
- **Not sure.** Of the 66 English, Spanish and Korean messages, 26 got a confident answer, 11 were marked as about no place (10 rightly; one was praise of a place), and 29 got *Not sure* with candidates, mostly because the issue type was below its threshold. 11 of the 12 messages about no place were left without features.
- **Confident errors.** 7 of the 26 confident answers were wrong, more than out-of-fold testing suggested. Two polite complaints that end with a request ("could it be kept off to the side?") were taken as questions. A Korean complaint that the sign is only in Spanish was taken as praise, and a Korean question about a step at the restroom as a problem. Tree roots were filed under a blocked path instead of steps or slope. A resolved complaint about the gate ranked the welcome sign first. A vague complaint about slippery ground got the muddy patch with confidence.
- **Against exact aliases.** The alias baseline finds the right feature about as often (46 of 48), because the aliases cover these messages' words well. It cannot tell praise or a negation from a complaint: it would flag a place for all 15 praise, negation and resolved messages, where the model reported none of them as a problem.
- **Quechua fails.** The model takes most Quechua messages for praise, ranks the right feature first for 5 of 16 and gives 9 confident answers, only 1 of them right. Its 9 of 22 "as expected" mostly come from praise and negations that it called praise anyway. This matches Quechua being outside the encoder's listed languages; today a Quechua message can get a confident wrong answer.

The same run in Chromium (production build, same Mac) gave identical decisions for all 88 messages. With the shipped heads, `int8` and `uint8` would have scored 68 and 71 of 88 "as expected" against 68 for the shipped file, a difference within noise for 0.2% fewer bytes.

### Language check, added after the held-out run

Because a Quechua message could get a confident wrong answer, a check was added after the held-out run; it is not part of the preregistered results above. A message that has no Korean script and fewer than one common English or Spanish function word per ten words (`looksSupported` in `src/language/policy.ts`) gets *Not sure*, with candidates still offered in order when the message seems to be about a place.

- On the 315 train, dev and extra-training messages it flagged none. A first version with one function word per seven flagged one ("Muddy patch was super slippery, nearly fell"), so the ratio was set on that data.
- Re-running the held-out set with it: no English, Spanish or Korean answer changed, and all 22 Quechua messages now get *Not sure*, where 9 had received confident answers, 1 of them right.
- This shows only that the tool now abstains on Quechua. It says nothing about understanding Quechua, and very short English or Spanish messages without function words ("Excelente tour!") also get *Not sure*.

## Speed

On the development Mac (Apple M5 Max, one inference thread):

| Step | Node | Chromium 145 |
| --- | ---: | ---: |
| Read, check and create the inference session | 0.5 s | |
| Embed the farm's 17 features (`prepareSite`) | | 1.8 to 2.1 s |
| Embed the 27 label passages and the 17 features | 2.3 s | |
| One message, median | 26 ms | 29 ms |
| One message, 95th percentile | 38 ms | |
| First message after a cold restart, model stored (load, embed, answer) | | 2.7 to 2.9 s |

A phone will be several times slower; no phone has been measured. Feature embedding happens once per place and session, and `prepareSite` can do it before the first message.

## Offline

`prepareModel()` downloads the four files once with real byte progress, checks each against its pinned SHA-256 and stores it in Cache Storage. Afterwards nothing is fetched: the runtime reads the stored files, and a missing file makes loading fail instead of downloading. `understand()` loads a stored model by itself and never downloads; `modelStored()` tells the interface whether a model is on the device.

Checked with `scripts/language/browser.mjs` on a production build that uses the app's own service worker: after provisioning, Chromium was closed and reopened on the same profile with networking disabled. The page came from the service worker, the model state started `absent`, and a new message was understood with no network request. On iPhone, Safari deletes a site's stored data after seven days of browsing without a visit unless the site was added to the home screen, so the model would need downloading again.

## Size study

Published ONNX files of the same export at revision `761b726d`:

| File | Bytes |
| --- | ---: |
| `model.onnx` (fp32) | 470,268,533 |
| `model_q4.onnx` | 398,649,233 |
| `model_bnb4.onnx` | 397,322,585 |
| `model_fp16.onnx` | 235,336,732 |
| `model_q4f16.onnx` | 204,777,691 |
| `model_quantized.onnx` (shipped) | 118,308,185 |
| `model_uint8.onnx` | 118,054,630 |
| `model_int8.onnx` | 118,054,593 |

The 4-bit and fp16 files are larger because most of the model is its 250,000-token embedding table, which those formats leave in 16 or 32 bits. `int8` and `uint8` would save 253,592 bytes (0.2%). Used in place of the shipped file with the same heads, on dev they were no better: top-1 33 and 35 of 39 against 36, confident answers 17 and 24 of 51 against 27. The shipped file stays.

**Smaller vocabulary.** Most of the encoder is its 250,002-token vocabulary, and English, Spanish, Korean and Quechua can only ever use the tokens written in Latin or Korean script, digits, punctuation and symbols. `scripts/language/trim.mjs` keeps those 120,005 tokens: it rewrites the tokenizer and keeps the matching rows of the int8 embedding table, leaving every other weight unchanged. On all 498 texts the evaluation uses (every message, label passage and feature passage) the trimmed encoder produced the same tokens and bit-identical embeddings (`scripts/language/verify-trim.mjs`), so its answers are the same on dev and held-out alike; the held-out re-run gave identical decisions and rankings for all 88 messages. The download falls from 146,524,765 to 83,783,194 bytes (43% less). Text in other scripts, such as Japanese or Russian, would become unknown tokens. The derived files are reproducible from the pinned ones (same hashes on every run) but are not on the Hub, so the app serves them itself and falls back to the Hub files when they are missing.

## Earlier trial

An earlier trial with the same encoder accepted a feature only when its cosine similarity was at least 0.85. The model card says these scores cluster between 0.7 and 1.0 and only their order matters, so the cutoff suppressed correct answers along with wrong ones: 1 of 13 expected features found, even though the right feature ranked first for every positive message. This version uses order only, and learned heads for everything else.

## Reproduce

Node 24 or newer, from the repository root:

```sh
node scripts/language/provision.mjs
node scripts/language/passages.mjs
node scripts/language/train.mjs
node scripts/language/evaluate.mjs dev
node scripts/language/trim.mjs
node scripts/language/verify-trim.mjs
npx vite build --config scripts/language/harness/vite.config.ts
node scripts/language/browser.mjs dev
```

`provision.mjs` downloads the pinned files into `.local/language/model` and checks their hashes. `trim.mjs` writes the trimmed encoder to `public/models/` (not in version control), where the app serves it; it needs [uv](https://docs.astral.sh/uv/) to run the ONNX edit with `onnx` and `numpy`. `evaluate.mjs` takes `--variant latin-hangul` to evaluate it. `browser.mjs` builds nothing; it serves the harness build, provisions the model in Chromium (the trimmed files if `public/models/` has them, otherwise the Hub URLs, redirected to the local files unless `--hub` is given), answers every message in the split, then restarts the browser with networking disabled and answers a new one. Results go to `.local/language/`.
