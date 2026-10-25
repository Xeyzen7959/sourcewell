from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend.main import create_app
from backend.models import TicketUpdate
from backend.store import Store
from backend.tests.conftest import FakeProvider
from backend.tests.test_api import ask_example


def test_public_requires_secure_cookies(settings):
    with pytest.raises(ValueError):
        create_app(settings.model_copy(update={"app_mode": "public"}))


def test_mode_switch_never_exposes_local_handoffs_or_session_token(settings):
    local_app = create_app(settings, FakeProvider)
    with TestClient(local_app) as local:
        answer = ask_example(local)
        local.post("/api/handoffs", json={"answer_id": answer["id"], "reason": "Private local review"})
        cookie = local.cookies.get("sourcewell_session")
    public_settings = settings.model_copy(update={"app_mode": "public", "cookie_secure": True})
    with TestClient(create_app(public_settings, FakeProvider), base_url="https://testserver") as public:
        public.cookies.set("sourcewell_session", cookie)
        assert public.get("/api/tickets").json() == []
        answer = ask_example(public)
        ticket = public.post(
            "/api/handoffs", json={"answer_id": answer["id"], "reason": "Public review"}
        ).json()
        assert "owner" not in public.get("/api/tickets").json()[0]
        assert "owner" not in public.get(f"/api/tickets/{ticket['id']}").json()


def test_retention_rejects_expired_data_and_cleanup_preserves_local_history(settings):
    store = Store(settings.data_dir, retention_hours=24)
    public = store.save_answer("public:visitor", {"question": "Test"})
    local = store.save_answer("local-visitor", {"question": "Test"})
    ticket = store.handoff("public:visitor", public["id"], "Review")
    old = (datetime.now(timezone.utc) - timedelta(hours=25)).isoformat()
    with store.db() as db:
        db.execute("UPDATE answers SET created_at=?", (old,))
        db.execute("UPDATE tickets SET created_at=?", (old,))
    assert store.tickets("public:visitor") == []
    with pytest.raises(HTTPException):
        store.answer("public:visitor", public["id"])
    with pytest.raises(HTTPException):
        store.update_ticket("public:visitor", ticket, TicketUpdate(status="resolved"))
    assert store.cleanup_sessions() == 1
    assert store.answer("local-visitor", local["id"])


def test_usage_cap_is_atomic_under_concurrent_reservations(settings):
    store = Store(settings.data_dir)

    def reserve(_):
        try:
            store.reserve_call("generation", "test", 3)
            return True
        except HTTPException:
            return False

    with ThreadPoolExecutor(max_workers=8) as executor:
        assert sum(executor.map(reserve, range(12))) == 3
    assert store.remaining_calls(3) == 0


def test_busy_live_capacity_does_not_block_recorded_examples(settings):
    settings.max_concurrent_live_requests = 1
    app = create_app(settings, FakeProvider)
    with TestClient(app) as client:
        with app.state.live_gate.acquire():
            response = client.post("/api/ask", json={"question": "My live question", "mode": "live"})
            assert response.status_code == 429 and "busy" in response.json()["detail"]
            assert ask_example(client)["mode"] == "recorded"
        # A failure must release capacity for the next attempt.
        first = client.post("/api/ask", json={"question": "My live question", "mode": "live"})
        assert first.status_code == 409
        assert (
            client.post("/api/ask", json={"question": "My live question", "mode": "live"}).status_code == 409
        )


def test_budget_exhaustion_is_explicit_and_recorded_mode_remains_available(settings):
    settings.daily_provider_call_limit = 0
    app = create_app(settings, FakeProvider)
    with TestClient(app) as client:
        assert client.get("/api/config").json()["live_status"] == "budget_exhausted"
        assert (
            client.post("/api/ask", json={"question": "A live question", "mode": "live"}).status_code == 429
        )
        assert ask_example(client)["mode"] == "recorded"


def test_request_body_limits_cover_fixed_and_chunked_requests(client):
    assert (
        client.post(
            "/api/ask", content=b"x" * 17000, headers={"Content-Type": "application/json"}
        ).status_code
        == 413
    )
    assert (
        client.post(
            "/api/ask", content=iter([b"x" * 9000, b"x" * 9000]), headers={"Content-Type": "application/json"}
        ).status_code
        == 413
    )


def test_public_review_writes_and_exports_are_disabled(settings):
    app = create_app(settings.model_copy(update={"app_mode": "public", "cookie_secure": True}), FakeProvider)
    with TestClient(app, base_url="https://testserver") as client:
        assert (
            client.get("/api/reviews-export", headers={"X-Admin-Token": "test-admin-only"}).status_code == 403
        )
        assert (
            client.post(
                "/api/reviews/q001", json={}, headers={"X-Admin-Token": "test-admin-only"}
            ).status_code
            == 403
        )


def test_https_origin_behind_internal_http_proxy_is_explicitly_allowed(settings):
    settings = settings.model_copy(
        update={"app_mode": "public", "cookie_secure": True, "public_origin": "https://demo.example"}
    )
    with TestClient(create_app(settings, FakeProvider), base_url="http://internal") as client:
        response = client.post(
            "/api/ask",
            json={"question": "Can I get a refund for my first subscription?"},
            headers={"Origin": "https://demo.example"},
        )
        assert response.status_code == 200
        assert "Secure" in response.headers["set-cookie"]
        assert (
            client.post(
                "/api/ask", json={"question": "Test question"}, headers={"Origin": "https://other.example"}
            ).status_code
            == 403
        )
