import json

import httpx
import pytest
from fastapi import HTTPException
from openai import OpenAI
from pydantic import SecretStr

from backend.models import AnswerDraft
from backend.provider import Provider
from backend.store import Store


@pytest.mark.parametrize("gateway", [False, True])
def test_installed_sdk_uses_expected_responses_schema_and_embedding_endpoint(settings, gateway, monkeypatch):
    # MockTransport exercises the actual SDK serialization/parsing, not provider quality.
    if gateway:
        settings = settings.model_copy(
            update={
                "ai_provider": "vercel",
                "ai_gateway_api_key": SecretStr("test-value-not-real"),
                "generation_model": "google/gemini-2.5-flash-lite",
                "embedding_model": "openai/text-embedding-3-small",
            }
        )
    else:
        settings = settings.model_copy(update={"openai_api_key": SecretStr("test-value-not-real")})
    requests = []

    def handle(request):
        body = json.loads(request.content)
        requests.append((request.url.host, request.url.path, body))
        if request.url.path.endswith("/embeddings"):
            return httpx.Response(
                200,
                json={
                    "object": "list",
                    "model": settings.embedding_model,
                    "data": [{"object": "embedding", "index": 0, "embedding": [1.0, 0.0, 0.0]}],
                    "usage": {"prompt_tokens": 4, "total_tokens": 4},
                },
            )
        draft = dict(
            answer="Need more information",
            claims=[],
            status="insufficient_evidence",
            explanation="No matching evidence",
            next_action="Clarify the question",
        )
        return httpx.Response(
            200,
            json={
                "id": "resp_test",
                "object": "response",
                "created_at": 1,
                "status": "completed",
                "model": settings.generation_model,
                "output": [
                    {
                        "type": "message",
                        "id": "msg_test",
                        "role": "assistant",
                        "status": "completed",
                        "content": [{"type": "output_text", "text": json.dumps(draft), "annotations": []}],
                    }
                ],
                "usage": {"input_tokens": 15, "output_tokens": 10, "total_tokens": 25},
            },
        )

    provider = Provider(settings, Store(settings.data_dir))
    host = "ai-gateway.vercel.sh" if gateway else "api.openai.com"
    monkeypatch.setattr("backend.provider.OpenAI", lambda **kwargs: OpenAI(
        **kwargs, http_client=httpx.Client(transport=httpx.MockTransport(handle))))
    provider.start_usage()
    assert provider.embed(["Evidence"]) == [[1.0, 0.0, 0.0]]
    parsed = provider._parse("System instructions", {"question": "Question"}, AnswerDraft)
    assert parsed.status == "insufficient_evidence"
    assert requests[1][2]["text"]["format"]["type"] == "json_schema"
    assert requests[1][2]["model"] == settings.generation_model
    assert all(request[0] == host for request in requests)
    assert len(provider.usage()) == 2 and all(u["usage_known"] for u in provider.usage())


def test_failed_provider_call_keeps_unknown_usage_visible(settings):
    settings = settings.model_copy(update={"openai_api_key": SecretStr("test-value-not-real")})
    provider = Provider(settings, Store(settings.data_dir))
    provider._client = OpenAI(
        api_key="test-value-not-real",
        max_retries=0,
        http_client=httpx.Client(
            transport=httpx.MockTransport(
                lambda r: httpx.Response(503, json={"error": {"message": "Unavailable"}})
            )
        ),
    )
    with pytest.raises(HTTPException):
        provider.embed(["Evidence"])
    assert provider.usage()[0]["usage_known"] is False
    assert (
        provider.store.remaining_calls(settings.daily_provider_call_limit)
        == settings.daily_provider_call_limit - 1
    )
