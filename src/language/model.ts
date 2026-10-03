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

export const ENCODER_BYTES = ENCODER.files.reduce((sum, file) => sum + file.bytes, 0);
export const PROVISION_BYTES = ENCODER_BYTES + RUNTIME_WASM.bytes;

export function encoderFileUrl(path: string): string {
  return `https://huggingface.co/${ENCODER.id}/resolve/${ENCODER.revision}/${path}`;
}
