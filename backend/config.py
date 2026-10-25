from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")
    openai_api_key: SecretStr = SecretStr("")
    ai_provider: Literal["openai", "vercel"] = "openai"
    ai_gateway_api_key: SecretStr = SecretStr("")
    generation_model: str = "gpt-6-luna"
    embedding_model: str = "text-embedding-3-small"
    data_dir: Path = ROOT / "data"
    app_mode: str = "local"
    admin_token: SecretStr = SecretStr("")
    cookie_secure: bool = False
    public_origin: str = ""
    daily_provider_call_limit: int = Field(default=100, ge=0, le=10000)
    requests_per_minute: int = Field(default=20, ge=1, le=1000)
    max_concurrent_live_requests: int = Field(default=2, ge=1, le=8)
    session_retention_hours: int = Field(default=24, ge=1, le=168)
    max_json_bytes: int = Field(default=16_384, ge=4096, le=65_536)
    max_upload_bytes: int = Field(default=2_000_000, ge=100, le=10_000_000)
    chunk_size: int = Field(default=1200, ge=200, le=4000)
    chunk_overlap: int = Field(default=150, ge=0, le=500)
    retrieval_candidates: int = Field(default=10, ge=1, le=30)
    context_chunks: int = Field(default=5, ge=1, le=10)
    rrf_k: int = Field(default=60, ge=1, le=1000)
    generation_input_price: float | None = Field(default=None, ge=0)
    generation_output_price: float | None = Field(default=None, ge=0)
    embedding_input_price: float | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_chunking(self):
        if self.chunk_overlap >= self.chunk_size:
            raise ValueError("CHUNK_OVERLAP must be smaller than CHUNK_SIZE")
        if self.app_mode == "public" and not self.cookie_secure:
            raise ValueError("Public mode requires COOKIE_SECURE=true and an HTTPS reverse proxy")
        if self.public_origin:
            origin = urlsplit(self.public_origin)
            if (
                origin.scheme != "https"
                or not origin.hostname
                or origin.path not in {"", "/"}
                or origin.query
                or origin.fragment
                or origin.username
                or origin.password
            ):
                raise ValueError(
                    "PUBLIC_ORIGIN must be an HTTPS origin without credentials, a path, or a query"
                )
        if self.ai_provider == "vercel" and any(
            "/" not in m for m in (self.generation_model, self.embedding_model)
        ):
            raise ValueError("Vercel Gateway model IDs must use verified provider/model slugs")
        return self

    @property
    def provider_key(self):
        return self.ai_gateway_api_key if self.ai_provider == "vercel" else self.openai_api_key

    @property
    def credential_name(self):
        return "AI_GATEWAY_API_KEY" if self.ai_provider == "vercel" else "OPENAI_API_KEY"

    @field_validator(
        "generation_input_price", "generation_output_price", "embedding_input_price", mode="before"
    )
    @classmethod
    def optional_price(cls, value):
        return None if value in ("", None) else value

    @field_validator("app_mode")
    @classmethod
    def check_mode(cls, value):
        if value not in {"local", "public"}:
            raise ValueError("APP_MODE must be local or public")
        return value
