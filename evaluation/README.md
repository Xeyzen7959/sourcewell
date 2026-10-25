# Evaluation protocol

The dataset contains 60 AI-drafted questions: 38 development cases and 22 held-out cases. Every case requires human review. The corpus is fictional, so these questions do not establish performance on real customer traffic.

## Before measuring

Review each question, expected status, document annotations, and expected-behavior rubric against the source documents. Fix mistakes and update dataset version/provenance. Reviewers should record who reviewed which cases and when before changing `review_status` to a human-reviewed state. Do not let an AI tool mark its own cases human-verified.

Use development cases to select chunk size, retrieval settings, prompts, and models. Keep held-out cases untouched until a final assessment. Once repeatedly inspected for tuning, the held-out set is no longer an honest final test; create a new one.

## Execute

```bash
uv run python -m scripts.evaluate --split development --limit 2
uv run python -m scripts.evaluate --split development
uv run python -m scripts.evaluate --split held_out --confirm-held-out
```

These commands use real paid provider calls. Configure the key and an appropriate daily operation cap deliberately. A full comparison can exceed the default 100-call cap: each case is run in two modes, with up to three calls per mode plus indexing. A missing key exits without producing results. Partial runs and errors are labeled.

## Metrics and limits

| Field | Definition and denominator |
| --- | --- |
| Document-level Recall@k | Fraction of annotated relevant documents represented among the top-k chunks. Averaged only for cases with relevance annotations and successful retrieval. This is document recall, not chunk-level recall. |
| Valid citation-reference rate | Fraction of generated drafts requiring citations whose references pass all ID checks. No-citation abstentions are excluded; rejected cited drafts count as failures. This does not measure semantic correctness. |
| Model support pass rate | Fraction of drafts requiring citation assessment that pass the model support gate. Failed or incomplete assessments count as failures; no-claim abstentions are excluded. Same-model judging has correlated error risk. |
| Correct abstention | Fraction of expected-insufficient cases that return insufficient evidence. Errors count as failures. This metric alone rewards over-abstention, so inspect status match and failed answerable cases too. |
| Status match | Per-case match to answered / insufficient / conflicting. Not a full measure of answer quality. |
| Latency | Wall-clock time including retrieval, generation, and support checking, per case/mode. Errors remain visible. |
| Tokens and estimated cost | Per-operation provider-reported tokens and optional configured token prices. Indexing and unknown failed-call usage are excluded from comparison totals. Not a bill. |

Retrieval and citation aggregates can exclude provider errors with no usable output. Always report error counts beside aggregate scores and review raw outcomes. No metric should be quoted alone as “accuracy.”

## Human answer-quality rubric

Review the actual answer, cited passages, expected behavior, and status. Grade each live case from 0 to 4:

- **0:** wrong, unsupported, unsafe, or a provider failure.
- **1:** relevant fragments but a material error, missed conflict, or wrong abstention.
- **2:** mostly correct but incomplete, weakly attributed, or missing a useful clarification.
- **3:** correct and sufficiently supported, with the right answer/abstention/conflict behavior.
- **4:** correct, complete, concise, appropriately qualified, and useful next action.

Record case ID, retrieval mode, reviewer, grade, and justification separately. Compute mean grade and the fraction scoring at least 3. Report the review count and disagreement resolution process. Automated results intentionally leave `answer_quality=requires_human_rubric_review` instead of fabricating a grade.

## Portfolio claims

For the initial build: “Implemented a reproducible semantic/hybrid comparison with 60 draft evaluation cases; live quality evaluation pending API setup and human dataset review.”

After a verified run, report the split, corpus size, exact sample count, model/settings, timestamp, failure count, annotation provenance, and both retrieval modes. Include limitations even if results look strong. A two-question smoke subset is not a benchmark.
