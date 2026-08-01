# How Postings Get Sourced

RoleRadar aggregates postings from two public sources through a small adapter interface (`JobSourceAdapter`), rather than scraping — each adapter calls a public API and maps its response into a common `RawPosting` shape before anything downstream sees it.

## RemoteOK

The RemoteOK adapter calls RemoteOK's public `/api` endpoint, which returns a JSON array of listings. The first element of that array is a metadata/legal-notice object, not a job — the adapter drops it before mapping the rest. A listing is only kept if it has a company, a position (title), and a description; anything missing one of those three is silently skipped rather than ingested with blank fields. RemoteOK postings tend to be shorter and less structured than Greenhouse ones, since RemoteOK doesn't enforce any particular job-description format on the companies that post through it.

## Greenhouse

The Greenhouse adapter is board-based: RoleRadar maintains a fixed list of Greenhouse board tokens (`GREENHOUSE_BOARDS`), one per company using Greenhouse's public job board API, and fetches each board's `/jobs?content=true` endpoint separately. Boards are fetched with bounded concurrency (3 at a time) rather than all at once or fully sequentially — polite to a shared public API serving many boards, without making a full poll cycle wait on the slowest board times the board count. A single board failing (network error, 404 from a stale token, unexpected response shape) is logged and treated as zero postings from that board — it never aborts the rest of the poll. Greenhouse's job `content` field is HTML, including a Greenhouse-specific quirk where `&nbsp;` is double-encoded (appears as literal `&amp;nbsp;`) while other entities like `&lt;` are single-encoded — the shared `sanitizeJobText` function handles this by decoding entities in a bounded loop until the text stabilizes, then stripping tags.

## What happens after fetch

Both adapters only fetch and normalize — everything after that is shared, source-agnostic pipeline: `ingestPostings` computes a SHA-256 hash of each posting's raw text and skips it as a duplicate if a posting with that exact hash already exists (so re-polling the same sources repeatedly is safe and cheap), then creates the `Posting` + `Company` + `PostingRaw` rows for anything new. Each newly inserted posting is immediately run through `extractPostingSkills` (Claude-based structured extraction of skills/seniority/role category), then embedded — both the whole-posting embedding used for matching and the chunk-level embeddings used for retrieval here.

## Why there's no scheduled worker fetching this automatically

Polling is triggered externally (an HTTP call to `POST /internal/jobs/poll/:adapterName`, meant to be hit by a scheduler like GitHub Actions or Render Cron) rather than by an always-on background worker — see the main README for the cost reasoning. Practically, this means RoleRadar's posting data is only as fresh as the last time that endpoint was called; there is no continuous background ingestion happening between polls.
