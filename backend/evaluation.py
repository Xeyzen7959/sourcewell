"""Shared evaluation provenance, human review storage, and explicit metric denominators."""

import hashlib
import json
import math
import statistics
import threading

from fastapi import HTTPException

from backend.config import ROOT
from backend.store import now

REVIEW_LOCK = threading.Lock()
PROTOCOL_VERSION = "2"


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def corpus_hashes():
    return {
        p.stem: hashlib.sha256(p.read_bytes()).hexdigest()
        for p in sorted((ROOT / "fixtures/documents").glob("*.md"))
    }


def review_records(settings):
    merged = {"schema_version": 1, "annotations": [], "answer_reviews": []}
    for path in [ROOT / "evaluation/reviews.json", settings.data_dir / "reviews.json"]:
        if path.exists():
            data = json.loads(path.read_text())
            if data.get("schema_version") != 1:
                raise HTTPException(409, "Unsupported review file schema. Review the local annotation file.")
            for key in ("annotations", "answer_reviews"):
                for record in data[key]:
                    if record not in merged[key]:
                        merged[key].append(record)
    return merged


def dataset(settings):
    raw = json.loads((ROOT / "evaluation/dataset.json").read_text())
    base_hash = fingerprint(raw)
    sources_hash = fingerprint(corpus_hashes())
    records = review_records(settings)
    for case in raw["cases"]:
        reviews = [
            r
            for r in records["annotations"]
            if r["case_id"] == case["id"]
            and r["base_dataset_sha256"] == base_hash
            and r["corpus_sha256"] == sources_hash
        ]
        if reviews:
            latest = max(reviews, key=lambda r: r["reviewed_at"])
            for key in ("question", "expected_behavior", "expected_status", "relevant_documents"):
                case[key] = latest[key]
            case.update(
                review_status="human_reviewed",
                reviewer=latest["reviewer"],
                reviewed_at=latest["reviewed_at"],
                review_note=latest["note"],
            )
    reviewed = sum(c["review_status"] == "human_reviewed" for c in raw["cases"])
    raw["review_status"] = "human_reviewed" if reviewed == len(raw["cases"]) else "requires_human_review"
    raw["reviewed_count"] = reviewed
    raw["base_dataset_sha256"] = base_hash
    raw["effective_sha256"] = fingerprint(raw["cases"])
    return raw


def save_review(settings, case_id, body, kind="annotations"):
    with REVIEW_LOCK:
        current = dataset(settings)
        if case_id not in {c["id"] for c in current["cases"]}:
            raise HTTPException(404, "Evaluation case not found")
        record = body.model_dump(exclude={"attestation"})
        record.update(case_id=case_id, reviewed_at=now())
        if kind == "annotations":
            if set(body.relevant_documents) - set(corpus_hashes()):
                raise HTTPException(422, "Source references must identify fictional seed documents")
            if body.expected_status != "insufficient_evidence" and not body.relevant_documents:
                raise HTTPException(422, "An answer or conflict needs annotated source evidence")
            record.update(
                base_dataset_sha256=current["base_dataset_sha256"], corpus_sha256=fingerprint(corpus_hashes())
            )
        else:
            result = load_results(settings)
            if not result or result.get("run_fingerprint") != body.run_fingerprint:
                raise HTTPException(409, "The evaluation run is missing or stale. Refresh before grading.")
            if not any(r["id"] == case_id and r["mode"] == body.mode for r in result["cases"]):
                raise HTTPException(404, "This case/mode was not included in the run")
        path = settings.data_dir / "reviews.json"
        records = review_records(settings)
        records[kind].append(record)
        temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps(records, indent=2) + "\n")
        temporary.replace(path)
    return {"status": "saved", "reviewed_at": record["reviewed_at"]}


def manifest(settings, data):
    pipeline = {
        name: hashlib.sha256((ROOT / "backend" / name).read_bytes()).hexdigest()
        for name in ("provider.py", "retrieval.py", "models.py", "evaluation.py")
    }
    pipeline["runner"] = hashlib.sha256((ROOT / "scripts/evaluate.py").read_bytes()).hexdigest()
    return dict(
        protocol_version=PROTOCOL_VERSION,
        dataset_sha256=data["effective_sha256"],
        corpus_hashes=corpus_hashes(),
        pipeline_sha256=fingerprint(pipeline),
        configuration=dict(
            provider=settings.ai_provider,
            generation_model=settings.generation_model,
            embedding_model=settings.embedding_model,
            context_chunks=settings.context_chunks,
            candidates=settings.retrieval_candidates,
            chunk_size=settings.chunk_size,
            overlap=settings.chunk_overlap,
            rrf_k=settings.rrf_k,
        ),
    )


def load_results(settings):
    path = ROOT / "evaluation/results.json"
    if not path.exists():
        return None
    result = json.loads(path.read_text())
    if result.get("manifest") != manifest(settings, dataset(settings)):
        return {
            "status": "stale",
            "message": "Dataset, corpus, models, pipeline, or retrieval settings changed. Rerun evaluation.",
        }
    result["run_fingerprint"] = fingerprint(json.loads(path.read_text()))
    reviews = review_records(settings)["answer_reviews"]
    for summary in result["summaries"]:
        matched = {}
        for r in sorted(reviews, key=lambda r: r["reviewed_at"]):
            if r["run_fingerprint"] == result["run_fingerprint"] and r["mode"] == summary["mode"]:
                matched[r["case_id"]] = r
        grades = [r["grade"] for r in matched.values()]
        summary["human_review_count"] = len(grades)
        summary["human_mean_grade"] = statistics.mean(grades) if grades else None
        summary["human_pass_rate"] = sum(g >= 3 for g in grades) / len(grades) if grades else None
    return result


def summarize(rows, mode):
    subset = [r for r in rows if r["mode"] == mode]
    retrieval_cases = [r for r in subset if r["has_relevant_evidence"]]
    insufficient = [r for r in subset if r["expected_status"] == "insufficient_evidence"]
    answerable = [r for r in subset if r["expected_status"] == "answered"]
    conflicts = [r for r in subset if r["expected_status"] == "conflicting_evidence"]
    citation_drafts = [r for r in subset if r.get("citation_validation") in {"valid", "invalid"}]
    support_drafts = [r for r in subset if r.get("support_assessment") not in {None, "not_run"}]
    refs = sum(r.get("citation_reference_count", 0) for r in subset)
    valid_refs = sum(r.get("valid_citation_reference_count", 0) for r in subset)
    calls = [u for r in subset for u in r["usage"]]
    known_costs = [u["estimated_cost_usd"] for u in calls]
    latencies = sorted(r["latency_ms"] for r in subset)

    def rate(numerator, denominator):
        return numerator / denominator if denominator else None

    return dict(
        mode=mode,
        cases=len(subset),
        error_count=sum(r["status"] == "error" for r in subset),
        retrieval_recall_at_k=rate(
            sum(r.get("recall_at_k") or 0 for r in retrieval_cases), len(retrieval_cases)
        ),
        retrieval_case_count=len(retrieval_cases),
        retrieval_success_count=sum(r.get("retrieval_succeeded", False) for r in retrieval_cases),
        valid_citation_reference_rate=rate(valid_refs, refs),
        citation_reference_count=refs,
        valid_citation_reference_count=valid_refs,
        citation_complete_draft_rate=rate(
            sum(r["citation_validation"] == "valid" for r in citation_drafts), len(citation_drafts)
        ),
        citation_draft_count=len(citation_drafts),
        abstention_accuracy=rate(
            sum(r["status"] == "insufficient_evidence" for r in insufficient), len(insufficient)
        ),
        abstention_case_count=len(insufficient),
        incorrect_abstention_rate=rate(
            sum(r["status"] == "insufficient_evidence" for r in answerable), len(answerable)
        ),
        answerable_case_count=len(answerable),
        conflict_handling_rate=rate(
            sum(r["status"] == "conflicting_evidence" for r in conflicts), len(conflicts)
        ),
        conflict_case_count=len(conflicts),
        status_match_rate=rate(sum(r["status"] == r["expected_status"] for r in subset), len(subset)),
        model_support_pass_rate=rate(
            sum(r["support_assessment"] == "model_supported" for r in support_drafts), len(support_drafts)
        ),
        support_draft_count=len(support_drafts),
        average_latency_ms=statistics.mean(latencies) if latencies else None,
        median_latency_ms=statistics.median(latencies) if latencies else None,
        p95_latency_ms=latencies[math.ceil(0.95 * len(latencies)) - 1] if len(latencies) >= 20 else None,
        input_tokens=sum(u["input_tokens"] for u in calls),
        output_tokens=sum(u["output_tokens"] for u in calls),
        unknown_usage_calls=sum(not u.get("usage_known", True) for u in calls),
        estimated_cost_usd=sum(known_costs) if calls and all(c is not None for c in known_costs) else None,
    )
