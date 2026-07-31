// Board tokens for the Greenhouse adapter (src/adapters/greenhouseAdapter.ts). Each
// token is a company's board slug in https://boards-api.greenhouse.io/v1/boards/{token}/jobs.
// Verified against the live API (200 + non-empty jobs array) before adding — a stale
// or wrong token 404s per-board (handled gracefully by the adapter) rather than
// crashing the whole poll, so it's safe to prune/add entries here without touching
// adapter logic.
// Trimmed to 3 boards for a fast/cheap first validation pass (each triggers a real
// extraction API call per posting). All verified live and engineering-heavy; add the
// rest back here later with no code changes once this looks good — that's the point
// of keeping the list in config.
export const GREENHOUSE_BOARDS = ['robinhood', 'coinbase', 'gitlab'] as const;
