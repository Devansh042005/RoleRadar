const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntitiesOnce(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity[0] === '#') {
      const codePoint =
        entity[1] === 'x' || entity[1] === 'X'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }
    return NAMED_ENTITIES[entity] ?? match;
  });
}

const MAX_DECODE_PASSES = 3;

// Greenhouse's job `content` field (verified against the live API) double-encodes
// &nbsp; specifically — it appears as literal "&amp;nbsp;" — while tags like &lt;
// and &quot; are only single-encoded. A single replace() pass can't resolve nested
// entities it just produced, so decode repeatedly until stable (bounded, since
// nothing should realistically need more than a couple of passes).
function decodeEntities(text: string): string {
  let result = text;
  for (let i = 0; i < MAX_DECODE_PASSES; i++) {
    const decoded = decodeEntitiesOnce(result);
    if (decoded === result) break;
    result = decoded;
  }
  return result;
}

function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, ' ');
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function sanitizeJobText(rawText: string): string {
  return normalizeWhitespace(stripHtmlTags(decodeEntities(rawText)));
}
