/**
 * The pinned multilingual sentence encoder and the inference runtime it needs.
 * Every file is fetched once, checked against these sizes and hashes, and kept on the device.
 */
export type PinnedFile = { readonly path: string; readonly bytes: number; readonly sha256: string };

export const ENCODER = Object.freeze({
  id: 'Xenova/multilingual-e5-small',
  revision: '761b726dd34fb83930e26aab4e9ac3899aa1fa78',
  dimensions: 384,
  /** Quantization of the ONNX export; the file below is its int8 weights. */
  dtype: 'q8' as const,
  files: Object.freeze<PinnedFile[]>([
    { path: 'tokenizer_config.json', bytes: 443, sha256: 'a1d6bc8734a6f635dc158508bef000f8e2e5a759c7d92f984b2c86e5ff53425b' },
    { path: 'tokenizer.json', bytes: 17082730, sha256: '0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39' },
    { path: 'onnx/model_quantized.onnx', bytes: 118308185, sha256: 'f80102d3f2a1229f387d3c81909990d8945513e347b0eab049f7de3c6f98c193' },
  ]),
});

/** ONNX Runtime Web CPU build, served from the app's own origin rather than a CDN. */
export const RUNTIME_WASM: PinnedFile & { readonly version: string } = Object.freeze({
  path: 'ort-wasm-simd-threaded.wasm',
  bytes: 11133407,
  sha256: 'f061472c6e77d6d50d079aacdc0ff9b63fee287ddd2cbf46cf62438d3891de2b',
  version: '1.22.0-dev.20250409-89f8206ba4',
});

/**
 * The same encoder keeping only vocabulary written in Latin or Korean script, digits, punctuation
 * and symbols (120,005 of 250,002 tokens), derived by scripts/language/trim.mjs and served from the
 * app's own origin when present. Text in those scripts gets identical embeddings.
 */
export const TRIMMED_ENCODER = Object.freeze({
  name: 'latin-hangul',
  directory: '/models/multilingual-e5-small-latin-hangul/',
  files: Object.freeze<PinnedFile[]>([
    { path: 'tokenizer_config.json', bytes: 443, sha256: 'a1d6bc8734a6f635dc158508bef000f8e2e5a759c7d92f984b2c86e5ff53425b' },
    { path: 'tokenizer.json', bytes: 4273447, sha256: 'c6af844f876b7a3e4e851acf5376055abee70157e660116afafbfb46a02bf53b' },
    { path: 'onnx/model_quantized.onnx', bytes: 68375897, sha256: '585102c0ca4bbc773efb5f44e659fe0a1d2f2f5076b4a6b00d41292d3be90266' },
  ]),
});

const total = (files: readonly PinnedFile[]) => files.reduce((sum, file) => sum + file.bytes, 0);
export const ENCODER_BYTES = total(ENCODER.files);
export const TRIMMED_BYTES = total(TRIMMED_ENCODER.files);

export function encoderFileUrl(path: string): string {
  return `https://huggingface.co/${ENCODER.id}/resolve/${ENCODER.revision}/${path}`;
}
