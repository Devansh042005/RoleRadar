import { RemoteOkAdapter } from '../adapters/remoteOkAdapter';
import { GreenhouseAdapter } from '../adapters/greenhouseAdapter';
import { ingestPostings, type IngestSummary } from './ingestPostings';
import type { JobSourceAdapter } from '../adapters/types';
import { badRequest } from '../lib/apiError';

export const POLLABLE_ADAPTER_NAMES = ['REMOTEOK', 'GREENHOUSE'] as const;
export type PollableAdapterName = (typeof POLLABLE_ADAPTER_NAMES)[number];

const ADAPTERS: Record<PollableAdapterName, JobSourceAdapter> = {
  REMOTEOK: RemoteOkAdapter,
  GREENHOUSE: GreenhouseAdapter,
};

export function isPollableAdapterName(value: string): value is PollableAdapterName {
  return (POLLABLE_ADAPTER_NAMES as readonly string[]).includes(value);
}

/** Same validate-and-throw-badRequest convention as lib/queryValidation.ts's
 * parse* helpers — kept here instead since "which adapter names are pollable" is
 * this module's own concept, not a generic query-param shape. */
export function parsePollableAdapterName(raw: unknown): PollableAdapterName {
  if (typeof raw !== 'string' || !isPollableAdapterName(raw)) {
    throw badRequest(
      'UNKNOWN_ADAPTER',
      `adapterName must be one of: ${POLLABLE_ADAPTER_NAMES.join(', ')}`,
    );
  }
  return raw;
}

/**
 * Fetches one source adapter's postings and ingests them (which now also runs
 * extraction + embedding synchronously per posting — see ingestPostings.ts) —
 * previously the source-poll BullMQ job's processor, now called directly from an
 * HTTP route (see routes/internalJobs.ts) instead of a scheduled/queued job.
 *
 * No automatic retry (BullMQ's attempts: 3 + exponential backoff is gone): a
 * failed poll just throws, and the caller (the route) surfaces it as a 500. Re-run
 * by calling the endpoint again — adapter.fetch() + ingestPostings() are both
 * idempotent (postings are deduped by rawTextHash), so a retry is always safe.
 */
export async function pollSource(adapterName: PollableAdapterName): Promise<IngestSummary> {
  const adapter = ADAPTERS[adapterName];
  const postings = await adapter.fetch();
  const summary = await ingestPostings(postings);

  console.log(
    `[source-poll] ${adapterName}: ${summary.fetched} postings fetched, ${summary.inserted} new, ${summary.duplicates} duplicates skipped`,
  );

  return summary;
}
