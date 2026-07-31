import type { JobSourceAdapter, RawPosting } from './types';
import { GREENHOUSE_BOARDS } from '../config/sourceBoards';

const USER_AGENT = 'SkilltraceBot/0.1 (+https://github.com/skilltrace; job-intel dashboard)';

// Polite to a shared public API across ~8 boards, without serializing the whole
// poll — small, bounded concurrency rather than fetching all boards at once.
const CONCURRENCY = 3;

interface GreenhouseJob {
  title?: string;
  location?: { name?: string };
  absolute_url?: string;
  updated_at?: string;
  content?: string;
  company_name?: string;
}

interface GreenhouseBoardResponse {
  jobs?: GreenhouseJob[];
}

function toRawPosting(job: GreenhouseJob, fallbackCompanyName: string): RawPosting | null {
  if (!job.title || !job.content || !job.absolute_url) {
    return null;
  }

  const postedAt = job.updated_at ? new Date(job.updated_at) : null;

  return {
    sourceName: 'GREENHOUSE',
    sourceUrl: job.absolute_url,
    companyName: job.company_name ?? fallbackCompanyName,
    title: job.title,
    location: job.location?.name ?? null,
    // Greenhouse's `content` is HTML (double-entity-encoded for &nbsp; —
    // textSanitizer.ts handles this), decoded/stripped downstream by extraction,
    // same as every other source's rawText.
    rawText: job.content,
    postedAt: postedAt && !Number.isNaN(postedAt.getTime()) ? postedAt : null,
  };
}

/**
 * Fetches one board. Never throws — a stale token, a 404, a network blip, or a
 * malformed response all log and resolve to an empty array, so one bad board can
 * never take down the rest of the poll (see fetchWithConcurrency below).
 */
async function fetchBoard(boardToken: string): Promise<RawPosting[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;

  let response: Response;
  try {
    response = await globalThis.fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
  } catch (err) {
    console.error(`[greenhouse] network error fetching board "${boardToken}":`, err);
    return [];
  }

  if (!response.ok) {
    console.error(
      `[greenhouse] board "${boardToken}" responded with ${response.status} ${response.statusText}`,
    );
    return [];
  }

  let body: GreenhouseBoardResponse;
  try {
    body = (await response.json()) as GreenhouseBoardResponse;
  } catch (err) {
    console.error(`[greenhouse] failed to parse response for board "${boardToken}":`, err);
    return [];
  }

  if (!Array.isArray(body.jobs)) {
    console.error(`[greenhouse] unexpected response shape for board "${boardToken}": no jobs array`);
    return [];
  }

  return body.jobs
    .map((job) => toRawPosting(job, boardToken))
    .filter((posting): posting is RawPosting => posting !== null);
}

async function fetchWithConcurrency(
  boardTokens: readonly string[],
  concurrency: number,
): Promise<RawPosting[][]> {
  const results: RawPosting[][] = new Array(boardTokens.length);
  let nextIndex = 0;

  async function worker() {
    for (;;) {
      const index = nextIndex++;
      if (index >= boardTokens.length) return;
      results[index] = await fetchBoard(boardTokens[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, boardTokens.length) }, worker));
  return results;
}

export const GreenhouseAdapter: JobSourceAdapter = {
  name: 'greenhouse',

  async fetch(): Promise<RawPosting[]> {
    const results = await fetchWithConcurrency(GREENHOUSE_BOARDS, CONCURRENCY);
    return results.flat();
  },
};
