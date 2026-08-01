-- Same rationale as create_hnsw_index.sql (HNSW over IVFFlat, cosine ops to match
-- the `<=>` operator) — mirrored here for the two new chunk-level embedding columns
-- added for /api/ask's chunked RAG retrieval. Run once after the PostingChunk /
-- DocumentChunk tables exist:
--
--   npx prisma db execute --schema prisma/schema.prisma --file prisma/manual/create_chunk_hnsw_indexes.sql
CREATE INDEX IF NOT EXISTS posting_chunk_embedding_hnsw_idx
  ON "PostingChunk" USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS document_chunk_embedding_hnsw_idx
  ON "DocumentChunk" USING hnsw (embedding vector_cosine_ops);
