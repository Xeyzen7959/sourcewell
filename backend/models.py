from typing import Literal

from pydantic import BaseModel, Field


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
