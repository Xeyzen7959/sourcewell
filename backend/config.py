from pathlib import Path

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")
    openai_api_key: SecretStr = SecretStr("")
    generation_model: str = "gpt-6-luna"
    embedding_model: str = "text-embedding-3-small"
    data_dir: Path = ROOT / "data"
    app_mode: str = "local"
    admin_token: SecretStr = SecretStr("")
    cookie_secure: bool = False
    daily_provider_call_limit: int = Field(default=100, ge=0, le=10000)
    requests_per_minute: int = Field(default=20, ge=1, le=1000)
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
        return self

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
