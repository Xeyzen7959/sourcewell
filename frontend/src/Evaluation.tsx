import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  FlaskConical,
  GitCompareArrows,
  ListChecks,
} from "lucide-react";
import { api } from "./api";
import { Notice } from "./ui";
import { CaseReview, AnswerReview } from "./Review";
import type {
  Config,
  EvalCase,
  EvalRow,
  Evaluation as EvaluationData,
} from "./types";

const percent = (n: number | null) =>
  n === null ? "Not measured" : `${(n * 100).toFixed(1)}%`;

export function Evaluation({ config }: { config: Config }) {
  const [data, setData] = useState<EvaluationData | null>(null);
  const [error, setError] = useState("");
  const [split, setSplit] = useState("development");
  const [selected, setSelected] = useState<EvalCase | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<EvalRow | null>(null);
  const [message, setMessage] = useState("");
  async function refresh() {
    try {
      setData(await api<EvaluationData>("/evaluation"));
      setMessage(
        "Human review saved. Results from earlier annotations may now require a fresh run.",
      );
    } catch (error) {
      setError((error as Error).message);
    }
  }
  async function exportReviews() {
    setError("");
    try {
      const records = await api("/reviews-export", {
        headers: {
          "X-Admin-Token": sessionStorage.getItem("sourcewell_admin") ?? "",
        },
      });
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(records, null, 2) + "\n"], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "reviews.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setError((error as Error).message);
    }
  }
  useEffect(() => {
    let active = true;
    api<EvaluationData>("/evaluation")
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="content-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Show the work</span>
          <h1>Quality, under inspection.</h1>
          <p>A comparison you can reproduce. Results we don’t make up.</p>
        </div>
        <span className="tag">
          <FlaskConical size={13} />
          Evaluation lab
        </span>
      </header>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      {!data && !error && <Notice>Loading evaluation dataset…</Notice>}
      {data && (
        <>
          <div className="evaluation-intro">
            <div>
              <span className="eyebrow">Dataset {data.dataset_version}</span>
              <h2>
                {data.count} questions.
                <br />
                <em>Every assumption visible.</em>
              </h2>
              <p>
                Direct lookups, exact error codes, missing evidence, conflicting
                policies, and malicious source instructions.
              </p>
            </div>
            <div className="dataset-facts">
              <div>
                <strong>{data.development_count}</strong>
                <span>Development cases</span>
              </div>
              <div>
                <strong>{data.held_out_count}</strong>
                <span>Held-out cases</span>
              </div>
              <p>
                {data.review_status === "human_reviewed"
                  ? "All annotations human-reviewed"
                  : "AI-drafted · Human review required"}
                <br />
                {data.reviewed_count} of {data.count} annotations reviewed.
              </p>
            </div>
          </div>
          <section className="comparison-section">
            <div className="section-heading">
              <h2>
                <GitCompareArrows size={19} />
                Semantic vs. hybrid
              </h2>
              <span className="caption">
                Same questions. Same model. Two retrieval paths.
              </span>
            </div>
            {data.results?.summaries ? (
              <>
                {data.results.status !== "completed" && (
                  <Notice>
                    This is a partial evaluation. Inspect failures and sample
                    counts before interpreting any aggregate.
                  </Notice>
                )}
                <div className="comparison-grid">
                  {data.results.summaries.map((summary) => (
                    <article className="comparison-card" key={summary.mode}>
                      <span className="eyebrow">{summary.mode} search</span>
                      <h3>{summary.cases} evaluated cases</h3>
                      <dl>
                        <dt>Failed attempts</dt>
                        <dd>
                          {summary.error_count} / {summary.cases}
                        </dd>
                        <dt>Document Recall@k</dt>
                        <dd>
                          {percent(summary.retrieval_recall_at_k)}{" "}
                          <small>
                            {summary.retrieval_case_count} eligible cases;
                            retrieval errors count as zero
                          </small>
                        </dd>
                        <dt>Valid citation references</dt>
                        <dd>
                          {percent(summary.valid_citation_reference_rate)}
                          <small>
                            {summary.valid_citation_reference_count} /{" "}
                            {summary.citation_reference_count} observed
                            references
                          </small>
                        </dd>
                        <dt>Correct abstention</dt>
                        <dd>{percent(summary.abstention_accuracy)}</dd>
                        <dt>Incorrect abstention</dt>
                        <dd>
                          {percent(summary.incorrect_abstention_rate)}{" "}
                          <small>
                            {summary.answerable_case_count} answerable cases
                          </small>
                        </dd>
                        <dt>Conflict status match</dt>
                        <dd>
                          {percent(summary.conflict_handling_rate)}{" "}
                          <small>
                            {summary.conflict_case_count} conflicting cases
                          </small>
                        </dd>
                        <dt>Model support pass</dt>
                        <dd>
                          {percent(summary.model_support_pass_rate)}{" "}
                          <small>
                            {summary.support_draft_count} observed drafts
                          </small>
                        </dd>
                        <dt>Average latency</dt>
                        <dd>{Math.round(summary.average_latency_ms)} ms</dd>
                        <dt>Median / p95 latency</dt>
                        <dd>
                          {summary.median_latency_ms === null
                            ? "N/A"
                            : `${Math.round(summary.median_latency_ms)} ms`}{" "}
                          /{" "}
                          {summary.p95_latency_ms === null
                            ? "Requires 20 attempts"
                            : `${Math.round(summary.p95_latency_ms)} ms`}
                        </dd>
                        <dt>Reported input / output tokens</dt>
                        <dd>
                          {summary.input_tokens.toLocaleString()} /{" "}
                          {summary.output_tokens.toLocaleString()}
                          <small>
                            {summary.unknown_usage_calls} calls with unknown
                            usage
                          </small>
                        </dd>
                        <dt>Estimated API cost</dt>
                        <dd>
                          {summary.estimated_cost_usd === null
                            ? "Not configured"
                            : `$${summary.estimated_cost_usd.toFixed(5)}`}
                        </dd>
                      </dl>
                      <p className="caption">
                        Human quality: {summary.human_review_count} graded
                        outcomes
                        {summary.human_mean_grade === null
                          ? "; no grade claimed."
                          : `; mean ${summary.human_mean_grade.toFixed(2)} / 4, ${percent(summary.human_pass_rate)} scoring at least 3.`}
                      </p>
                    </article>
                  ))}
                </div>
                <p className="caption">
                  Run: {data.results.timestamp} · Split: {data.results.split} ·{" "}
                  {data.results.generation_model} ·{" "}
                  {data.results.embedding_model}. Model support is a fallible
                  assessment, not correctness. Annotation provenance:{" "}
                  {data.results.dataset_review_status?.replaceAll("_", " ")}.
                </p>
                <details>
                  <summary>Run configuration</summary>
                  <pre>
                    {JSON.stringify(data.results.configuration, null, 2)}
                  </pre>
                </details>
                {data.results.cases && (
                  <details>
                    <summary>Case outcomes and failures</summary>
                    {data.results.cases.map((row, i) => (
                      <button
                        className="eval-result-row"
                        key={`${row.id}-${i}`}
                        onClick={() => setSelectedOutcome(row)}
                      >
                        <code>{row.id}</code>
                        <span>{row.mode}</span>
                        <span>
                          {row.status === row.expected_status && !row.error
                            ? "Expected status"
                            : "Needs review"}
                        </span>
                        <span>
                          {row.error ??
                            `${row.status} / expected ${row.expected_status}`}
                        </span>
                      </button>
                    ))}
                  </details>
                )}
              </>
            ) : (
              <div className="unrun-state">
                <span className="empty-icon">
                  <ListChecks size={27} />
                </span>
                <div>
                  <h3>
                    {data.results?.status === "stale"
                      ? "Results need a fresh run."
                      : "The benchmark has not been run."}
                  </h3>
                  <p>
                    No live comparison scores are available. Configure a
                    provider key, review the dataset, then run the evaluator.
                  </p>
                  <code>
                    uv run python -m scripts.evaluate --split development
                  </code>
                </div>
                <span className="tag amber">
                  {data.results?.status === "stale"
                    ? "Stale artifact"
                    : "Awaiting live evaluation"}
                </span>
              </div>
            )}
          </section>
          <section>
            <div className="section-heading">
              <h2>Inspect the questions</h2>
              {config.admin_available && (
                <button
                  className="button secondary"
                  onClick={() => void exportReviews()}
                >
                  Export human reviews
                </button>
              )}
              <label className="compact-select">
                <span className="sr-only">Dataset split</span>
                <select
                  aria-label="Dataset split"
                  value={split}
                  onChange={(e) => setSplit(e.target.value)}
                >
                  <option value="development">Development split</option>
                  <option value="held_out">Held-out split</option>
                </select>
              </label>
            </div>
            <p className="caption">
              Tune using development cases only. Reserve held-out cases for
              final evaluation.
            </p>
            <div className="eval-cases">
              {data.cases
                .filter((c) => c.split === split)
                .map((c) => (
                  <button key={c.id} onClick={() => setSelected(c)}>
                    <code>{c.id}</code>
                    <span>{c.question}</span>
                    <span className="case-type">
                      {c.category.replaceAll("_", " ")}
                    </span>
                    <ArrowUpRight size={15} />
                  </button>
                ))}
            </div>
          </section>
        </>
      )}
      {selected && (
        <CaseReview
          item={selected}
          config={config}
          onClose={() => setSelected(null)}
          onSaved={() => void refresh()}
        />
      )}
      {selectedOutcome && data?.results && (
        <AnswerReview
          row={selectedOutcome}
          run={data.results}
          config={config}
          onClose={() => setSelectedOutcome(null)}
          onSaved={() => void refresh()}
        />
      )}
    </div>
  );
}
