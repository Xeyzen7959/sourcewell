from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Claim(BaseModel):
    text: str = Field(min_length=1, max_length=1500)
    citation_ids: list[str] = Field(max_length=10)


class AnswerDraft(BaseModel):
    answer: str = Field(max_length=6000)
    claims: list[Claim] = Field(max_length=12)
    status: Literal["answered", "insufficient_evidence", "conflicting_evidence"]
    explanation: str = Field(max_length=2000)
    next_action: str = Field(max_length=1000)


class SupportVerdict(BaseModel):
    claim_index: int
    supported: bool
    reason: str = Field(max_length=1000)


class SupportCheck(BaseModel):
    verdicts: list[SupportVerdict]


class AskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=1200)
    mode: Literal["recorded", "live"] = "recorded"
    search_mode: Literal["semantic", "hybrid"] = "hybrid"


class HandoffRequest(BaseModel):
    answer_id: str
    reason: str = Field(min_length=3, max_length=1000)


class TicketUpdate(BaseModel):
    status: Literal["open", "in_progress", "resolved"]
    note: str = Field(default="", max_length=2000)
    draft_reply: str = Field(default="", max_length=5000)


class AnnotationReview(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    question: str = Field(min_length=3, max_length=1200)
    expected_behavior: str = Field(min_length=10, max_length=4000)
    expected_status: Literal["answered", "insufficient_evidence", "conflicting_evidence"]
    relevant_documents: list[str] = Field(max_length=24)
    reviewer: str = Field(min_length=2, max_length=100)
    note: str = Field(default="", max_length=1000)
    attestation: Literal[True]


class AnswerQualityReview(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    run_fingerprint: str = Field(min_length=64, max_length=64)
    mode: Literal["semantic", "hybrid"]
    grade: int = Field(ge=0, le=4)
    reviewer: str = Field(min_length=2, max_length=100)
    reason: str = Field(min_length=10, max_length=2000)
    attestation: Literal[True]
