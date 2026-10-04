# Message understanding

A small multilingual model on the phone reads a visitor's message and answers three questions from fixed lists: is it a problem, praise or a question; for a problem, which of six issue types; and which of the site's named features it most likely concerns (up to three, best first). When it is not sure it says so, with a reason, and Noor decides. It never writes free text, so it cannot invent a place or a promise. It also learns from her: a message she links to a spot helps rank that spot for similar messages later, on the phone.

## What runs on the phone

- **Encoder.** [multilingual-e5-small](https://huggingface.co/intfloat/multilingual-e5-small/blob/614241f622f53c4eeff9890bdc4f31cfecc418b3/README.md) (MIT, 12 layers, 384 dimensions), as the int8 ONNX file of the [Xenova export](https://huggingface.co/Xenova/multilingual-e5-small/tree/761b726dd34fb83930e26aab4e9ac3899aa1fa78) pinned at revision `761b726d`. It follows the model card: `query: ` and `passage: ` prefixes, mean pooling, normalized embeddings.
- **Runtime.** ONNX Runtime Web 1.22 (CPU WebAssembly build, one thread), served from the app's own origin, and [@huggingface/tokenizers](https://github.com/huggingface/tokenizers) 0.2.0 for the tokenizer. Transformers.js 3.8.1 was the first plan; it cannot use the CPU-only runtime in a browser (it then finds no supported device), and its default path needs the 21.6 MB WebGPU build. The same files run directly with half the runtime download.
- **Heads.** Three small logistic regressions trained on labeled example messages, in a 16 KB JSON file shipped with the app (`src/language/heads.json`).
- **Same code everywhere.** The browser and the evaluation scripts share the tokenizer, the WebAssembly runtime, the pooling and the decision code (`src/language/policy.ts`). On all 88 held-out messages the browser and Node gave identical decisions.

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

**Reuse.** None of the heads refers to the farm's feature names: a new place needs its spot list with aliases, and its layout for the path check. Tested on the Qorikancha walk without retraining (below), the spot ranking and the message kind carried over. The issue type did not: it was right for 8 of 28 problems, and 3 of its confident answers were wrong. A new place therefore also needs a few labeled messages to check or retrain the issue-type head.

## Data

| File | Messages | Use |
| --- | ---: | --- |
| `scripts/language/messages.json` | 253 (77 families) | train 114, dev 51, held-out 88 |
| `scripts/language/messages-train-extra.json` | 150 (50 families) | training only |
| `scripts/language/route-messages.json` | 44 (14 families) | Qorikancha walk, evaluation only |

All three files are synthetic, written by a large language model for this project, under CC0-1.0. Each family is one message written in English, Spanish and Korean as separate paraphrases with the same labels. In the first file 22 families also have a Southern Quechua (Cusco-Collao) machine translation, and in the route file 4. No text has been reviewed by a native speaker and no message comes from a real visitor.

Labels: message kind, issue type for problems (two for two-concern messages), and the features meant. Case types: direct and indirect problems, praise of a place and in general, questions about a place and in general, negations ("the pots were not in the way at all"), resolved problems, vague complaints, two concerns in one message, and off-topic problems (price, taste, timing).

Splits are by family, so translations and paraphrases of one message never cross splits. The 22 Quechua families form the held-out set, so Quechua is never used for training or thresholds. Quechua is not among the languages of XLM-R, the base of multilingual-e5-small, while English, Spanish and Korean are. Every English message was read to check labels before the split; the extra training families were written without access to the evaluation file.

Not covered: real visitor writing (length, spelling, slang, mixed languages), places other than the farm and the Qorikancha walk, long reviews, voice, and any review by native speakers.

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
- **Quechua fails.** The model takes most Quechua messages for praise, ranks the right feature first for 5 of 16 and gives 9 confident answers, only 1 of them right. Its 9 of 22 "as expected" mostly come from praise and negations that it called praise anyway. This matches Quechua being outside the encoder's listed languages. Without the language check below, a Quechua message could get a confident wrong answer.

The same run in Chromium (production build, same Mac) gave identical decisions for all 88 messages. With the shipped heads, `int8` and `uint8` would have scored 68 and 71 of 88 "as expected" against 68 for the shipped file, a difference within noise for 0.2% fewer bytes.

### Language check, added after the held-out run

Because a Quechua message could get a confident wrong answer, a check was added after the held-out run; it is not part of the preregistered results above. A message that has no Korean script and fewer than one common English or Spanish function word per ten words (`looksSupported` in `src/language/policy.ts`) gets *Not sure*, with candidates still offered in order when the message seems to be about a place.

- On the 315 train, dev and extra-training messages it flagged none. A first version with one function word per seven flagged one ("Muddy patch was super slippery, nearly fell"), so the ratio was set on that data.
- Re-running the held-out set with it: no English, Spanish or Korean answer changed, and all 22 Quechua messages now get *Not sure*, where 9 had received confident answers, 1 of them right.
- This shows only that the tool now abstains on Quechua. It says nothing about understanding Quechua, and very short English or Spanish messages without function words ("Excelente tour!") also get *Not sure*.

## Transfer to the Qorikancha walk

The heads were trained only on farm messages. To see whether they carry over, 44 messages about the recorded walk from the Plaza de Armas to Qorikancha (14 spots in `src/site/route.ts`: six flagged stretches and eight landmarks) were written after the heads were frozen and scored once with them, without retraining (`scripts/language/route-messages.json`, synthetic, written by a large language model for this project; `node scripts/language/evaluate.mjs route`). Four spots are steps, told apart only by their landmarks.

| Language | Top-1 | Top-3 | Kind | Issue type | Confident and right | Not sure | As expected |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| English | 9/10 | 10/10 | 13/13 | 4/9 | 2/4 | 9/13 | 11/13 |
| Spanish | 9/10 | 10/10 | 11/13 | 2/9 | 2/2 | 11/13 | 12/13 |
| Korean | 10/11 | 11/11 | 14/14 | 2/10 | 3/4 | 10/14 | 13/14 |
| **English, Spanish, Korean** | **28/31** | **31/31** | **38/40** | **8/28** | **7/10** | **30/40** | **36/40** |
| Quechua | 1/3 | 2/3 | 1/4 | 0/3 | 0/0 | 4/4 | 3/4 |

- **What carried over.** The right spot came first for 28 of 31 messages and was always in the top three, including the four look-alike steps. The message kind was right for 38 of 40.
- **What did not.** The issue type was right for only 8 of 28 problems: the farm-trained head filed 19 of them, mostly step complaints, as a blocked path. Because it seldom clears its threshold, 30 of 40 messages got *Not sure* (9 of them as about no place), and all three confident errors had the right spot with the wrong issue type.
- **Exact aliases** found a right spot about as often (29 of 31) but suggested exactly the right spots for only 3 of 34, since "steps" matches all four step spots.

**Demo message.** A Korean visitor writes 코리칸차 가는 길에 성당 옆 잉카 돌담 골목에 있는 돌계단이 너무 가팔라서 어머니가 내려가시기 힘들었어요 ("On the way to Qorikancha, the stone steps in the Inca-walled alley by the church were so steep that my mother struggled to go down"). The model returns: status `unsure`, reason `unclear-kind`, kind `problem`, issue type `null` (its best guess, a blocked path at 0.47, is below 0.55), candidates `steps-340-350`, `steps-130-140`, `qorikancha-ticket-booth`. Both Calle Loreto steps fit the message and come first and second.

## Learning from the operator's confirmations

When the operator links a message to a spot ("Yes, this spot"), the phone keeps that message as an example for the place: the 384 numbers the model computed for it, a sketch of its spelling, the spot and the time, never the text. A new message that is close to a kept example, and not as close to another spot's, gets that spot first. The tool adapts to a place's visitors and to a language the encoder cannot read, such as Quechua, from the operator's own decisions: no retraining, no server, nothing leaves the phone.

- **Only the order changes.** Every message still runs through the model, and kind and issue type are always the model's own. Nothing is answered from storage.
- **A person decides.** When the memory puts a different spot first than the model, or the message is not in English, Spanish or Korean, the answer is *Not sure* with the reason `remembered`, so the screen can say the first spot is where a similar message was linked before. The memory never turns *Not sure* into a confident answer and never acts on a message the model judged to be about no place.
- **English, Spanish and Korean** are compared by embedding: the closest kept example needs a cosine of at least 0.935 and a lead of 0.005 over the closest example of any other spot. The bar is high because e5 cosines are compressed: two Korean training and dev messages about different spots reach 0.93.
- **Other languages** are compared by spelling: the cosine of their character trigram counts, hashed into 65,536 buckets (`sketch` in `src/language/memory.ts`), must reach 0.5. The encoder does not separate Quechua topics (next section), but a Quechua message about the restroom or the steps tends to share words with one the operator already linked there.
- **Storage.** The model's Cache Storage, one entry per place, keyed by model files and revision, at most 100 examples per place (oldest dropped). `remember(message, place, spotId)` adds one, linking the same message again replaces it, `forgetPlace(placeId)` deletes them (Start over) and `rememberedCount(placeId)` counts them. With no kept example every answer is exactly what it was before.

### Data for the memory

`scripts/language/memory-messages.json` (synthetic, CC0-1.0, written by a large language model for this project):

- **Farm:** a Southern Quechua (Cusco-Collao) machine translation of each of the 105 training and dev families, from their English and Spanish versions, with the family's labels.
- **Qorikancha walk:** 42 new families, three per spot, each in English, Spanish and Korean as independent paraphrases, with a Southern Quechua machine translation.

Both were written in separate sessions given only the source messages or the spot list, without access to the held-out farm messages or the route messages. No text has been reviewed by a native speaker.

### Calibration, on training and dev messages only

`node scripts/language/memory.mjs calibrate` (`scripts/language/results/memory-calibration.json`). Every training and dev message of the farm, in all four languages, is scored with memories drawn from the same families, its own family left out: k = 1, 2 and 3 examples per spot, Quechua only or all four languages, 10 draws each.

**Embedding first, then spelling.** The first design compared every message by embedding. On these messages it could not help Quechua: the single closest Quechua example named the right spot for 17 of 83 Quechua messages (20 after removing their mean), against 50 of 83 by spelling. So messages that fail the language check are compared by spelling. This was decided on training and dev messages only, before any held-out or route message was scored with a memory.

| Closest example in the same language is about the right spot | Embedding | Embedding, mean removed | Spelling |
| --- | ---: | ---: | ---: |
| English | 59/83 | 59/83 | 53/83 |
| Spanish | 56/83 | 58/83 | 63/83 |
| Korean | 68/83 | 69/83 | 53/83 |
| Quechua | 17/83 | 20/83 | 50/83 |

**Bars.** Over a grid (embedding cosine 0.80 to 0.98, lead 0 to 0.05; spelling cosine 0.05 to 0.95, lead 0 to 0.2), each bar maximizes right first spots gained minus three times right first spots lost on its own messages; ties go to the stricter pair. With those bars, right spot first (mean of 10 draws, of 86 messages per language naming one spot):

| Examples per spot | Quechua top-1 | Quechua top-3 | English top-1 | Spanish top-1 | Korean top-1 (all-language memory) |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0 | 15 | 27 | 83 | 75 | 76 |
| 1 | 25.5 | 39.5 | 83 | 75 | 76.6 |
| 2 | 33.2 | 47.1 | 83 | 75 | 77.4 |
| 3 | 36.6 | 49.8 | 83 | 75 | 77.8 |

The price: with 3 Quechua examples per spot, about half of the memory's Quechua suggestions (32.7 of 64.8 per draw) put a spot first that the message is not about, and 4.4 Quechua messages per draw lost a right first spot. They are all *Not sure*, and the model's own first spot for Quechua is right for 15 of 86.

### Preregistered evaluation

Frozen before any held-out farm message or route message was scored with a memory: the rule and its bars, the example data, the code that stores and applies the memory, the protocol in `scripts/language/memory.mjs` and the ship rule below. Committed under the title "Freeze the memory of confirmations and its evaluation before scoring held-out messages".

- **Scored:** the 88 held-out farm messages (22 per language; 16 of the machine-translated Quechua test messages name a spot) and the 44 route messages (4 in Quechua, 3 of them naming a spot), each once through the model.
- **Memory:** k = 0, 1, 2 and 3 kept examples per spot, from the training and dev families (farm) or the new route families, never from a scored family. Two memories: Quechua examples only, and examples in all four languages (4k per spot). 20 seeded draws per k; within a draw a smaller memory is part of a larger one, as an operator's memory grows.
- **Reported per language:** right spot first and in the top three (mean over draws, worst and best draw), confident answers and confident wrong answers, answers as expected, answers the memory changed, false triggers (the memory put a spot first that the message is not about, including messages about no spot), right first spots gained and lost, and for spelling matches whether the message shares a word, or a spot's name or alias, with its closest kept example.
- **Ship rule:** (1) with no examples every decision equals the published runs, 88 of 88 and 44 of 44, in Node and in the browser; (2) Quechua: with the Quechua memory at k = 3, the right spot comes first for at least 3 more of the 16 held-out Quechua farm messages naming one (mean over draws), and top-3 does not fall; (3) English, Spanish and Korean: for each language, place, memory and k, the mean over draws of top-1, top-3 and answers as expected is not below k = 0, and confident wrong answers are not above it.

### Limits

- **Tiny samples.** 16 Quechua farm messages naming a spot and 3 on the route. One message more or less moves the Quechua figures by 6 points on the farm and 33 on the route.
- **Machine-translated Quechua.** Every Quechua text, examples and scored messages alike, is a language model's translation that no native speaker has read. Real Quechua spelling varies (loanwords, vowels, a mix with Spanish), and spelling matches depend on it.
- **Same kind of author.** Examples and scored messages were written by the same kind of model, so they may share wording more than real visitors would. The gains are an upper bound for what an operator would see.
- **Only what was confirmed.** The memory helps with messages close to ones already linked; a new way of describing a spot gets no help until the operator links one like it.
- **Derived from the text.** An embedding and a spelling sketch are not the message, but both are computed from it, and a sketch of a short message says a lot about its words. They stay on the phone; Start over or clearing the site's data deletes them.

## Speed

On the development Mac (Apple M5 Max, one inference thread):

| Step | Node | Chromium 145 | Chromium, CPU slowed 6× |
| --- | ---: | ---: | ---: |
| Read, check and create the inference session | 0.5 s | | |
| Embed the farm's 17 features, first time (`prepareSite`) | | 1.8 to 2.2 s | 13.1 to 13.6 s |
| Embed the Qorikancha walk's 14 spots, first time (`prepareSite`) | | 1.7 to 1.9 s | 10.8 to 11.5 s |
| `prepareSite` again, vectors already stored | | 0 ms | 1 ms |
| Embed the 27 label passages and the 17 features | 2.3 s | | |
| One message, median | 26 ms | 25 to 38 ms | 156 to 221 ms |
| One message, 95th percentile | 38 ms | | 255 ms |
| First message after a cold restart, model and vectors stored | | 0.3 to 0.5 s | 1.8 to 2.0 s |
| The same before spot and label vectors were stored | | 2.7 to 2.9 s | 18.2 s |

No phone has been measured. The last column uses Chromium's CPU throttling (`browser.mjs --throttle 6`) as a rough stand-in for a mid-range phone; it does not model a phone's memory, storage or heat. A place's spots are embedded once, with one progress tick per spot, and `prepareSite` can do it before the first message; later sessions read the stored vectors.

## Offline

`prepareModel()` downloads the four files once with real byte progress, checks each against its pinned SHA-256 and stores it in Cache Storage. Afterwards nothing is fetched: the runtime reads the stored files, and a missing file makes loading fail instead of downloading. `understand()` loads a stored model by itself and never downloads; `modelStored()` tells the interface whether a model is on the device, and `modelDownloadBytes()` how many bytes `prepareModel()` would download from this origin (0 once stored). The trimmed files are looked up under the app's base path, so a deploy under a sub-path serves them too.

The embeddings of the label passages and of each place's spots are stored too, keyed by model files, revision, place and a hash of the exact passages, so any change to a spot's names, description or aliases means they are computed again. Answers are never stored: every message runs through the model. A message's embedding and spelling sketch are stored only when the operator links that message to a spot (see Learning from the operator's confirmations). With stored vectors the browser gave the same decisions as Node on all 88 held-out and all 44 route messages.

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

Raw outputs are kept in `scripts/language/results/`: the preregistered held-out run (`heldout-preregistered.json`), the same set with the language check (`heldout-with-language-check.json`), the Qorikancha walk (`route.json`), the Chromium runs behind the browser figures (`browser-heldout.json`, `browser-route.json`, `browser-route-cpu6x.json`) and the memory's calibration (`memory-calibration.json`). Each has every decision, ranking and timing.


Node 24 or newer, from the repository root:

```sh
node scripts/language/provision.mjs
node scripts/language/passages.mjs
node scripts/language/train.mjs
node scripts/language/evaluate.mjs dev
node scripts/language/evaluate.mjs test
node scripts/language/evaluate.mjs route
node scripts/language/trim.mjs
node scripts/language/verify-trim.mjs
npx vite build --config scripts/language/harness/vite.config.ts
node scripts/language/browser.mjs dev
node scripts/language/memory.mjs calibrate
```

`provision.mjs` downloads the pinned files into `.local/language/model` and checks their hashes. `trim.mjs` writes the trimmed encoder to `public/models/` (not in version control), where the app serves it; it needs [uv](https://docs.astral.sh/uv/) to run the ONNX edit with `onnx` and `numpy`. `evaluate.mjs` takes `--variant latin-hangul` to evaluate it. `browser.mjs` builds nothing; it serves the harness build, provisions the model in Chromium (the trimmed files if `public/models/` has them, otherwise the Hub URLs, redirected to the local files unless `--hub` is given), answers every message in the split, then restarts the browser with networking disabled and answers a new one. Results go to `.local/language/`.
