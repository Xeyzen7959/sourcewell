import json
import shutil

import pytest
from fastapi import HTTPException

from backend import evaluation as evaluation_module
from backend.config import ROOT
from backend.evaluation import (
    dataset,
    fingerprint,
    load_results,
    manifest,
    review_records,
    save_review,
    summarize,
)
from backend.models import AnnotationReview, AnswerQualityReview
from scripts.evaluate import run_case


@pytest.fixture
def isolated_evaluation(tmp_path, monkeypatch):
    root = tmp_path / "project"
    for name in ["evaluation", "fixtures", "backend", "scripts"]:
        shutil.copytree(ROOT / name, root / name, ignore=shutil.ignore_patterns("__pycache__", "tests"))
    monkeypatch.setattr(evaluation_module, "ROOT", root)
    return root


def review_body(case, **changes):
    values = {k: case[k] for k in ("question", "expected_behavior", "expected_status", "relevant_documents")}
    return AnnotationReview(
        **{
            **values,
            "reviewer": "Simulated human input in tests only",
            "attestation": True,
            "note": "Temporary test record",
            **changes,
        }
    )


def test_reviews_require_attestation_and_retain_date_provenance(settings, isolated_evaluation):
    case = dataset(settings)["cases"][0]
    with pytest.raises(ValueError):
        review_body(case, attestation=False)
    save_review(settings, case["id"], review_body(case, question="A corrected test question?"))
    updated = dataset(settings)
    assert updated["reviewed_count"] == 1
    assert updated["review_status"] == "requires_human_review"
    assert updated["cases"][0]["question"] == "A corrected test question?"
    assert updated["cases"][0]["split"] == case["split"]
    assert updated["cases"][0]["reviewed_at"]
    assert review_records(settings)["annotations"][0]["base_dataset_sha256"]
    assert (isolated_evaluation / "evaluation/reviews.json").read_text().count('"annotations": []') == 1


def test_invalid_sources_and_changed_corpus_invalidate_reviews(settings, isolated_evaluation):
    case = dataset(settings)["cases"][0]
    with pytest.raises(HTTPException):
        save_review(settings, case["id"], review_body(case, relevant_documents=["private-upload"]))
    save_review(settings, case["id"], review_body(case))
    source = isolated_evaluation / "fixtures/documents/getting-started.md"
    source.write_text(source.read_text() + "\nAn added policy invalidates previous attestations.\n")
    assert dataset(settings)["reviewed_count"] == 0


def test_artifacts_check_models_pipeline_settings_and_annotations(settings, isolated_evaluation):
    result = dict(status="completed", manifest=manifest(settings, dataset(settings)), summaries=[], cases=[])
    path = isolated_evaluation / "evaluation/results.json"
    path.write_text(json.dumps(result))
    assert load_results(settings)["run_fingerprint"] == fingerprint(result)
    changed = settings.model_copy(update={"context_chunks": 3})
    assert load_results(changed)["status"] == "stale"
    pipeline = isolated_evaluation / "backend/provider.py"
    pipeline.write_text(pipeline.read_text() + "\n# Changed behavior\n")
    assert load_results(settings)["status"] == "stale"


def test_answer_grades_are_bound_to_actual_case_mode_and_run(settings, isolated_evaluation):
    result = dict(
        status="completed",
        manifest=manifest(settings, dataset(settings)),
        summaries=[dict(mode="hybrid")],
        cases=[dict(id="q001", mode="hybrid")],
    )
    (isolated_evaluation / "evaluation/results.json").write_text(json.dumps(result))
    grade = AnswerQualityReview(
        run_fingerprint=fingerprint(result),
        mode="hybrid",
        grade=3,
        reviewer="Simulated reviewer",
        reason="Evidence supports the answer in this temporary test.",
        attestation=True,
    )
    save_review(settings, "q001", grade, "answer_reviews")
    summary = load_results(settings)["summaries"][0]
    assert summary["human_review_count"] == 1 and summary["human_mean_grade"] == 3
    with pytest.raises(HTTPException):
        save_review(settings, "q002", grade, "answer_reviews")
    with pytest.raises(HTTPException):
        save_review(
            settings, "q001", grade.model_copy(update={"run_fingerprint": "a" * 64}), "answer_reviews"
        )


def row(**changes):
    return dict(
        mode="hybrid",
        status="answered",
        expected_status="answered",
        has_relevant_evidence=True,
        retrieval_succeeded=True,
        recall_at_k=1.0,
        usage=[],
        latency_ms=10,
        **changes,
    )


def test_metric_denominators_include_errors_and_report_partial_citations():
    rows = [
        {
            **row(),
            "status": "insufficient_evidence",
            "citation_reference_count": 2,
            "valid_citation_reference_count": 1,
            "citation_validation": "invalid",
            "support_assessment": "not_supported_or_unchecked",
        },
        {
            **row(),
            "citation_reference_count": 1,
            "valid_citation_reference_count": 1,
            "citation_validation": "valid",
            "support_assessment": "model_supported",
        },
        {
            **row(),
            "status": "error",
            "expected_status": "insufficient_evidence",
            "recall_at_k": None,
            "retrieval_succeeded": False,
        },
        {**row(), "status": "conflicting_evidence", "expected_status": "conflicting_evidence"},
    ]
    result = summarize(rows, "hybrid")
    assert result["error_count"] == 1 and result["cases"] == 4
    assert result["retrieval_recall_at_k"] == 0.75
    assert result["valid_citation_reference_rate"] == pytest.approx(2 / 3)
    assert result["abstention_accuracy"] == 0
    assert result["incorrect_abstention_rate"] == 0.5
    assert result["conflict_handling_rate"] == 1
    assert result["model_support_pass_rate"] == 0.5
    assert result["p95_latency_ms"] is None


def test_latency_p95_requires_twenty_attempts_and_unknown_usage_is_visible():
    rows = [
        {
            **row(),
            "latency_ms": i,
            "usage": [dict(input_tokens=0, output_tokens=0, estimated_cost_usd=None, usage_known=False)],
        }
        for i in range(1, 21)
    ]
    result = summarize(rows, "hybrid")
    assert result["median_latency_ms"] == 10.5 and result["p95_latency_ms"] == 19
    assert result["unknown_usage_calls"] == 20 and result["estimated_cost_usd"] is None


def test_generation_failure_does_not_erase_successful_retrieval():
    from backend.tests.conftest import FakeProvider

    provider = FakeProvider(None, None)

    class Retrieval:
        def search(self, *args):
            return [dict(id="c1", document_id="refunds", section="Policy", text="Evidence")]

    def fail(*args):
        raise HTTPException(502, "Provider failed")

    provider.answer = fail
    case = dict(
        id="q001",
        question="Refund?",
        expected_status="answered",
        expected_behavior="Explain eligibility",
        relevant_documents=["refunds"],
    )
    result = run_case(case, "hybrid", Retrieval(), provider)
    assert result["status"] == "error" and result["recall_at_k"] == 1
    assert result["retrieval_succeeded"]
