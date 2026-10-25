import asyncio
import contextlib
import hmac
import json
import re
import secrets
import threading
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

from backend.config import ROOT, Settings
from backend.evaluation import dataset, load_results, review_records, save_review
from backend.guards import BodyLimitMiddleware, LiveGate
from backend.models import AnnotationReview, AnswerQualityReview, AskRequest, HandoffRequest, TicketUpdate
from backend.provider import Provider, check_answer
from backend.retrieval import Retriever
from backend.store import Store


def create_app(settings=None, provider_factory=Provider):
    settings = settings or Settings()
    if settings.app_mode == "public" and not settings.cookie_secure:
        raise ValueError("Public mode requires COOKIE_SECURE=true")
    store = Store(
        settings.data_dir, settings.session_retention_hours if settings.app_mode == "public" else None
    )
    provider = provider_factory(settings, store)
    retriever = Retriever(store, settings, provider)
    examples = json.loads((ROOT / "fixtures/examples.json").read_text())
    gate = LiveGate(settings.max_concurrent_live_requests)

    async def cleanup_loop():
        while True:
            await asyncio.sleep(3600)
            await run_in_threadpool(store.cleanup_sessions)

    @asynccontextmanager
    async def lifespan(app):
        for path in sorted((ROOT / "fixtures/documents").glob("*.md")):
            retriever.ingest(path.name, path.read_bytes(), doc_id=path.stem, seeded=True)
        store.cleanup_sessions()
        cleanup_task = asyncio.create_task(cleanup_loop())
        try:
            yield
        finally:
            cleanup_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await cleanup_task

    app = FastAPI(title="Sourcewell", version="0.1.0", lifespan=lifespan)
    app.state.store, app.state.retriever, app.state.provider = store, retriever, provider
    app.state.live_gate = gate
    app.add_middleware(
        BodyLimitMiddleware,
        max_json_bytes=settings.max_json_bytes,
        max_upload_bytes=settings.max_upload_bytes,
    )
    limiter_lock = threading.Lock()
    buckets = defaultdict(deque)

    @app.middleware("http")
    async def session_and_security(request: Request, call_next):
        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            # Same-origin browser mutations only. No permissive CORS middleware.
            origin = request.headers.get("origin")
            expected_origin = settings.public_origin.rstrip("/") or str(request.base_url).rstrip("/")
            if origin and origin != expected_origin:
                return JSONResponse({"detail": "Cross-origin mutations are not allowed"}, status_code=403)
            if request.headers.get("sec-fetch-site") == "cross-site":
                return JSONResponse({"detail": "Cross-site mutations are not allowed"}, status_code=403)
        cookie = request.cookies.get("sourcewell_session", "")
        owner = cookie if re.fullmatch(r"[a-f0-9]{64}", cookie) else secrets.token_hex(32)
        request.state.owner = f"public:{owner}" if settings.app_mode == "public" else owner
        response = await call_next(request)
        if cookie != owner:
            response.set_cookie(
                "sourcewell_session",
                owner,
                httponly=True,
                samesite="strict",
                secure=settings.cookie_secure,
                max_age=settings.session_retention_hours * 3600
                if settings.app_mode == "public"
                else 86400 * 7,
            )
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "same-origin"
        response.headers["Cache-Control"] = "no-store"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
            "connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        )
        return response

    def limited(request: Request):
        current = time.monotonic()
        ip = request.client.host if request.client else "unknown"
        with limiter_lock:
            if len(buckets) > 10000:
                for key in list(buckets):
                    if not buckets[key] or buckets[key][-1] < current - 60:
                        del buckets[key]
            queue = buckets[ip]
            while queue and queue[0] < current - 60:
                queue.popleft()
            if len(queue) >= settings.requests_per_minute:
                raise HTTPException(429, "Too many requests. Wait a minute and try again.")
            queue.append(current)

    def admin(request: Request):
        token = settings.admin_token.get_secret_value()
        if (
            settings.app_mode == "public"
            or not token
            or not hmac.compare_digest(token, request.headers.get("x-admin-token", ""))
        ):
            raise HTTPException(
                403, "Document administration is disabled or requires a valid administrator token."
            )

    def require_budget():
        if store.remaining_calls(settings.daily_provider_call_limit) == 0:
            raise HTTPException(429, "Daily provider-call cap reached. Try recorded examples.")

    @app.get("/api/config")
    def config():
        remaining = store.remaining_calls(settings.daily_provider_call_limit)
        return dict(
            live_available=provider.available,
            app_mode=settings.app_mode,
            admin_available=settings.app_mode == "local" and bool(settings.admin_token.get_secret_value()),
            generation_model=settings.generation_model,
            embedding_model=settings.embedding_model,
            examples=[{k: ex[k] for k in ("id", "question", "category")} for ex in examples],
            max_upload_bytes=settings.max_upload_bytes,
            live_status="missing_credentials"
            if not provider.available
            else "budget_exhausted"
            if remaining == 0
            else "available",
            provider=settings.ai_provider,
            credential_name=settings.credential_name,
            session_retention_hours=settings.session_retention_hours
            if settings.app_mode == "public"
            else None,
        )

    @app.get("/api/health")
    def health():
        return {"status": "ok", "live_available": provider.available}

    @app.get("/api/ready")
    def ready():
        if len(store.documents(public=True)) != len(list((ROOT / "fixtures/documents").glob("*.md"))):
            raise HTTPException(503, "Fictional corpus is not ready")
        return {"status": "ready", "recorded_available": True}

    @app.get("/api/documents")
    def documents():
        return store.documents(settings.app_mode == "public")

    @app.get("/api/documents/{doc_id}")
    def document(doc_id: str):
        doc = store.document(doc_id, settings.app_mode == "public")
        doc["chunks"] = [c for c in store.chunks(settings.app_mode == "public") if c["document_id"] == doc_id]
        return doc

    async def read_upload(file):
        content = await file.read(settings.max_upload_bytes + 1)
        if len(content) > settings.max_upload_bytes:
            raise HTTPException(413, f"Upload exceeds {settings.max_upload_bytes} bytes.")
        return content

    @app.post("/api/documents", dependencies=[Depends(limited), Depends(admin)])
    async def upload(file: UploadFile = File(...)):
        content = await read_upload(file)
        doc_id = await run_in_threadpool(retriever.ingest, file.filename or "", content)
        return {"id": doc_id, "status": "ingested", "message": "Text saved. Index it before live search."}

    @app.put("/api/documents/{doc_id}", dependencies=[Depends(limited), Depends(admin)])
    async def replace(doc_id: str, file: UploadFile = File(...)):
        if store.document(doc_id)["seeded"]:
            raise HTTPException(403, "Seed documents are read-only. Upload a separate document instead.")
        content = await read_upload(file)
        await run_in_threadpool(retriever.ingest, file.filename or "", content, doc_id)
        return {
            "id": doc_id,
            "status": "replaced",
            "message": "Replacement saved. Reindex before live search.",
        }

    @app.post("/api/documents/{doc_id}/index", dependencies=[Depends(limited), Depends(admin)])
    def index(doc_id: str):
        store.document(doc_id)
        with gate.acquire():
            retriever.index_document(doc_id)
        return {"status": "indexed"}

    @app.post("/api/index", dependencies=[Depends(limited), Depends(admin)])
    def index_all():
        with gate.acquire():
            for doc in store.documents():
                retriever.index_document(doc["id"])
        return {
            "status": "indexed",
            "message": "All current chunks indexed with the configured embedding model.",
        }

    @app.delete("/api/documents/{doc_id}", dependencies=[Depends(limited), Depends(admin)])
    def delete(doc_id: str):
        if store.document(doc_id)["seeded"]:
            raise HTTPException(403, "Seed documents are read-only.")
        retriever.delete(doc_id)
        return {"status": "deleted"}

    @app.post("/api/retrieve", dependencies=[Depends(limited)])
    def retrieve(body: AskRequest):
        if body.mode != "live":
            raise HTTPException(422, "Retrieval is live-only. Recorded examples contain saved evidence.")
        require_budget()
        with gate.acquire():
            return retriever.search(body.question, body.search_mode)

    @app.post("/api/ask", dependencies=[Depends(limited)])
    def ask(body: AskRequest, request: Request):
        started = time.perf_counter()
        if body.mode == "recorded":
            example = next((ex for ex in examples if ex["question"] == body.question), None)
            if not example:
                raise HTTPException(
                    422,
                    "Recorded mode supports the listed example questions only. Use live mode for your own.",
                )
            chunks = store.chunks(settings.app_mode == "public")
            sources = []
            for evidence in example["evidence"]:
                chunk = next(
                    (
                        c
                        for c in chunks
                        if c["document_id"] == evidence["document_id"] and evidence["contains"] in c["text"]
                    ),
                    None,
                )
                if not chunk:
                    raise HTTPException(
                        409, "Recorded evidence no longer matches the corpus. Refresh the seed data."
                    )
                sources.append({**chunk, "rank": len(sources) + 1})
            claims = [
                dict(text=c["text"], citation_ids=[sources[i]["id"] for i in c["source_indices"]])
                for c in example["claims"]
            ]
            payload = dict(
                answer=example["answer"],
                claims=claims,
                status=example["status"],
                explanation=example["explanation"],
                next_action=example["next_action"],
                sources=sources,
                citation_validation="valid"
                if all(c["citation_ids"] for c in claims) and claims
                else "not_applicable",
                support_assessment="recorded_not_live_verified",
                support_details=[],
                usage=[],
                mode="recorded",
            )
        else:
            provider.start_usage()
            if not provider.available:
                raise HTTPException(
                    503, f"Live mode requires {settings.credential_name}. Select recorded examples instead."
                )
            require_budget()
            with gate.acquire():
                sources = retriever.search(body.question, body.search_mode)
                payload = check_answer(provider, body.question, sources)
                payload.update(sources=sources, usage=provider.usage(), mode="live")
        payload.update(
            question=body.question,
            search_mode=body.search_mode,
            latency_ms=round((time.perf_counter() - started) * 1000),
            model=settings.generation_model if body.mode == "live" else "recorded fixture",
            embedding_model=settings.embedding_model if body.mode == "live" else None,
        )
        return store.save_answer(request.state.owner, payload)

    @app.post("/api/handoffs", dependencies=[Depends(limited)])
    def handoff(body: HandoffRequest, request: Request):
        return {"id": store.handoff(request.state.owner, body.answer_id, body.reason)}

    @app.get("/api/tickets")
    def tickets(request: Request):
        return [{k: v for k, v in t.items() if k != "owner"} for t in store.tickets(request.state.owner)]

    @app.get("/api/tickets/{ticket_id}")
    def ticket(ticket_id: str, request: Request):
        ticket = next((t for t in store.tickets(request.state.owner) if t["id"] == ticket_id), None)
        if not ticket:
            raise HTTPException(404, "Ticket not found in this session")
        ticket["answer"] = store.answer(request.state.owner, ticket["answer_id"])
        ticket.pop("owner", None)
        return ticket

    @app.patch("/api/tickets/{ticket_id}", dependencies=[Depends(limited)])
    def patch_ticket(ticket_id: str, body: TicketUpdate, request: Request):
        store.update_ticket(request.state.owner, ticket_id, body)
        return {"status": "saved"}

    @app.get("/api/evaluation")
    def evaluation():
        data = dataset(settings)
        return dict(
            dataset_version=data["version"],
            review_status=data["review_status"],
            reviewed_count=data["reviewed_count"],
            count=len(data["cases"]),
            development_count=sum(c["split"] == "development" for c in data["cases"]),
            held_out_count=sum(c["split"] == "held_out" for c in data["cases"]),
            cases=data["cases"],
            results=load_results(settings),
        )

    @app.post("/api/reviews/{case_id}", dependencies=[Depends(limited), Depends(admin)])
    def review_annotation(case_id: str, body: AnnotationReview):
        return save_review(settings, case_id, body)

    @app.post("/api/answer-reviews/{case_id}", dependencies=[Depends(limited), Depends(admin)])
    def review_answer(case_id: str, body: AnswerQualityReview):
        return save_review(settings, case_id, body, "answer_reviews")

    @app.get("/api/reviews-export", dependencies=[Depends(admin)])
    def export_reviews():
        return review_records(settings)

    dist = ROOT / "frontend/dist"
    if (dist / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")
        if (dist / "preview").is_dir():
            app.mount("/preview", StaticFiles(directory=dist / "preview"), name="preview")

        @app.get("/{path:path}", include_in_schema=False)
        def frontend(path: str):
            if path.startswith("api/"):
                raise HTTPException(404, "API route not found")
            return FileResponse(dist / "index.html")

    return app
