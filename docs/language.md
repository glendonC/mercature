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
