# Architecture decisions

## One application, one process

FastAPI serves the API and built React frontend. SQLite holds document versions, active chunks, session-owned answer snapshots, tickets, and provider-call reservations. Chroma stores vector embeddings. There is no Redis, task queue, or agent framework.

This keeps local setup and the request lifecycle explainable. The cost is serialized retrieval/indexing under a process-local lock and slower long-running administration requests. Use one Uvicorn worker. Distributed operation would require coordinated indexing, distributed rate limits, job processing, and stronger identity.

## Source structure before search

Markdown headings and PDF page boundaries provide chunk metadata. Long sections split at word boundaries with bounded overlap. Chunk IDs include the document identity, a content/configuration hash, and the chunk ordinal. Changed chunking settings require reseeding/reingesting and indexing, not only reembedding old chunks.

Document IDs stay stable across replacement. Uploaded filenames are reduced to basenames and are never used as filesystem write paths. Raw normalized text remains in SQLite for preview; original upload bytes are not retained. Scanned pages with no extractable text cannot be searched without an OCR stage.

## SQLite is the active-corpus authority

When embedding during a replacement, prepare new vectors before atomically replacing the SQLite document and chunks. API uploads save text first and explicitly require subsequent indexing. Search fails closed when active chunks are not indexed.

Cross-store updates cannot be a single transaction. Search therefore applies an allowlist of active SQLite chunk IDs to Chroma, then builds returned passages from SQLite. Old vector entries cannot reappear as source text. Cleanup deletes superseded vectors when the collection is open; interrupted or cross-process cleanup can leave unreachable orphan vectors on disk. A future compaction job can reclaim these. Historic answer/ticket snapshots remain deliberate audit context.

Chroma collections are separated by embedding-model identifier. Do not mix vectors from different models or dimensions.

## Hybrid retrieval is an experiment, not a promise

BM25 is useful for literal identifiers such as E-207. Embeddings can retrieve paraphrases. Reciprocal Rank Fusion combines their ranks; it does not assume cosine distance and BM25 scores share a scale. Retrieve candidates from each path, combine, then keep a bounded context.

This version has no reranker or semantic chunker. Add either only after held-out evidence of a weakness and a development-set experiment demonstrating a useful tradeoff. Hybrid is allowed to lose to semantic-only search.

## Citation validation and semantic support are separate

1. Structured generation returns short claims with explicit chunk IDs.
2. Deterministic validation checks that citations refer to supplied chunks.
3. A separate model call assesses each claim against its cited passages.
4. Missing, duplicate, incomplete, or unsupported verdicts prevent an asserted answer.
5. The UI displays checked claims rather than a parallel unchecked summary.

An abstention without factual claims can retain its clarifying question. Model agreement is not truth: the same model may share errors between generation and judging. The UI calls this an assessment, never a calibrated probability. Independent human review remains necessary, particularly for conflicts and malicious content.

## Recorded examples are a separate product mode

Recorded mode accepts only listed questions and resolves saved evidence anchors against the fictional corpus. It returns no provider usage and clearly marks support as not live verified. It cannot answer arbitrary questions. Live failures are errors, not invitations to silently substitute a fixture.

## Scope access at every endpoint

Public mode exposes only seeded documents and disables document administration entirely. Local mode supports workspace-wide uploaded documents with token-protected writes. Seed documents are immutable from the UI. A random HttpOnly cookie identifies a private browser session; answer lookup, handoff, ticket list, ticket detail, and ticket update all scope by that identity.

This is not multi-tenant authentication. A stolen session cookie is a bearer credential. In production, use account authentication, retention controls, HTTPS, secure cookies, and explicit administrator roles. The current inbox records local drafts and never sends external messages.

## Keep provider spending visible

Every operation reserves a slot atomically in SQLite before making a provider call. Failures count too. Timeouts, output limits, upload/chunk bounds, and no automatic retries constrain amplification. Optional token prices are estimates; a call-count cap is not a dollar cap. In-process IP limits are suitable only for a single process behind a correctly trusted proxy.

## Evaluation provenance matters

The evaluator records dataset SHA-256, source hashes, settings, model identifiers, timestamps, errors, and raw case outcomes. Dataset annotations are AI-drafted, not verified ground truth. Deterministic tests use a deliberately crude fake embedder and cannot establish real retrieval quality. See the evaluation protocol for denominator definitions and manual answer-quality grading.
