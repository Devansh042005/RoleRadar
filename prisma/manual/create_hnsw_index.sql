-- Prisma's schema DSL has no way to express `USING hnsw (...)`, so this index is
-- created out-of-band from `prisma db push` / `prisma migrate`. Run once after the
-- Posting.embedding column exists:
--
--   npx prisma db execute --schema prisma/schema.prisma --file prisma/manual/create_hnsw_index.sql
--
-- HNSW over IVFFlat: HNSW needs no training step (IVFFlat requires picking a `lists`
-- count up front and retraining as the table grows) and gives better recall/latency
-- at this dataset's scale. Cosine ops match the `<=>` operator used in similarity
-- queries (src/services/postingVectorSearch.ts).
CREATE INDEX IF NOT EXISTS posting_embedding_hnsw_idx
  ON "Posting" USING hnsw (embedding vector_cosine_ops);
