"""Live-only, seed-only comparison with human-review provenance and failure-aware metrics."""

import argparse
import json
import time
from importlib.metadata import version

from backend.config import ROOT, Settings
from backend.evaluation import dataset, manifest, summarize
from backend.provider import Provider, check_answer
from backend.retrieval import Retriever
from backend.store import Store, now


def run_case(case, mode, retriever, provider):
    started = time.perf_counter()
    provider.start_usage()
    row = dict(
        id=case["id"],
        mode=mode,
        question=case["question"],
        expected_status=case["expected_status"],
        expected_behavior=case["expected_behavior"],
        has_relevant_evidence=bool(case["relevant_documents"]),
        recall_at_k=None,
        retrieval_succeeded=False,
        answer_quality="requires_human_rubric_review",
    )
    try:
        sources = retriever.search(case["question"], mode)
        relevant = set(case["relevant_documents"])
        row.update(
            retrieval_succeeded=True,
            retrieved_documents=[s["document_id"] for s in sources],
            recall_at_k=len(relevant & {s["document_id"] for s in sources}) / len(relevant)
            if relevant
            else None,
        )
        answer = check_answer(provider, case["question"], sources)
        row.update(
            status=answer["status"],
            answer=answer["answer"],
            claims=answer["claims"],
            source_passages=[{k: s[k] for k in ("id", "document_id", "section", "text")} for s in sources],
            explanation=answer["explanation"],
            next_action=answer["next_action"],
        )
        for field in (
            "citation_validation",
            "support_assessment",
            "citation_reference_count",
            "valid_citation_reference_count",
        ):
            row[field] = answer.get(field, 0 if field.endswith("count") else "not_run")
    except Exception as exc:
        row.update(status="error", error=str(getattr(exc, "detail", type(exc).__name__)))
        row.update(getattr(exc, "evaluation_diagnostics", {}))
    row.update(usage=provider.usage(), latency_ms=round((time.perf_counter() - started) * 1000))
    return row


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--split", choices=["development", "held_out"], default="development")
    parser.add_argument("--limit", type=int, help="A subset is always labeled partial")
    parser.add_argument("--confirm-held-out", action="store_true")
    parser.add_argument(
        "--confirm-paid-run", action="store_true", help="Required for more than two questions"
    )
    parser.add_argument(
        "--estimate", action="store_true", help="Report work size without making any provider calls"
    )
    args = parser.parse_args()
    if args.limit is not None and args.limit < 1:
        parser.error("--limit must be positive")
    if args.split == "held_out" and not args.confirm_held_out:
        parser.error("Use --confirm-held-out only for a final assessment, not tuning.")
    settings = Settings()
    data = dataset(settings)
    cases = [c for c in data["cases"] if c["split"] == args.split]
    if args.limit:
        cases = cases[: args.limit]
    operations = len(cases) * 6 + len(list((ROOT / "fixtures/documents").glob("*.md")))
    print(
        f"{len(cases)} questions × 2 retrieval modes; up to {operations} provider operations including initial indexing."
    )
    print(f"Shared daily cap: {settings.daily_provider_call_limit}. Dataset: {data['review_status']}.")
    if args.estimate:
        print("No calls made. Token cost depends on actual input/output and configured model prices.")
        print(
            f"Generation USD/million tokens: input={settings.generation_input_price}, output={settings.generation_output_price}."
        )
        print(
            f"Embeddings USD/million input tokens: {settings.embedding_input_price}. None means unknown, not free."
        )
        print("Obtain a budget decision before a substantial run. The operation cap is not a dollar cap.")
        return
    if len(cases) > 2 and not args.confirm_paid_run:
        parser.error("Review --estimate and obtain budget approval, then pass --confirm-paid-run.")
    if not settings.provider_key.get_secret_value():
        parser.error(f"{settings.credential_name} is missing. No live results were produced.")
    usage_store = Store(settings.data_dir)
    isolated = settings.model_copy(
        update={"data_dir": settings.data_dir / "evaluation", "app_mode": "public", "cookie_secure": True}
    )
    store = Store(isolated.data_dir)
    provider = Provider(settings, usage_store)
    retriever = Retriever(store, isolated, provider)
    provider.start_usage()
    for path in sorted((ROOT / "fixtures/documents").glob("*.md")):
        retriever.ingest(path.name, path.read_bytes(), doc_id=path.stem, seeded=True)
        retriever.index_document(path.stem)
    indexing_usage = provider.usage().copy()
    rows = []
    for index, case in enumerate(cases):
        order = ["semantic", "hybrid"] if index % 2 == 0 else ["hybrid", "semantic"]
        for mode in order:
            row = run_case(case, mode, retriever, provider)
            rows.append(row)
            print(f"{row['id']} {mode}: {row['status']}")
    output = dict(
        protocol_version="2",
        status="partial" if args.limit or any(r["status"] == "error" for r in rows) else "completed",
        timestamp=now(),
        split=args.split,
        dataset_version=data["version"],
        dataset_review_status=data["review_status"],
        reviewed_case_count=sum(c["review_status"] == "human_reviewed" for c in cases),
        annotation_provenance=[
            {k: c[k] for k in ("id", "review_status", "reviewer", "reviewed_at") if k in c} for c in cases
        ],
        generation_model=settings.generation_model,
        embedding_model=settings.embedding_model,
        provider=settings.ai_provider,
        sdk_version=version("openai"),
        manifest=manifest(settings, data),
        configuration=manifest(settings, data)["configuration"],
        indexing_usage=indexing_usage,
        order="Alternated retrieval-mode order per question; sequential calls; no model seed control.",
        notes="Live run, not a correctness guarantee. Draft annotations imply preliminary results. "
        "Errors count against task-status denominators; citation/support metrics include only observed drafts. "
        "Latency includes errors; p95 requires at least 20 attempts. API costs may be incomplete. "
        "Only fictional seed sources are included. Human quality review is separate.",
        summaries=[summarize(rows, mode) for mode in ("semantic", "hybrid")],
        cases=rows,
    )
    destination = ROOT / "evaluation/results.json"
    temporary = destination.with_suffix(".tmp")
    temporary.write_text(json.dumps(output, indent=2) + "\n")
    temporary.replace(destination)
    print(f"Saved {output['status']} results. Inspect errors, denominators, and review provenance.")


if __name__ == "__main__":
    main()
