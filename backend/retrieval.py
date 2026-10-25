import hashlib
import io
import re
import threading
import uuid
from pathlib import Path

from fastapi import HTTPException
from pypdf import PdfReader
from rank_bm25 import BM25Okapi


def tokenize(text):
    return re.findall(r"[\w-]+", text.lower())


def extract(filename, content):
    extension = Path(filename).suffix.lower()
    if extension not in {".md", ".txt", ".pdf"}:
        raise HTTPException(415, "Use Markdown, text, or text-based PDF files.")
    if extension == ".pdf":
        try:
            reader = PdfReader(io.BytesIO(content))
            if reader.is_encrypted or len(reader.pages) > 50:
                raise ValueError("PDF must be unencrypted and at most 50 pages")
            pages = [(i + 1, p.extract_text() or "") for i, p in enumerate(reader.pages)]
        except Exception as exc:
            raise HTTPException(
                422, "PDF could not be read. Use an unencrypted PDF with at most 50 pages."
            ) from exc
        if not any(text.strip() for _, text in pages):
            raise HTTPException(
                422, "No text found. Scanned PDFs need OCR, which this version does not provide."
            )
    else:
        try:
            pages = [(None, content.decode("utf-8-sig"))]
        except UnicodeDecodeError as exc:
            raise HTTPException(422, "Text files must use UTF-8 encoding.") from exc
    if not any(text.strip() for _, text in pages):
        raise HTTPException(422, "The document is empty.")
    if sum(len(text) for _, text in pages) > 100_000:
        raise HTTPException(422, "Extracted text exceeds 100,000 characters. Split this document.")
    return pages


def chunk_pages(doc_id, version_hash, pages, size=1200, overlap=150):
    if overlap >= size:
        raise ValueError("Overlap must be smaller than chunk size")
    chunks = []
    for page, text in pages:
        heading = "Overview"
        section = []

        def flush():
            body = "\n".join(section).strip()
            start = 0
            while start < len(body):
                end = min(start + size, len(body))
                if end < len(body):
                    space = body.rfind(" ", start + size // 2, end)
                    if space > start:
                        end = space
                snippet = body[start:end].strip()
                if snippet:
                    chunk_id = f"{doc_id}:{version_hash[:12]}:{len(chunks)}"
                    chunks.append(
                        dict(id=chunk_id, document_id=doc_id, section=heading, page=page, text=snippet)
                    )
                if end == len(body):
                    break
                start = max(start + 1, end - overlap)

        for line in text.splitlines():
            if re.match(r"^#{1,6}\s+", line):
                flush()
                section = []
                heading = re.sub(r"^#+\s+", "", line).strip()
            else:
                section.append(line)
        flush()
    if not chunks:
        raise HTTPException(422, "Document contains headings but no readable content.")
    if len(chunks) > 150:
        raise HTTPException(422, "Too many chunks. Split this document into smaller files.")
    return chunks


def rrf(rankings, k=60):
    scores = {}
    for ranking in rankings:
        for rank, chunk_id in enumerate(ranking, 1):
            scores[chunk_id] = scores.get(chunk_id, 0) + 1 / (k + rank)
    return sorted(scores, key=lambda chunk_id: (-scores[chunk_id], chunk_id))


class Retriever:
    def __init__(self, store, settings, provider):
        self.store, self.settings, self.provider = store, settings, provider
        self.lock = threading.RLock()
        self._collection = None

    @property
    def collection(self):
        if self._collection is None:
            import chromadb
            from chromadb.config import Settings as ChromaSettings

            client = chromadb.PersistentClient(
                path=str(self.settings.data_dir / "chroma"),
                settings=ChromaSettings(anonymized_telemetry=False),
            )
            model_hash = hashlib.sha256(self.settings.embedding_model.encode()).hexdigest()[:16]
            self._collection = client.get_or_create_collection(
                f"sourcewell-{model_hash}", metadata={"hnsw:space": "cosine"}, embedding_function=None
            )
        return self._collection

    def ingest(self, filename, content, doc_id=None, seeded=False, embed=False):
        with self.lock:
            filename = Path(filename.replace("\\", "/")).name[:180]
            if not filename:
                raise HTTPException(422, "A filename is required")
            pages = extract(filename, content)
            content_hash = hashlib.sha256(content).hexdigest()
            previous = self.store.document(doc_id) if doc_id and not seeded else None
            if seeded:
                try:
                    previous = self.store.document(doc_id)
                except HTTPException:
                    pass
            chunk_hash = hashlib.sha256(
                f"{content_hash}:{self.settings.chunk_size}:{self.settings.chunk_overlap}".encode()
            ).hexdigest()
            target_chunks = chunk_pages(
                doc_id or "new", chunk_hash, pages, self.settings.chunk_size, self.settings.chunk_overlap
            )
            existing_ids = {c["id"] for c in self.store.chunks() if c["document_id"] == doc_id}
            if (
                previous
                and previous["hash"] == content_hash
                and existing_ids == {c["id"] for c in target_chunks}
            ):
                if embed:
                    self.index_document(previous["id"])
                return previous["id"]
            doc_id = doc_id or str(uuid.uuid4())
            title = next(
                (
                    line.lstrip("# ").strip()
                    for _, text in pages
                    for line in text.splitlines()
                    if line.strip()
                ),
                filename,
            )[:150]
            chunks = chunk_pages(
                doc_id, chunk_hash, pages, self.settings.chunk_size, self.settings.chunk_overlap
            )
            old_ids = [c["id"] for c in self.store.chunks() if c["document_id"] == doc_id]
            # New vectors are prepared before switching SQLite's active chunk set.
            if embed:
                self._embed_chunks(chunks)
            self.store.replace_document(
                dict(
                    id=doc_id,
                    title=title,
                    filename=filename,
                    content="\n\n".join(t for _, t in pages),
                    hash=content_hash,
                    version=previous["version"] + 1 if previous else 1,
                    seeded=bool(previous["seeded"]) if previous else seeded,
                ),
                chunks,
            )
            if self._collection is not None and old_ids:
                self.collection.delete(ids=old_ids)
            return doc_id

    def _embed_chunks(self, chunks):
        vectors = self.provider.embed([c["section"] + "\n" + c["text"] for c in chunks])
        self.collection.upsert(
            ids=[c["id"] for c in chunks],
            embeddings=vectors,
            metadatas=[{"chunk_id": c["id"], "document_id": c["document_id"]} for c in chunks],
        )

    def index_document(self, doc_id):
        with self.lock:
            chunks = [c for c in self.store.chunks() if c["document_id"] == doc_id]
            existing = set(self.collection.get(ids=[c["id"] for c in chunks])["ids"])
            missing = [c for c in chunks if c["id"] not in existing]
            if missing:
                self._embed_chunks(missing)

    def delete(self, doc_id):
        with self.lock:
            self.store.document(doc_id)
            ids = [c["id"] for c in self.store.chunks() if c["document_id"] == doc_id]
            self.store.delete_document(doc_id)
            if self._collection is not None and ids:
                self.collection.delete(ids=ids)

    def search(self, question, mode="hybrid", k=None):
        with self.lock:
            chunks = self.store.chunks(self.settings.app_mode == "public")
            if not chunks:
                return []
            ids = [c["id"] for c in chunks]
            indexed = set(self.collection.get(ids=ids)["ids"])
            if len(indexed) != len(ids):
                raise HTTPException(
                    409, "Knowledge needs indexing. An administrator must index all documents first."
                )
            vector = self.provider.embed([question])[0]
            n = min(self.settings.retrieval_candidates, len(chunks))
            dense = self.collection.query(
                query_embeddings=[vector],
                n_results=n,
                where={"chunk_id": {"$in": ids}},
                include=["distances"],
            )
            dense_ids = dense["ids"][0]
            sparse_scores = BM25Okapi([tokenize(c["section"] + " " + c["text"]) for c in chunks]).get_scores(
                tokenize(question)
            )
            sparse_ids = [
                chunks[i]["id"]
                for i in sorted(range(len(chunks)), key=lambda i: (-sparse_scores[i], chunks[i]["id"]))[:n]
                if sparse_scores[i] > 0
            ]
            ordered = dense_ids if mode == "semantic" else rrf([dense_ids, sparse_ids], self.settings.rrf_k)
            by_id = {c["id"]: c for c in chunks}
            return [
                {
                    **by_id[chunk_id],
                    "rank": rank + 1,
                    "semantic_rank": dense_ids.index(chunk_id) + 1 if chunk_id in dense_ids else None,
                    "keyword_rank": sparse_ids.index(chunk_id) + 1 if chunk_id in sparse_ids else None,
                }
                for rank, chunk_id in enumerate(ordered[: k or self.settings.context_chunks])
            ]
