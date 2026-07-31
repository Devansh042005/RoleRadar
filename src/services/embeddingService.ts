import { logger } from '../lib/logger';

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

// This is the single swap-point for changing embedding providers later: the public
// surface is `embed(text) -> number[]`, nothing here leaks @xenova-specific types.
type Extractor = (
  text: string,
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<{ data: Float32Array | number[] }>;

let extractorPromise: Promise<Extractor> | null = null;

// @xenova/transformers ships ESM-only; this backend runs under tsx/CJS. A static
// top-level `import` would throw "require() of ES Module" at load time — dynamic
// `import()` is the standard interop fix and also gives us the lazy-singleton load
// (model load is expensive, so do it once on first use, not per-call).
async function getExtractor(): Promise<Extractor> {
  if (!extractorPromise) {
    logger.info(
      `[embeddingService] loading ${MODEL_NAME} (first run downloads ~90MB, cached under ~/.cache after)`,
    );
    extractorPromise = (async () => {
      const { pipeline } = await import('@xenova/transformers');
      const extractor = await pipeline('feature-extraction', MODEL_NAME);
      logger.info('[embeddingService] model loaded');
      return extractor as unknown as Extractor;
    })();
  }
  return extractorPromise;
}

/** Embeds text into a 384-dim vector using all-MiniLM-L6-v2. */
export async function embed(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}
