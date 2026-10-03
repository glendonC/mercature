import type { Tokenizer } from '@huggingface/tokenizers';
import type { InferenceSession, Tensor } from 'onnxruntime-web/wasm';

/**
 * One sentence embedding: tokenize, run the encoder, mean-pool over tokens, L2-normalize,
 * as the multilingual-e5 model card specifies. The browser and the evaluation scripts both use this.
 */

/** The encoder's position limit; longer inputs keep their first tokens and the end marker. */
export const MAX_TOKENS = 512;

type TensorClass = new (type: 'int64', data: BigInt64Array, dims: readonly number[]) => Tensor;

export function createEmbedder(tokenizer: Tokenizer, session: InferenceSession, TensorType: TensorClass) {
  let queue: Promise<unknown> = Promise.resolve();
  async function run(text: string): Promise<number[]> {
    let ids = tokenizer.encode(text).ids;
    if (ids.length > MAX_TOKENS) ids = [...ids.slice(0, MAX_TOKENS - 1), ids[ids.length - 1]];
    const length = ids.length;
    const feeds: Record<string, Tensor> = {
      input_ids: new TensorType('int64', BigInt64Array.from(ids, id => BigInt(id)), [1, length]),
      attention_mask: new TensorType('int64', new BigInt64Array(length).fill(1n), [1, length]),
    };
    if (session.inputNames.includes('token_type_ids')) feeds.token_type_ids = new TensorType('int64', new BigInt64Array(length), [1, length]);
    const output = await session.run(feeds);
    const hidden = output[session.outputNames[0]];
    const values = hidden.data as Float32Array;
    const dimensions = hidden.dims[2];
    const pooled = new Float64Array(dimensions);
    for (let token = 0; token < length; token++) {
      for (let i = 0; i < dimensions; i++) pooled[i] += values[token * dimensions + i];
    }
    let norm = 0;
    for (let i = 0; i < dimensions; i++) norm += (pooled[i] / length) ** 2;
    norm = Math.sqrt(norm);
    return Array.from(pooled, value => value / length / norm);
  }
  /** Runs are queued: one inference session runs one input at a time. */
  return (text: string): Promise<number[]> => {
    const result = queue.then(() => run(text));
    queue = result.catch(() => undefined);
    return result;
  };
}
