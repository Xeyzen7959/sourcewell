import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  FlaskConical,
  GitCompareArrows,
  ListChecks,
} from "lucide-react";
import { api } from "./api";
import { Modal, Notice } from "./ui";
import type { EvalCase, Evaluation as EvaluationData } from "./types";

const percent = (n: number | null) =>
  n === null ? "Not measured" : `${(n * 100).toFixed(1)}%`;

export function Evaluation() {
  const [data, setData] = useState<EvaluationData | null>(null);
  const [error, setError] = useState("");
  const [split, setSplit] = useState("development");
  const [selected, setSelected] = useState<EvalCase | null>(null);
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
                AI-drafted · Human review required
                <br />
                No claim of human-labeled ground truth.
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
                        <dt>Document Recall@k</dt>
                        <dd>{percent(summary.retrieval_recall_at_k)}</dd>
                        <dt>Valid citation references</dt>
                        <dd>
                          {percent(summary.valid_citation_reference_rate)}
                        </dd>
                        <dt>Correct abstention</dt>
                        <dd>{percent(summary.abstention_accuracy)}</dd>
                        <dt>Model support pass</dt>
                        <dd>{percent(summary.model_support_pass_rate)}</dd>
                        <dt>Average latency</dt>
                        <dd>{Math.round(summary.average_latency_ms)} ms</dd>
                        <dt>Estimated API cost</dt>
                        <dd>
                          {summary.estimated_cost_usd === null
                            ? "Not configured"
                            : `$${summary.estimated_cost_usd.toFixed(5)}`}
                        </dd>
                      </dl>
                    </article>
                  ))}
                </div>
                <p className="caption">
                  Run: {data.results.timestamp} · Split: {data.results.split} ·{" "}
                  {data.results.generation_model} ·{" "}
                  {data.results.embedding_model}. Model support is a fallible
                  assessment, not correctness. Dataset requires human review.
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
                      <div className="eval-result-row" key={`${row.id}-${i}`}>
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
                      </div>
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
        <Modal
          title={`Evaluation case ${selected.id}`}
          onClose={() => setSelected(null)}
        >
          <h3>{selected.question}</h3>
          <dl>
            <dt>Expected status</dt>
            <dd>{selected.expected_status.replaceAll("_", " ")}</dd>
            <dt>Relevant documents</dt>
            <dd>
              {selected.relevant_documents.join(", ") || "No answer in corpus"}
            </dd>
            <dt>Review status</dt>
            <dd>Requires human review</dd>
          </dl>
          <h4>Expected behavior</h4>
          <p>{selected.expected_behavior}</p>
          <Notice>
            This case was AI-drafted. Review the question, source annotations,
            and rubric before using it as ground truth.
          </Notice>
        </Modal>
      )}
    </div>
  );
}
