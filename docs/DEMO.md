# Three-minute walkthrough

## 0:00–0:25 — State the problem

“Sourcewell helps support staff answer questions using company documentation, inspect the evidence, and escalate uncertainty. Cedarline Cloud is fictional. I will start in recorded mode, which makes no AI calls.”

Show the workspace and the visible recorded/live distinction. Do not imply the saved example is a live benchmark.

## 0:25–1:05 — Answer and evidence

Choose the refund question and ask. Open a citation, show the exact passage, then close it with Escape. Explain the difference between checking a source ID and checking whether it supports a claim.

If a key is configured and the corpus is indexed, separately switch to live mode and ask a different policy question. Mention that it incurs real API usage and may fail. Do not splice a recorded example into a live demonstration.

## 1:05–1:45 — Know when to escalate

Choose the recorded 30-versus-60-day retention conflict. Show the two disagreeing sources. Save a handoff. Open the specialist inbox, add a review note and draft reply, then mark it in progress. Explain that drafts stay in the app; no external customer message is sent.

## 1:45–2:15 — Inspect the source library

Search Knowledge for E-207. Open the guide and show the underlying document. Explain Markdown/text/PDF extraction, source metadata, and versioned chunks. Administrative actions require a token and are disabled in public mode.

## 2:15–2:45 — Show honest evaluation

Open Evaluation lab. Show the development and held-out split. State that cases are AI-drafted and need human review. If no real run exists, say so. If results exist, report the actual configuration, sample size, failures, and limitations.

## 2:45–3:00 — Explain one tradeoff

“I used a single FastAPI process, SQLite, and a local vector store to keep the system small and explainable. Active chunk filtering prevents obsolete vector entries from becoming search results. Before real customer use, I would add stronger authentication, distributed operating controls, and independent quality review.”

Close on the repository’s tests and architecture diagram.
