import { PrismaClient } from '@prisma/client';

declare global {
  var __prisma: PrismaClient | undefined;
}

// Prisma's defaults (maxWait: 2000ms to acquire a transaction slot, timeout: 5000ms
// to run once acquired) are too tight for real concurrent load against Neon —
// source-poll ingestion, extraction, and embedding workers all share one connection
// pool. Observed both failure modes directly during Greenhouse ingestion: "Unable to
// start a transaction in the given time" (maxWait) and "Transaction already closed"
// at ~6.6s (timeout) — not one-off blips, reproduced across multiple runs. Raising
// both client-wide rather than special-casing any one call site.
export const prisma =
  global.__prisma ?? new PrismaClient({ transactionOptions: { maxWait: 10_000, timeout: 15_000 } });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
