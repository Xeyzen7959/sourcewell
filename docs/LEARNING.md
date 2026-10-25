# Learn Sourcewell by following one request

## 1. Begin with the browser

Read `frontend/src/Ask.tsx`. The form sends question, mode, and search strategy to `/api/ask`. Recorded mode uses a fixed scenario list. Live mode requires a server key and indexed documents. The interface handles errors without replacing them with a saved answer.

Open a citation in `frontend/src/ui.tsx`. The source panel shows the exact text associated with the citation, not an entire document with an unverifiable link. React renders this as text rather than interpreting document HTML.

## 2. Follow the API

Read `backend/main.py`. Find session/security middleware, `/api/ask`, `/api/handoffs`, and `/api/tickets/{ticket_id}`. Notice that every ticket operation checks its owner, not just the list endpoint.

Try explaining why an unpredictable ticket ID alone is not authorization, and why server-side ownership checks still matter.

## 3. Understand retrieval

Read `backend/retrieval.py` in this order: `extract`, `chunk_pages`, `rrf`, `Retriever.search`.

- A document is split into passages small enough for a model context.
- Embeddings represent passages and queries as vectors. Their proximity is a retrieval signal, not truth.
- BM25 ranks literal terms; it helps retain identifiers such as error codes.
- RRF combines ranked lists using `1 / (k + rank)` for each list.
- The active SQLite corpus controls which vectors can become results.

Exercise: explain why deleting a SQLite document without filtering vector retrieval could expose obsolete results. Then find the test that covers replacement and deletion.

## 4. Separate generation from checking

Read `backend/provider.py` and `backend/models.py`. Pydantic schemas constrain the shape of the output. They do not make its content correct. Citation IDs receive deterministic validation; claim support receives a separate fallible model assessment.

Exercise: remove a referenced ID in a test and inspect the abstention. Then return a support verdict for the wrong claim index. Both should fail closed.

## 5. Follow persistence

Read `backend/store.py`. Understand the document/chunk relationship, versioning, answer snapshots, handoffs, and provider-call reservations. SQLite transactions protect each database update. They cannot atomically include an external Chroma write, so retrieval also needs an active-ID allowlist.

## 6. Read the evaluation before the numbers

Open `evaluation/README.md`, then `scripts/evaluate.py`. Explain which denominators exclude errors, why abstention needs answerable-case checks, and why model support is not correctness.

The fake provider in `backend/tests/conftest.py` exists to exercise code paths without paid calls. Its vector rankings tell you nothing about OpenAI embedding quality.

## Three concepts to learn next

1. **Retrieval evaluation:** create source annotations, measure Recall@k, and examine failure cases before tuning.
2. **Trust boundaries:** validate external inputs, scope persisted data, and treat retrieved instructions as untrusted content.
3. **Experimental design:** keep held-out cases separate, record configurations, and resist reporting flattering but incomplete metrics.

## Questions to prepare for an interview

- Why combine BM25 with vector retrieval?
- Why choose rank fusion over a weighted sum of raw scores?
- What happens when indexing fails after an upload?
- Which checks are deterministic, and which depend on a model?
- How do you keep public visitors from seeing another session’s tickets?
- What did you measure, and what remains unverified?
- What would need to change before running this for real customers?
