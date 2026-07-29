export interface RawPosting {
  sourceName: 'REMOTEOK' | 'GREENHOUSE' | 'LEVER' | 'CAREER_PAGE';
  sourceUrl: string;
  companyName: string;
  title: string;
  location: string | null;
  rawText: string;
  postedAt: Date | null;
}

export interface JobSourceAdapter {
  name: string;
  fetch(): Promise<RawPosting[]>;
}
