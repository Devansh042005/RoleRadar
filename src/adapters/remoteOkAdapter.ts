import type { JobSourceAdapter, RawPosting } from './types';

const REMOTEOK_API_URL = 'https://remoteok.com/api';
const USER_AGENT = 'SkilltraceBot/0.1 (+https://github.com/skilltrace; job-intel dashboard)';

export class RemoteOkFetchError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'RemoteOkFetchError';
    this.cause = cause;
  }
}

interface RemoteOkJob {
  id?: string | number;
  slug?: string;
  company?: string;
  position?: string;
  location?: string;
  description?: string;
  date?: string;
  url?: string;
  apply_url?: string;
}

function toRawPosting(job: RemoteOkJob): RawPosting | null {
  if (!job.company || !job.position || !job.description) {
    return null;
  }

  const sourceUrl = job.url ?? job.apply_url ?? `https://remoteok.com/remote-jobs/${job.id ?? job.slug ?? ''}`;
  const postedAt = job.date ? new Date(job.date) : null;

  return {
    sourceName: 'REMOTEOK',
    sourceUrl,
    companyName: job.company,
    title: job.position,
    location: job.location ?? null,
    rawText: job.description,
    postedAt: postedAt && !Number.isNaN(postedAt.getTime()) ? postedAt : null,
  };
}

export const RemoteOkAdapter: JobSourceAdapter = {
  name: 'remoteok',

  async fetch(): Promise<RawPosting[]> {
    let response: Response;
    try {
      response = await globalThis.fetch(REMOTEOK_API_URL, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
      });
    } catch (err) {
      throw new RemoteOkFetchError('Network error while fetching RemoteOK listings', err);
    }

    if (!response.ok) {
      throw new RemoteOkFetchError(
        `RemoteOK API responded with ${response.status} ${response.statusText}`,
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (err) {
      throw new RemoteOkFetchError('Failed to parse RemoteOK response as JSON', err);
    }

    if (!Array.isArray(body)) {
      throw new RemoteOkFetchError('Unexpected RemoteOK response shape: expected an array');
    }

    // The first element is a metadata/legal-notice object, not a job listing.
    const [, ...jobs] = body as RemoteOkJob[];

    return jobs.map(toRawPosting).filter((posting): posting is RawPosting => posting !== null);
  },
};
