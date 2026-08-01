const DEFAULT_MAX_CHARS = 800;
const DEFAULT_OVERLAP_CHARS = 150;

export interface ChunkTextOptions {
  maxChars?: number;
  overlapChars?: number;
}

/** Simple, not linguistically perfect: splits on `. ! ?` followed by
 * whitespace + a capital letter or digit, which is enough to keep related
 * sentences together for chunk packing. */
function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

/** Hard-splits a sentence that's already longer than maxChars on its own —
 * rare (e.g. an unbroken URL or list), but without this a single long
 * "sentence" would produce one oversized chunk. */
function splitOversizedSentence(sentence: string, maxChars: number): string[] {
  if (sentence.length <= maxChars) return [sentence];
  const pieces: string[] = [];
  for (let i = 0; i < sentence.length; i += maxChars) {
    pieces.push(sentence.slice(i, i + maxChars));
  }
  return pieces;
}

/**
 * Sentence-aware chunking: greedily packs sentences into chunks up to
 * maxChars, carrying the last overlapChars of the previous chunk's tail into
 * the next chunk's start, so a fact split across a chunk boundary still
 * appears whole in at least one chunk.
 */
export function chunkText(text: string, opts?: ChunkTextOptions): string[] {
  const maxChars = opts?.maxChars ?? DEFAULT_MAX_CHARS;
  const overlapChars = opts?.overlapChars ?? DEFAULT_OVERLAP_CHARS;

  const trimmed = text.trim();
  if (trimmed.length === 0) return [];

  const sentences = splitIntoSentences(trimmed).flatMap((sentence) =>
    splitOversizedSentence(sentence, maxChars),
  );

  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;

    if (current && candidate.length > maxChars) {
      chunks.push(current.trim());
      const tail = current.slice(-overlapChars).trim();
      current = tail ? `${tail} ${sentence}` : sentence;
    } else {
      current = candidate;
    }
  }

  if (current.trim().length > 0) chunks.push(current.trim());

  return chunks;
}
