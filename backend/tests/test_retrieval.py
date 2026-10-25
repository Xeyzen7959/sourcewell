import io

import pytest
from fastapi import HTTPException
from pypdf import PdfWriter

from backend.retrieval import chunk_pages, extract, rrf


def test_chunk_metadata_overlap_and_stable_ids():
    text = "# First\n" + "alpha beta gamma " * 30 + "\n## Second\nThe final passage."
    chunks = chunk_pages("doc", "abcd1234", [(7, text)], 200, 30)
    assert chunks == chunk_pages("doc", "abcd1234", [(7, text)], 200, 30)
    assert all(c["page"] == 7 and len(c["text"]) <= 200 for c in chunks)
    assert chunks[-1]["section"] == "Second"
    assert len({c["id"] for c in chunks}) == len(chunks)
    assert chunks[0]["text"][-20:] in chunks[1]["text"][:40]


def test_rrf_combines_evidence_and_ties_deterministically():
    assert rrf([["a", "b"], ["b", "c"]]) == ["b", "a", "c"]
    assert rrf([]) == []


@pytest.mark.parametrize(
    "name,data,status",
    [
        ("notes.exe", b"hello", 415),
        ("empty.txt", b" ", 422),
        ("broken.txt", b"\xff\xff", 422),
        ("broken.pdf", b"not pdf", 422),
    ],
)
def test_invalid_documents_fail_usefully(name, data, status):
    with pytest.raises(HTTPException) as error:
        extract(name, data)
    assert error.value.status_code == status


def test_scanned_pdf_reports_ocr_limit():
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    stream = io.BytesIO()
    writer.write(stream)
    with pytest.raises(HTTPException, match="OCR"):
        extract("scan.pdf", stream.getvalue())


def test_replacement_and_deletion_never_retrieve_old_chunks(client, app):
    retriever = app.state.retriever
    doc_id = retriever.ingest("old.md", b"# Apple\nThe old apple policy.", embed=True)
    old_ids = {c["id"] for c in app.state.store.chunks() if c["document_id"] == doc_id}
    retriever.ingest("new.md", b"# Pear\nThe replacement pear policy.", doc_id=doc_id, embed=True)
    assert not (old_ids & {c["id"] for c in app.state.store.chunks()})
    assert not app.state.retriever.collection.get(ids=list(old_ids))["ids"]
    assert app.state.store.document(doc_id)["version"] == 2
    retriever.delete(doc_id)
    assert not any(c["document_id"] == doc_id for c in app.state.store.chunks())
    assert not app.state.retriever.collection.get(where={"document_id": doc_id})["ids"]


def test_retrieval_modes_use_only_active_chunks(client, app):
    retriever = app.state.retriever
    for doc in app.state.store.documents():
        retriever.index_document(doc["id"])
    for mode in ["semantic", "hybrid"]:
        results = retriever.search("Error E-207 upload too large", mode)
        assert 0 < len(results) <= 5
        assert all(c["id"] in {item["id"] for item in app.state.store.chunks()} for c in results)
    assert "error-e207" in {c["document_id"] for c in retriever.search("E-207")}


def test_unindexed_replacement_fails_closed(client, app):
    for doc in app.state.store.documents():
        app.state.retriever.index_document(doc["id"])
    doc_id = app.state.retriever.ingest("notes.txt", b"A new document.", embed=True)
    app.state.retriever.ingest("notes.txt", b"Replaced without embedding.", doc_id=doc_id)
    with pytest.raises(HTTPException) as error:
        app.state.retriever.search("Replaced")
    assert error.value.status_code == 409
