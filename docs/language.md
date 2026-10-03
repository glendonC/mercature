# Bounded language matching

Korean is the first proposed local language, alongside English. The selection supports the
Seoul presentation context; it is not evidence of suitability for a particular operator.
Korean examples below are authored, unreviewed test material. No competent Korean reviewer,
operator device or real visitor corpus has been supplied. These acceptance gates remain open.

## Task boundary

Match a short concern to existing inventory IDs for operator review. Preserve the original
wording. Do not infer geometry, dimensions, movability, complaint truth, accessibility, or an
appropriate physical action. Similarity is not a confidence percentage. Negation, resolved
conditions, praise, ambiguous references and multiple concerns require review. Manual selection
must remain available without model files and after inference failure.

## Registered candidate and permissions

The publisher's [multilingual-e5-small card](https://huggingface.co/intfloat/multilingual-e5-small/blob/614241f622f53c4eeff9890bdc4f31cfecc418b3/README.md)
declares MIT and requires `query: ` and `passage: ` prefixes, mean pooling and normalized
embeddings. Publisher revision: `614241f622f53c4eeff9890bdc4f31cfecc418b3`.
The [Transformers.js export](https://huggingface.co/Xenova/multilingual-e5-small/tree/761b726dd34fb83930e26aab4e9ac3899aa1fa78)
is pinned at `761b726dd34fb83930e26aab4e9ac3899aa1fa78`. Its q8 ONNX file is 118,308,185
bytes with SHA-256 `f80102d3f2a1229f387d3c81909990d8945513e347b0eab049f7de3c6f98c193`;
tokenizer JSON is 17,082,730 bytes with SHA-256
`0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39`.
The export card links to the publisher but carries no separate license field. The trial retains
the publisher card and Microsoft's E5 repository MIT notice locally. No model redistribution
is part of the application. Authored fixtures contain no private visitor inputs or real-site
observations. The library trial uses `@huggingface/transformers` 3.8.1 (Apache-2.0), with CPU
inference only. No existing Ollama model is substituted.

## Trial protocol registered before inference

This is a feasibility experiment on the available development Mac (Apple silicon), not a target
phone benchmark. Raw artifacts, model weights, hardware details and outputs stay under ignored
`.local/language/`. Reproduction scripts accept local paths; committed files contain no machine
paths. The separate control and evaluation JSON fixtures are authored synthetic inventories
from two different imagined sites. English and Korean control/evaluation texts are distinct;
there is no training or threshold tuning. Translation validity is unreviewed.

Predeclared limits:

| Resource or decision | Limit |
| --- | --- |
| Model and tokenizer provisioning | 160 MB, no hidden first-inference download |
| Browser runtime plus app provisioning | 40 MB (must be measured before deployment) |
| Site inventory index | 100 KB; at most 32 entries |
| Message | 500 Unicode code points; 128 model tokens maximum |
| Local persisted model/runtime/index | 250 MB |
| Cold model load | 15 seconds |
| Warm single message and cached inventory | 2 seconds p95 |
| Peak process memory | 1.5 GB |
| Sustained run | 30 fresh inferences, no failure or retained-message growth |
| Candidate selection | cosine >= 0.85, at most 3 IDs, within 0.04 of highest score |
| Positive target recall | >= 85% across held-out targets |
| Wrong suggested target fraction | <= 15% of emitted candidates |
| No-match recall | >= 80% of no-match cases |
| Multiple-target coverage | all expected IDs on >= 80% of multi-target cases |
| Human review | competent Korean meaning/target review and manual-baseline comparison required |

Controls include lexical grounding, cross-language grounding, known absent objects, praise,
negation, historical resolution and multiple concerns. Held-out evaluation includes similar
objects, another site, unseen objects, vague location, mixed languages and nonspatial feedback.
A no-match annotation means no actionable current inventory concern, which is intentionally
harder than retrieving the mentioned noun. The trial records target retrieval separately from
meaning: embeddings cannot establish whether the complaint is current or true.

Compare exact alias matching against the same expected IDs, clearly labeled as a deterministic
baseline. Manual translation plus pinning, operator task time/correction effort, reference
PyTorch/export agreement, and a cold browser run with the network disconnected remain separate
required checks. Do not claim them from a Node CPU benchmark. Do not relax thresholds after
seeing results. Failed quality/resource gates keep the model unavailable in the product.

## Observed feasibility and decision

The fixed policy failed its quality gate. Local embedding inference is **not adopted** in the
application. `suggestFeatures(message, inventory)` returns an explicit unavailable/manual state;
it does not make a remote request, replay predictions, download files, or disguise alias search
as AI. `aliasBaseline` is a separate exact-alias comparator, with tests that demonstrate its
inability to distinguish praise and negation. `validateConfirmedFeatures` supports manual
selection, correction and no selection using only IDs in the current inventory.

Two fresh Node processes ran the pinned q8 export on an Apple M5 Max development Mac with
64 GiB memory, CPU provider, two inference threads and Node 24.15.0. Every extractor invocation
was awaited through tokenization, ONNX inference, pooling and conversion to 384 finite numbers.
The verification run produced 28 distinct fixture embeddings and 30 distinct sustained-run
embeddings; no prediction cache was used. These are very short inputs and a fast development
machine. They do not predict phone or browser latency.

| Check | Observed result |
| --- | --- |
| Exact model/tokenizer/config bytes | 135,392,183, SHA-256 verified |
| Pipeline load after library import | 355 ms first process; 390 ms verification process |
| Warm end-to-end query p95, 58 queries | 2.8 ms first process; 7.2 ms verification process |
| Verification process total wall time | 790 ms, independently measured by OS process timer |
| Peak RSS | 868 MB measured by OS process timer; Node reported 788 MB before disposal |
| Sustained run | 30/30 finite fresh outputs; RSS 785 MB to 788 MB, no failures |
| Network attempts | 0 with global fetch rejected and remote models disabled |
| Control fixture SHA-256 | `22783d339da3aa7f3fc383e5af9d90ca11f4b453d815d0db277c3c02e9c016c6` |
| Held-out fixture SHA-256 | `f54730e3797be612df5b34dd8df867947823a8aacc3a302708dc9fb3d365112e` |

The 30-query run is a bounded smoke test, not an energy, thermal or memory-leak study.
Networking was disabled in the benchmark process, not disconnected at the device. Browser
runtime bytes, app/index provisioning as a complete package, interrupted/resumed provisioning,
corrupt model runtime behavior, and cold offline browser workflow remain unmeasured. The
provisioner verifies complete files and atomically replaces each completed file; interruption
restarts the interrupted file rather than providing byte-range resume.

| Held-out metric | Fixed embedding policy | Exact alias baseline |
| --- | --- | --- |
| Correct targets / expected targets | 1/13 (7.7%) | 10/13 (76.9%) |
| Wrong targets / suggested targets | 0/1 (0%) | 6/16 (37.5%) |
| No-match cases correctly empty | 10/10 (100%) | 4/10 (40%) |
| Multiple-target cases fully covered | 0/3 (0%) | 2/3 (66.7%) |
| Cases with exact target set | 11/20 | 11/20 |

The positive-recall and multi-target gates failed. The fixed threshold suppressed relevant
Korean suggestions along with false positives; it was not retuned after evaluation. All ten
positive messages had a relevant top-ranked ID, but ranking alone cannot identify current
complaints. For example, a control negating obstruction scored 0.846 for the cart, higher than
the Korean sign complaint scored for its correct sign (0.786). The alias baseline incorrectly
linked praise, negation, resolved conditions and another site's similarly named feature.
Neither is a validated concern interpreter. Raw results remain local and excluded from Git.
Reference PyTorch agreement and competent language/operator reviews remain unperformed.

## Reproduce the bounded local experiment

Use Node 24 or newer. Run from the repository root; these commands install the experimental
runtime and permitted model into ignored local storage. They do not enable the application AI.

```sh
npm install --prefix .local/language/runtime --no-audit --no-fund --save-exact @huggingface/transformers@3.8.1
node scripts/language/provision.mjs
node scripts/language/benchmark.mjs
```

The provisioner accepts a model output directory as its first argument. The benchmark accepts
model directory, Transformers Node module path and output JSON path. Use a fresh process for
each cold run; do not confuse operating-system file cache with a fully cold device. Keep
outputs local. A future decision policy needs its own preregistered, independently reviewed
evaluation set rather than tuning against these held-out results.
