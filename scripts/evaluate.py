"""Live-only semantic/hybrid comparison. Never writes a fabricated or mocked score artifact."""

import argparse
import hashlib
import json
import statistics
import time

from backend.config import ROOT, Settings
from backend.provider import Provider, check_answer
from backend.retrieval import Retriever
from backend.store import Store, now


def average(values):
    measured = [v for v in values if v is not None]
    return statistics.mean(measured) if measured else None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--split", choices=["development", "held_out"], default="development")
    parser.add_argument("--limit", type=int, help="Smoke-test subset; output is explicitly marked partial")
    parser.add_argument(
        "--confirm-held-out", action="store_true", help="Acknowledge final evaluation, not tuning"
    )
    args = parser.parse_args()
    if args.limit is not None and args.limit < 1:
        parser.error("--limit must be positive")
    if args.split == "held_out" and not args.confirm_held_out:
        parser.error("Held-out evaluation requires --confirm-held-out. Tune on development cases only.")
    settings = Settings()
    if not settings.openai_api_key.get_secret_value():
        parser.error(
            "OPENAI_API_KEY is missing. No live scores were produced; existing artifacts are unchanged."
        )
    dataset_path = ROOT / "evaluation/dataset.json"
    dataset = json.loads(dataset_path.read_text())
    cases = [c for c in dataset["cases"] if c["split"] == args.split]
    if args.limit:
        cases = cases[: args.limit]
    usage_store = Store(settings.data_dir)
    evaluation_settings = settings.model_copy(
        update={"data_dir": settings.data_dir / "evaluation", "app_mode": "public"}
    )
    store = Store(evaluation_settings.data_dir)
    provider = Provider(settings, usage_store)
    retriever = Retriever(store, evaluation_settings, provider)
    for path in sorted((ROOT / "fixtures/documents").glob("*.md")):
        retriever.ingest(path.name, path.read_bytes(), doc_id=path.stem, seeded=True)
    corpus = store.documents(public=True)
    print(
        f"Live evaluation: {len(cases)} cases × 2 modes. Up to 3 provider calls per case/mode, plus indexing."
    )
    print(
        f"Daily call cap: {settings.daily_provider_call_limit}. Failed/reserved calls count toward this cap."
    )
    for doc in corpus:
        retriever.index_document(doc["id"])
    rows = []
    for case in cases:
        for mode in ["semantic", "hybrid"]:
            started = time.perf_counter()
            provider.start_usage()
            row = dict(
                id=case["id"],
                mode=mode,
                expected_status=case["expected_status"],
                recall_at_k=None,
                citation_reference_rate=None,
                model_support_pass=None,
            )
            try:
                sources = retriever.search(case["question"], mode)
                answer = check_answer(provider, case["question"], sources)
                relevant = set(case["relevant_documents"])
                row.update(
                    status=answer["status"],
                    answer=answer["answer"],
                    expected_behavior=case["expected_behavior"],
                    retrieved_documents=[s["document_id"] for s in sources],
                    recall_at_k=len(relevant & {s["document_id"] for s in sources}) / len(relevant)
                    if relevant
                    else None,
                    citation_reference_rate=float(answer["citation_validation"] == "valid")
                    if answer["citation_validation"] != "not_applicable"
                    else None,
                    model_support_pass=answer["support_assessment"] == "model_supported"
                    if answer["support_assessment"] != "not_run"
                    else None,
                    abstention_correct=float(answer["status"] == "insufficient_evidence")
                    if case["expected_status"] == "insufficient_evidence"
                    else None,
                    status_match=answer["status"] == case["expected_status"],
                    answer_quality="requires_human_rubric_review",
                    usage=provider.usage(),
                )
            except Exception as exc:
                row.update(
                    status="error",
                    error=str(getattr(exc, "detail", type(exc).__name__)),
                    abstention_correct=0.0 if case["expected_status"] == "insufficient_evidence" else None,
                    status_match=False,
                    usage=provider.usage(),
                )
            row["latency_ms"] = round((time.perf_counter() - started) * 1000)
            rows.append(row)
            print(f"{case['id']} {mode}: {row['status']}")
    summaries = []
    for mode in ["semantic", "hybrid"]:
        mode_rows = [r for r in rows if r["mode"] == mode]
        costs = [u["estimated_cost_usd"] for r in mode_rows for u in r["usage"]]
        summaries.append(
            dict(
                mode=mode,
                cases=len(mode_rows),
                retrieval_recall_at_k=average([r["recall_at_k"] for r in mode_rows]),
                valid_citation_reference_rate=average([r["citation_reference_rate"] for r in mode_rows]),
                abstention_accuracy=average([r["abstention_correct"] for r in mode_rows]),
                model_support_pass_rate=average([r["model_support_pass"] for r in mode_rows]),
                average_latency_ms=average([r["latency_ms"] for r in mode_rows]),
                estimated_cost_usd=sum(costs) if costs and all(c is not None for c in costs) else None,
                error_count=sum(r["status"] == "error" for r in mode_rows),
            )
        )
    output = dict(
        status="partial" if args.limit or any(r["status"] == "error" for r in rows) else "completed",
        timestamp=now(),
        split=args.split,
        dataset_version=dataset["version"],
        dataset_sha256=hashlib.sha256(dataset_path.read_bytes()).hexdigest(),
        dataset_review_status=dataset["review_status"],
        generation_model=settings.generation_model,
        embedding_model=settings.embedding_model,
        corpus_hashes={d["id"]: d["hash"] for d in corpus},
        configuration=dict(
            context_chunks=settings.context_chunks,
            candidates=settings.retrieval_candidates,
            chunk_size=settings.chunk_size,
            overlap=settings.chunk_overlap,
            rrf_k=settings.rrf_k,
        ),
        notes="Live run on AI-drafted cases requiring human review. Retrieval metric uses document-level relevance. "
        "Model support is not answer correctness. Cost excludes indexing and failed calls with unknown usage. "
        "Human answer-quality rubric: evaluation/README.md. Raw source snapshots are not exported.",
        summaries=summaries,
        cases=rows,
    )
    destination = ROOT / "evaluation/results.json"
    temp = destination.with_suffix(".tmp")
    temp.write_text(json.dumps(output, indent=2) + "\n")
    temp.replace(destination)
    print(
        f"Saved {output['status']} live results to evaluation/results.json. Review failures and case annotations."
    )


if __name__ == "__main__":
    main()
