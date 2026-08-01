import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../db/prisma';
import { chunkText } from './chunkText';
import { embed } from './embeddingService';
import { setDocumentChunkEmbedding } from './chunkVectorSearch';

// Sibling to /src and /frontend at the repo root — see __dirname math below for why
// this resolves correctly from both ts-node/tsx (src/services) and compiled dist
// (dist/services), since both are exactly two directories below the repo root.
const KNOWLEDGE_BASE_DIR = path.join(__dirname, '..', '..', 'knowledge-base');

const TITLE_HEADING_RE = /^#\s+(.+)$/m;

function extractTitle(markdown: string, fallback: string): string {
  const match = markdown.match(TITLE_HEADING_RE);
  return match ? match[1].trim() : fallback;
}

/** Strips the leading `# Title` heading line so it isn't chunked/embedded as body text. */
function stripTitleHeading(markdown: string): string {
  return markdown.replace(TITLE_HEADING_RE, '').trim();
}

export interface IngestKnowledgeDocumentResult {
  documentId: string;
  title: string;
  chunkCount: number;
}

/**
 * Ingests one knowledge-base markdown file: upserts the KnowledgeDocument by
 * sourceRef, then replaces its DocumentChunk rows entirely — same
 * delete-then-reinsert idempotency as chunkAndEmbedPosting, for the same reason
 * (chunk boundaries shift whenever the source text does, and re-embedding locally
 * is free).
 */
export async function ingestKnowledgeDocument(
  filePath: string,
  fileContents: string,
): Promise<IngestKnowledgeDocumentResult> {
  const sourceRef = path.relative(KNOWLEDGE_BASE_DIR, filePath);
  const title = extractTitle(fileContents, path.basename(filePath));
  const body = stripTitleHeading(fileContents);

  const document = await prisma.knowledgeDocument.upsert({
    where: { sourceRef },
    update: { title },
    create: { sourceRef, title },
  });

  const chunks = chunkText(body);

  await prisma.documentChunk.deleteMany({ where: { documentId: document.id } });

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const text = chunks[chunkIndex];
    const vector = await embed(text);
    const chunk = await prisma.documentChunk.create({
      data: { documentId: document.id, chunkIndex, text },
    });
    await setDocumentChunkEmbedding(chunk.id, vector);
  }

  return { documentId: document.id, title, chunkCount: chunks.length };
}

export interface IngestKnowledgeDocumentsSummary {
  documentsProcessed: number;
  chunksCreated: number;
  documents: IngestKnowledgeDocumentResult[];
}

/**
 * Reads every .md file under /knowledge-base and ingests it — shared by both the
 * one-off script (ingestKnowledgeDocuments.ts) and the internal HTTP route
 * (POST /internal/knowledge/ingest), so re-ingesting after editing a knowledge-base
 * file doesn't require redeploying, the same way source polling is externally
 * triggered.
 */
export async function ingestAllKnowledgeDocuments(): Promise<IngestKnowledgeDocumentsSummary> {
  const entries = await readdir(KNOWLEDGE_BASE_DIR);
  const markdownFiles = entries.filter((entry) => entry.endsWith('.md'));

  const documents: IngestKnowledgeDocumentResult[] = [];
  for (const fileName of markdownFiles) {
    const filePath = path.join(KNOWLEDGE_BASE_DIR, fileName);
    const fileContents = await readFile(filePath, 'utf-8');
    documents.push(await ingestKnowledgeDocument(filePath, fileContents));
  }

  return {
    documentsProcessed: documents.length,
    chunksCreated: documents.reduce((sum, doc) => sum + doc.chunkCount, 0),
    documents,
  };
}
