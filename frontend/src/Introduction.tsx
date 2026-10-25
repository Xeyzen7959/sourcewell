import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
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
              An answer is better
              <br />
              when you can <em>check it.</em>
            </h1>
            <p>
              Ask a support question, inspect its sources, and hand uncertainty
              to a human—with the context intact.
            </p>
            <div className="intro-actions">
              <button className="button primary" onClick={onDemo}>
                Try the demo <ArrowRight size={17} />
              </button>
              <button
                className="text-button"
                onClick={() =>
                  document
                    .getElementById("measured-results")
                    ?.scrollIntoView({
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
            <span className="intro-disclosure">
              Fictional company documents. Clearly labeled recorded examples.{" "}
              {config.live_status === "available"
                ? "Live AI is configured; availability depends on indexing and remaining capacity."
                : config.live_status === "budget_exhausted"
                  ? "Daily live capacity is exhausted; recorded examples are available."
                  : "Live AI is awaiting server credentials."}
            </span>
          </div>
          <aside className="intro-proof">
            <span className="eyebrow">Follow the evidence</span>
            <BookOpen size={28} />
            <h2>
              A source for the answer.
              <br />A next step for the unknown.
            </h2>
            <ul>
              <li>
                <Check size={15} />
                Exact source passages
              </li>
              <li>
                <Check size={15} />
                Explicit missing or conflicting evidence
              </li>
              <li>
                <Check size={15} />
                Session-isolated specialist handoff
              </li>
            </ul>
            <span className="tag">Interactive portfolio project</span>
          </aside>
        </section>
        <figure className="intro-preview">
          <div className="preview-toolbar">
            <span />
            <span />
            <span />
            <p>Sourcewell / Recorded example workspace</p>
          </div>
          <img
            src="/preview/workspace.png"
            alt="Actual Sourcewell workspace with a recorded support question, document citations, and specialist handoff"
            width="1440"
            height="1006"
            fetchPriority="high"
          />
          <figcaption>
            Screenshot of the actual application. Open the demo to explore it
            yourself.
          </figcaption>
        </figure>
        <section className="intro-workflow">
          <div>
            <FileSearch size={22} />
            <span className="eyebrow">01 / Find</span>
            <h3>Bring the right context.</h3>
            <p>
              Live retrieval combines exact keyword matching with semantic
              search over a bounded document library.
            </p>
          </div>
          <div>
            <BookOpen size={22} />
            <span className="eyebrow">02 / Inspect</span>
            <h3>Open the evidence.</h3>
            <p>
              See the exact passage behind a citation. Reference checks and
              model support assessments have different limits.
            </p>
          </div>
          <div>
            <MessageSquare size={22} />
            <span className="eyebrow">03 / Review</span>
            <h3>Make uncertainty useful.</h3>
            <p>
              Save a handoff with its question, answer attempt, and source
              snapshots. No external messages are sent.
            </p>
          </div>
        </section>
        <section className="intro-results" id="measured-results">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Results, with provenance</span>
              <h2>
                Measured when measured.
                <br />
                <em>Pending when pending.</em>
              </h2>
            </div>
            <button className="button secondary" onClick={onEvaluation}>
              Open evaluation lab <ArrowUpRight size={15} />
            </button>
          </div>
          {error && <Notice error>{error}</Notice>}
          {results ? (
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
                Recorded workflows are ready to explore. Live benchmarking still
                needs credentials and reviewed annotations. No accuracy or
                savings claims are inferred from the interface.
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
