from contextlib import contextmanager
from threading import BoundedSemaphore

from fastapi import HTTPException
from starlette.responses import JSONResponse


class BodyLimitMiddleware:
    """Bound bodies before multipart/JSON parsing, including chunked uploads."""

    def __init__(self, app, max_json_bytes, max_upload_bytes):
        self.app = app
        self.json_limit = max_json_bytes
        self.upload_limit = max_upload_bytes + 65_536

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] in {"GET", "HEAD", "OPTIONS"}:
            return await self.app(scope, receive, send)
        headers = dict(scope["headers"])
        limit = (
            self.upload_limit
            if headers.get(b"content-type", b"").startswith(b"multipart/")
            else self.json_limit
        )
        length = headers.get(b"content-length", b"0")
        if not length.isdigit() or int(length) > limit:
            response = JSONResponse(
                {"detail": "Request body is too large or has an invalid length"}, status_code=413
            )
            return await response(scope, receive, send)
        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body.extend(message.get("body", b""))
            if len(body) > limit:
                return await JSONResponse({"detail": "Request body is too large"}, status_code=413)(
                    scope, receive, send
                )
            if not message.get("more_body", False):
                break
        consumed = False

        async def replay():
            nonlocal consumed
            if not consumed:
                consumed = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        await self.app(scope, replay, send)


class LiveGate:
    def __init__(self, limit):
        self.slots = BoundedSemaphore(limit)

    @contextmanager
    def acquire(self):
        if not self.slots.acquire(blocking=False):
            raise HTTPException(429, "Live capacity is busy. Try again shortly or choose recorded examples.")
        try:
            yield
        finally:
            self.slots.release()
