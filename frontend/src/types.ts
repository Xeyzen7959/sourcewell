export type Page = "ask" | "knowledge" | "inbox" | "evaluation";
export type Status =
  | "answered"
  | "insufficient_evidence"
  | "conflicting_evidence";
export type Source = {
  id: string;
  document_id: string;
  title: string;
  filename: string;
  section: string;
  page: number | null;
  text: string;
  version?: number;
  rank?: number;
  semantic_rank?: number;
  keyword_rank?: number;
};
export type Claim = { text: string; citation_ids: string[] };
export type Answer = {
  id: string;
  question: string;
  answer: string;
  claims: Claim[];
  status: Status;
  explanation: string;
  next_action: string;
  sources: Source[];
  mode: "live" | "recorded";
  citation_validation: string;
  support_assessment: string;
  latency_ms: number;
  model: string;
  usage: {
    kind: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    estimated_cost_usd: number | null;
  }[];
};
export type Config = {
  live_available: boolean;
  app_mode: string;
  admin_available: boolean;
  generation_model: string;
  embedding_model: string;
  max_upload_bytes: number;
  examples: { id: string; question: string; category: string }[];
};
export type Document = {
  id: string;
  title: string;
  filename: string;
  version: number;
  seeded: boolean;
  updated_at: string;
  chunk_count: number;
  content?: string;
  chunks?: Source[];
};
export type Ticket = {
  id: string;
  question: string;
  reason: string;
  status: "open" | "in_progress" | "resolved";
  note: string;
  draft_reply: string;
  created_at: string;
  answer?: Answer;
};
export type EvalCase = {
  id: string;
  question: string;
  split: string;
  category: string;
  expected_status: Status;
  relevant_documents: string[];
  expected_behavior: string;
  review_status: string;
};
export type EvalRow = {
  id: string;
  mode: string;
  status: string;
  expected_status: string;
  recall_at_k: number | null;
  citation_reference_rate: number | null;
  model_support_pass: boolean | null;
  latency_ms: number;
  error?: string;
};
export type EvalResult = {
  status: string;
  message?: string;
  dataset_sha256?: string;
  timestamp?: string;
  split?: string;
  generation_model?: string;
  embedding_model?: string;
  configuration?: Record<string, string | number>;
  summaries?: {
    mode: string;
    cases: number;
    retrieval_recall_at_k: number | null;
    valid_citation_reference_rate: number | null;
    abstention_accuracy: number | null;
    model_support_pass_rate: number | null;
    average_latency_ms: number;
    estimated_cost_usd: number | null;
  }[];
  cases?: EvalRow[];
};
export type Evaluation = {
  dataset_version: string;
  review_status: string;
  count: number;
  development_count: number;
  held_out_count: number;
  cases: EvalCase[];
  results: EvalResult | null;
};
