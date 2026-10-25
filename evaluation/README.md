# Evaluation protocol

The dataset contains 60 AI-drafted questions: 38 development cases and 22 held-out cases. Every case requires human review. The corpus is fictional, so these questions do not establish performance on real customer traffic.

## Before measuring

Review each question, expected status, document annotations, and expected-behavior rubric against the source documents. Fix mistakes and update dataset version/provenance. Reviewers should record who reviewed which cases and when before changing `review_status` to a human-reviewed state. Do not let an AI tool mark its own cases human-verified.

Use the local Evaluation lab case dialog to review evidence and enter corrections, reviewer identity, and an explicit human attestation. The server records UTC review dates. `DATA_DIR/reviews.json` stores an append-only history of human-entered annotations and answer grades. Export with the UI or `uv run python -m scripts.manage export-reviews`, inspect the diff, and commit `evaluation/reviews.json` deliberately. Public mode cannot modify or export these records through administrator endpoints.

An annotation is valid only for its base dataset and source-corpus fingerprints. Its corrections do not change split membership. When a source or base dataset changes, the previous review remains in the audit history but no longer makes the changed case human-reviewed. No actual annotations were human-reviewed by the development agent.

Use development cases to select chunk size, retrieval settings, prompts, and models. Keep held-out cases untouched until a final assessment. Once repeatedly inspected for tuning, the held-out set is no longer an honest final test; create a new one.

## Execute

```bash
uv run python -m scripts.evaluate --split development --limit 2
uv run python -m scripts.evaluate --split development --estimate
# Only after a budget decision:
uv run python -m scripts.evaluate --split development --confirm-paid-run
uv run python -m scripts.evaluate --split held_out --confirm-held-out --confirm-paid-run
```

These commands use real paid provider calls. Configure the key and an appropriate daily operation cap deliberately. A full comparison can exceed the default 100-call cap: each case is run in two modes, with up to three calls per mode plus indexing. A missing key exits without producing results. Partial runs and errors are labeled.

`--estimate` makes no provider calls and reports work size and configured token prices. The 38-question development comparison can require up to 252 provider operations including first indexing. Runs larger than two questions require `--confirm-paid-run`; that flag records operator intent, not an assurance that any account has sufficient credits. Obtain approval for a concrete token-cost estimate before starting a substantial run. Model/provider prices and token lengths affect cost.

## Metrics and limits

| Field | Definition and denominator |
| --- | --- |
| Document-level Recall@k | Fraction of annotated relevant documents represented among the top-k chunks, averaged across all cases with source annotations. Retrieval failures contribute zero. A later generation failure does not erase successful retrieval. The report includes eligible and successfully retrieved case counts. |
| Valid citation-reference rate | Valid observed chunk-ID references divided by all observed references, including references from rejected drafts. A partially invalid draft contributes its actual valid/total counts. Drafts with zero references and failures before a draft exists contribute no reference denominator. This does not measure semantic support or missing citations. |
| Citation-complete draft rate | Drafts passing all citation-ID checks divided by drafts requiring citations; missing/invalid citations fail. This is recorded separately from reference validity. |
| Model support pass rate | Observed drafts passing the model support gate divided by observed drafts requiring that gate. Invalid IDs, failed/incomplete assessments, and assessment-provider failures count as failures. Errors before any draft and no-claim abstentions are excluded, with counts exposed. Same-model judging has correlated error risk. |
| Correct abstention | Fraction of expected-insufficient cases that return insufficient evidence. Errors count as failures. This metric alone rewards over-abstention, so inspect status match and failed answerable cases too. |
| Status match | Per-case match to answered / insufficient / conflicting. Not a full measure of answer quality. |
| Incorrect abstention | Answerable questions receiving insufficient evidence divided by all expected-answerable cases. Errors are separate failures in the status-match metric; they are not mistaken for a correct answer. |
| Conflict handling | Cases returning conflicting evidence divided by cases annotated as conflicts, including errors as failures. This checks response status, not independent factual correctness. |
| Latency | Wall-clock time including retrieval, generation, and support checking. Mean and median include failed attempts. Nearest-rank p95 is shown only with at least 20 attempts per retrieval mode; this threshold does not guarantee statistical precision. |
| Tokens and estimated cost | Provider-reported input/output tokens, plus the number of reserved calls whose usage is unknown. Estimated cost is unavailable if any call cost is unknown. Indexing usage is retained separately from query-comparison totals. Not a bill. |

Every summary exposes attempted/error counts and metric-specific denominators. Citation/support metrics cannot assess an output that never existed; inspect those denominators and the error count together. No metric should be quoted alone as “accuracy.”

Retrieval-mode order alternates per question to reduce a fixed ordering effect. Calls remain sequential, generation is stochastic, and no model seed is controlled. This is an engineering comparison, not a controlled scientific study.

Artifacts record protocol version, SDK version, models/provider, source hashes, effective reviewed annotations, pipeline/runner hashes, retrieval settings, timestamps, per-case evidence snapshots, usage, and errors. The UI suppresses artifacts when these inputs no longer match. Only the fictional seed corpus is indexed for evaluation; private uploads and visitor data are never included.

## Human answer-quality rubric

Review the actual answer, cited passages, expected behavior, and status. Grade each live case from 0 to 4:

- **0:** wrong, unsupported, unsafe, or a provider failure.
- **1:** relevant fragments but a material error, missed conflict, or wrong abstention.
- **2:** mostly correct but incomplete, weakly attributed, or missing a useful clarification.
- **3:** correct and sufficiently supported, with the right answer/abstention/conflict behavior.
- **4:** correct, complete, concise, appropriately qualified, and useful next action.

Record case ID, retrieval mode, reviewer, grade, and justification separately. Compute mean grade and the fraction scoring at least 3. Report the review count and disagreement resolution process. Automated results intentionally leave `answer_quality=requires_human_rubric_review` instead of fabricating a grade.

The local outcome-review dialog saves this grade against the exact run fingerprint and case/mode. The UI reports the number of graded outcomes alongside any mean/pass rate. Repeated reviews retain audit history; the latest review per case/mode contributes to the summary. Changed or stale runs cannot accept a grade as if it applied to current results.

## Portfolio claims

For the initial build: “Implemented a reproducible semantic/hybrid comparison with 60 draft evaluation cases; live quality evaluation pending API setup and human dataset review.”

After a verified run, report the split, corpus size, exact sample count, model/settings, timestamp, failure count, annotation provenance, and both retrieval modes. Include limitations even if results look strong. A two-question smoke subset is not a benchmark.
