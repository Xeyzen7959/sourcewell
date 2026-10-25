"""Explicit opt-in live smoke check. Uses paid provider calls; requires OPENAI_API_KEY."""

from backend.config import ROOT, Settings
from backend.provider import Provider, check_answer
from backend.retrieval import Retriever
from backend.store import Store


def main():
    settings = Settings()
    provider = Provider(settings, Store(settings.data_dir))
    if not provider.available:
        raise SystemExit("BLOCKED: OPENAI_API_KEY is not configured. No live verification was performed.")
    retriever = Retriever(provider.store, settings, provider)
    for path in sorted((ROOT / "fixtures/documents").glob("*.md")):
        retriever.ingest(path.name, path.read_bytes(), doc_id=path.stem, seeded=True)
        retriever.index_document(path.stem)
    provider.start_usage()
    sources = retriever.search("How do I fix error E-207?", "hybrid")
    result = check_answer(provider, "How do I fix error E-207?", sources)
    assert sources, "No retrieval evidence"
    assert result["citation_validation"] == "valid", "Citation validation did not pass"
    assert result["status"] == "answered", "Expected an answer; inspect live output"
    print("Live smoke passed: ingestion, embeddings, hybrid retrieval, generation, and citation assessment.")
    print("This single smoke check is not a benchmark or a guarantee of answer quality.")


if __name__ == "__main__":
    main()
