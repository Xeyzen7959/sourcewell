import hashlib

import pytest
from fastapi.testclient import TestClient

from backend.config import Settings
from backend.main import create_app
from backend.models import AnswerDraft, Claim, SupportCheck, SupportVerdict


class FakeProvider:
    """Deterministic test double. Never evidence of real embedding or answer quality."""

    def __init__(self, settings, store):
        self.available = True

    def embed(self, texts):
        vectors = []
        for text in texts:
            values = [0.01] * 32
            for word in text.lower().split():
                values[hashlib.sha256(word.encode()).digest()[0] % 32] += 1.0
            vectors.append(values)
        return vectors

    def start_usage(self):
        pass

    def usage(self):
        return []

    def answer(self, question, chunks):
        return AnswerDraft(
            answer="Unchecked parallel text must not be displayed",
            claims=[Claim(text=chunks[0]["text"], citation_ids=[chunks[0]["id"]])],
            status="answered",
            explanation="Fake provider output for pipeline tests only.",
            next_action="Inspect sources.",
        )

    def support(self, claims, chunks):
        return SupportCheck(
            verdicts=[
                SupportVerdict(claim_index=i, supported=True, reason="Test fixture")
                for i in range(len(claims))
            ]
        )


@pytest.fixture
def settings(tmp_path):
    return Settings(
        data_dir=tmp_path,
        admin_token="test-admin-only",
        requests_per_minute=1000,
        openai_api_key="",
        _env_file=None,
    )


@pytest.fixture
def app(settings):
    return create_app(settings, FakeProvider)


@pytest.fixture
def client(app):
    with TestClient(app) as client:
        yield client
