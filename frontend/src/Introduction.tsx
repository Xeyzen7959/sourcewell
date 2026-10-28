import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  FileSearch,
  MessageSquare,
} from "lucide-react";
import { api } from "./api";
import { Notice } from "./ui";
import type { Config, Document, Evaluation } from "./types";

export function Introduction({
  config,
  onDemo,
  onEvaluation,
}: {
  config: Config;
  onDemo: () => void;
  onEvaluation: () => void;
}) {
  const [data, setData] = useState<Evaluation | null>(null);
  const [documents, setDocuments] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [previewFailed, setPreviewFailed] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([api<Evaluation>("/evaluation"), api<Document[]>("/documents")])
      .then(([evaluation, docs]) => {
        if (active) {
          setData(evaluation);
          setDocuments(docs.filter((d) => d.seeded).length);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const results = data?.results?.summaries;
  const preliminary =
    results &&
    (data.results?.status !== "completed" ||
      data.review_status !== "human_reviewed");
  return (
    <div className="introduction">
      <a
        className="skip-link"
        href="#intro-main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("intro-main")?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="intro-header">
        <a href="#intro" className="brand">
          <span className="brand-mark">s</span>
          <span>
            sourcewell<span className="brand-period">.</span>
          </span>
        </a>
        <nav aria-label="Introduction navigation">
          <a
            href="https://github.com/Xeyzen7959/sourcewell"
            target="_blank"
            rel="noreferrer"
          >
            GitHub <ArrowUpRight size={15} />
          </a>
          <button className="button primary" onClick={onDemo}>
            Try the demo <ArrowRight size={15} />
          </button>
        </nav>
      </header>
      <main id="intro-main" tabIndex={-1}>
        <section className="intro-hero">
          <div>
            <span className="eyebrow">
              <span className="dot" />
              Evidence-first support
            </span>
            <h1>
              AI support answers.
              <br />
              <em>Evidence attached.</em>
            </h1>
            <p>
              Sourcewell turns support documents into answers you can inspect.
              Open a citation, spot missing evidence, and save a handoff for
              human review.
            </p>
            <div className="intro-actions">
              <button className="button primary" onClick={onDemo}>
                Try the demo <ArrowRight size={17} />
              </button>
              <button
                className="text-button"
                onClick={() =>
                  document.getElementById("measured-results")?.scrollIntoView({
                    behavior: window.matchMedia(
                      "(prefers-reduced-motion: reduce)",
                    ).matches
                      ? "instant"
                      : "smooth",
                  })
                }
              >
                Inspect the results <ArrowRight size={15} />
              </button>
            </div>
            <div className="intro-availability">
              <span className="dot" />
              Recorded demo ready. No API key needed.
            </div>
            <span className="intro-disclosure">
              Fictional documents.{" "}
              {config.live_status === "available"
                ? "Live AI is configured; indexing and capacity still apply."
                : config.live_status === "budget_exhausted"
                  ? "Live AI has reached its daily limit."
                  : "Live AI awaits server credentials."}
            </span>
          </div>
          <aside
            className="intro-proof"
            aria-label="A recorded example you can inspect"
          >
            <div className="proof-heading">
              <span className="eyebrow">Inside the demo</span>
              <span className="tag">Recorded example</span>
            </div>
            <p className="proof-question">
              “Can I get a refund for my first subscription?”
            </p>
            <div className="proof-answer">
              <span className="proof-label">Answer → evidence → handoff</span>
              <p>
                Follow an answer back to its source. Keep the context when a
                human needs to take over.
              </p>
              <button className="text-button" onClick={onDemo}>
                Open the working example <ArrowUpRight size={16} />
              </button>
            </div>
            <div className="proof-footer">
              <BookOpen size={15} /> Real interface. Recorded answer.
              Inspectable sources.
            </div>
          </aside>
        </section>
        <figure className="intro-preview">
          <div className="preview-toolbar">
            <span className="preview-live-dot" />
            <p>The working product</p>
            <button className="text-button" onClick={onDemo}>
              Explore workspace <ArrowUpRight size={14} />
            </button>
          </div>
          {previewFailed ? (
            <div className="preview-fallback">
              <BookOpen size={30} />
              <h2>The workspace is still one click away.</h2>
              <p>
                The screenshot could not load. You can still open the
                interactive demo.
              </p>
              <button className="button primary" onClick={onDemo}>
                Open the demo <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <img
              src="/preview/workspace.png"
              alt="Actual Sourcewell workspace with a recorded support question, document citations, and specialist handoff"
              width="1440"
              height="1006"
              fetchPriority="high"
              onError={() => setPreviewFailed(true)}
            />
          )}
          <figcaption>
            <span>
              Actual application screenshot · fictional Cedarline Cloud
              workspace
            </span>
            <span>Try it. Inspect it. Follow the sources.</span>
          </figcaption>
        </figure>
        <section className="intro-workflow">
          <div>
            <FileSearch size={22} />
            <span className="eyebrow">01 / Find</span>
            <h3>Ask a support question.</h3>
            <p>
              Explore recorded answers now. Configured live mode searches
              documents by meaning and exact keywords.
            </p>
          </div>
          <div>
            <BookOpen size={22} />
            <span className="eyebrow">02 / Inspect</span>
            <h3>Open the evidence.</h3>
            <p>
              Read the saved passage behind each citation. Check the answer
              against the document yourself.
            </p>
          </div>
          <div>
            <MessageSquare size={22} />
            <span className="eyebrow">03 / Review</span>
            <h3>Make uncertainty useful.</h3>
            <p>
              Save the question, draft answer, and sources in a session inbox.
              No external message is sent.
            </p>
          </div>
        </section>
        <section className="intro-results" id="measured-results">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Results, with provenance</span>
              <h2>What has been tested?</h2>
            </div>
            <button className="button secondary" onClick={onEvaluation}>
              Open evaluation lab <ArrowUpRight size={15} />
            </button>
          </div>
          {error && (
            <Notice error>
              Evidence could not load: {error} Refresh to retry, or open the
              recorded demo.
            </Notice>
          )}
          {!data && !error ? (
            <Notice>Loading evaluation evidence…</Notice>
          ) : error ? null : results ? (
            <>
              <span className="tag amber">
                {preliminary
                  ? "Preliminary results"
                  : "Live evaluation artifact"}
              </span>
              <div className="intro-result-grid">
                {results.map((r) => (
                  <article key={r.mode}>
                    <span className="eyebrow">
                      {r.mode} search · {r.cases} attempted cases
                    </span>
                    <strong>
                      {r.retrieval_recall_at_k === null
                        ? "Not measured"
                        : `${(r.retrieval_recall_at_k * 100).toFixed(1)}%`}
                    </strong>
                    <span>
                      Document Recall@k · {r.retrieval_case_count} annotated
                      cases
                    </span>
                    <p>
                      {r.error_count} errors · median{" "}
                      {r.median_latency_ms === null
                        ? "unavailable"
                        : `${Math.round(r.median_latency_ms)} ms`}
                    </p>
                  </article>
                ))}
              </div>
              <p className="caption">
                Run: {data?.results?.timestamp} ·{" "}
                {data?.results?.generation_model} ·{" "}
                {data?.results?.embedding_model}. These measurements are not a
                correctness guarantee.
              </p>
            </>
          ) : (
            <div className="intro-pending">
              <span className="tag amber">Evaluation pending</span>
              <h3>
                {data?.results?.status === "stale"
                  ? "The saved run needs to be refreshed."
                  : "No live quality scores are available yet."}
              </h3>
              <p>
                The recorded demo works today. Live benchmarking needs
                credentials and human-reviewed annotations before its results
                can support quality claims.
              </p>
            </div>
          )}
          <div className="intro-facts">
            <div>
              <strong>{documents ?? "—"}</strong>
              <span>Fictional seed documents</span>
            </div>
            <div>
              <strong>{data?.count ?? "—"}</strong>
              <span>Draft evaluation questions</span>
            </div>
            <div>
              <strong>{data?.reviewed_count ?? "—"}</strong>
              <span>Human-reviewed annotations</span>
            </div>
          </div>
          <p className="intro-limits">
            AI-drafted cases require human review. Model-based checks can make
            mistakes. Recorded examples do not run live retrieval. Public
            handoffs belong only to your browser session
            {config.session_retention_hours
              ? ` and expire after ${config.session_retention_hours} hours`
              : ""}
            .
          </p>
        </section>
        <section className="intro-end">
          <h2>Spend a minute with the product.</h2>
          <button className="button primary" onClick={onDemo}>
            Try the demo <ArrowRight size={17} />
          </button>
        </section>
      </main>
      <footer className="intro-footer">
        <span>
          Built by <a href="https://github.com/Xeyzen7959">@Xeyzen7959</a>
        </span>
        <span>React · FastAPI · Chroma · BM25</span>
        <a href="https://github.com/Xeyzen7959/sourcewell">
          Explore the source <ArrowUpRight size={14} />
        </a>
      </footer>
    </div>
  );
}
