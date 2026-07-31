import { createHash } from 'node:crypto';
import { prisma } from '../db/prisma';
import type { RawPosting } from '../adapters/types';
import { extractPostingSkills } from './extractPostingSkills';

export interface IngestSummary {
  fetched: number;
  inserted: number;
  duplicates: number;
}

function hashRawText(rawText: string): string {
  return createHash('sha256').update(rawText).digest('hex');
}

async function getOrCreateCompany(name: string) {
  return prisma.company.upsert({
    where: { name },
    update: {},
    create: { name },
  });
}

async function ingestPosting(posting: RawPosting): Promise<'inserted' | 'duplicate'> {
  const rawTextHash = hashRawText(posting.rawText);

  const duplicate = await prisma.posting.findFirst({ where: { rawTextHash } });
  if (duplicate) return 'duplicate';

  const company = await getOrCreateCompany(posting.companyName);

  const created = await prisma.$transaction(async (tx) => {
    const createdPosting = await tx.posting.create({
      data: {
        companyId: company.id,
        title: posting.title,
        location: posting.location,
        sourceUrl: posting.sourceUrl,
        sourceName: posting.sourceName,
        postedAt: posting.postedAt,
        rawTextHash,
      },
    });

    await tx.postingRaw.create({
      data: {
        postingId: createdPosting.id,
        rawText: posting.rawText,
      },
    });

    return createdPosting;
  });

  // Synchronous now (previously: enqueueExtraction, decoupled from this request).
  // extractPostingSkills catches and records its own failures rather than
  // throwing, so one bad posting can't abort the rest of this ingest batch.
  await extractPostingSkills(created.id);

  return 'inserted';
}

export async function ingestPostings(postings: RawPosting[]): Promise<IngestSummary> {
  let inserted = 0;
  let duplicates = 0;

  // Sequential, not Promise.all: extraction calls Claude per posting and embedding
  // runs a local CPU-bound model, so unbounded concurrency here would either blow
  // through the Ask feature's rate-limit-worthy API budget in a burst or peg the
  // process. This trades poll latency for predictable resource use — see
  // pollSource.ts for how a poll's response time is bounded on the caller's side.
  for (const posting of postings) {
    const result = await ingestPosting(posting);
    if (result === 'inserted') {
      inserted += 1;
    } else {
      duplicates += 1;
    }
  }

  return { fetched: postings.length, inserted, duplicates };
}
