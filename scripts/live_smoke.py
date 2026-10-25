"""One bounded, paid, seed-only HTTP smoke flow for both retrieval modes and human handoff."""

from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient

from backend.config import Settings
from backend.main import create_app
from backend.provider import Provider
from backend.store import Store


def main():
    settings = Settings()
    if not settings.provider_key.get_secret_value():
        raise SystemExit(
            f"BLOCKED: {settings.credential_name} is not configured. No live verification performed."
        )
    budget_store = Store(settings.data_dir)
    with TemporaryDirectory(prefix="sourcewell-live-smoke-") as directory:
        isolated = settings.model_copy(
            update={"data_dir": Path(directory), "app_mode": "public", "cookie_secure": True}
        )
        app = create_app(isolated, lambda config, _: Provider(config, budget_store))
        with TestClient(app, base_url="https://testserver") as client:
            for doc in app.state.store.documents(public=True):
                app.state.retriever.index_document(doc["id"])
            for mode in ["semantic", "hybrid"]:
                response = client.post(
                    "/api/ask",
                    json={"question": "How do I fix error E-207?", "mode": "live", "search_mode": mode},
                )
                assert response.status_code == 200, f"{mode}: HTTP {response.status_code}"
                answer = response.json()
                assert answer["mode"] == "live" and answer["citation_validation"] == "valid"
                assert answer["status"] == "answered", f"{mode}: expected a grounded answer"
                result = client.post(
                    "/api/handoffs",
                    json={"answer_id": answer["id"], "reason": "Live smoke specialist review"},
                )
                assert result.status_code == 200
                ticket = client.get(f"/api/tickets/{result.json()['id']}")
                assert ticket.status_code == 200 and ticket.json()["answer"]["sources"] == answer["sources"]
                print(
                    f"{mode}: real retrieval, generation, citation assessment, and persisted handoff passed."
                )
    print("Live smoke passed. This is not a quality benchmark or prompt-injection robustness evaluation.")


if __name__ == "__main__":
    main()
