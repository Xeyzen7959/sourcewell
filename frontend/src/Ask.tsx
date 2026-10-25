import { useState } from "react";
import {
  ArrowRight,
  ArrowUp,
  Check,
  CornerDownLeft,
  FileSearch,
  Layers3,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { api, json } from "./api";
import { AnswerCard, Modal, Notice } from "./ui";
import type { Answer, Config, Source } from "./types";

export function Ask({
  config,
  onSource,
  onTicket,
}: {
  config: Config;
  onSource: (source: Source) => void;
  onTicket: () => void;
}) {
  const [mode, setMode] = useState<"recorded" | "live">("recorded");
  const [searchMode, setSearchMode] = useState("hybrid");
  const [question, setQuestion] = useState(config.examples[0]?.question ?? "");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [handoff, setHandoff] = useState(false);
  const [reason, setReason] = useState(
    "Please review this answer and the supporting evidence.",
  );
  const [saved, setSaved] = useState(false);
  const [availability, setAvailability] = useState(config);
  async function ask(value = question) {
    setBusy(true);
    setError("");
    setSaved(false);
    setAnswer(null);
    setQuestion(value);
    try {
      setAnswer(
        await api<Answer>(
          "/ask",
          json({ question: value, mode, search_mode: searchMode }),
        ),
      );
    } catch (error) {
      setError((error as Error).message);
      try {
        setAvailability(await api<Config>("/config"));
      } catch {
        /* Keep the original request error visible. */
      }
    } finally {
      setBusy(false);
    }
  }
  async function sendHandoff() {
    if (!answer) return;
    setBusy(true);
    setError("");
    try {
      await api("/handoffs", json({ answer_id: answer.id, reason }));
      setHandoff(false);
      setSaved(true);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="ask-layout">
      <div className="ask-main">
        <header className="page-title">
          <span className="eyebrow">The support workspace</span>
          <h1>
            Good answers start
            <br />
            with <em>good evidence.</em>
          </h1>
          <p>Ask a question. See the answer. Inspect what backs it up.</p>
        </header>
        <div className="mode-row">
          <div className="segmented" aria-label="Answer mode">
            <button
              aria-pressed={mode === "recorded"}
              onClick={() => {
                setMode("recorded");
                setQuestion(config.examples[0].question);
                setAnswer(null);
                setError("");
              }}
            >
              Recorded examples
            </button>
            <button
              aria-pressed={mode === "live"}
              disabled={availability.live_status !== "available" || busy}
              title={
                availability.live_status === "missing_credentials"
                  ? `Configure ${config.credential_name} on the server to enable live AI`
                  : availability.live_status === "budget_exhausted"
                    ? "Daily live capacity is exhausted. Recorded examples remain available."
                    : undefined
              }
              onClick={() => {
                setMode("live");
                setQuestion("");
                setAnswer(null);
              }}
            >
              Live AI{" "}
              {availability.live_status !== "available" && (
                <span className="tiny">
                  {availability.live_status === "budget_exhausted"
                    ? "Daily limit reached"
                    : "Not configured"}
                </span>
              )}
            </button>
          </div>
        </div>
        <form
          className="question-box"
          onSubmit={(e) => {
            e.preventDefault();
            void ask();
          }}
        >
          <label className="sr-only" htmlFor="question">
            Support question
          </label>
          {mode === "recorded" ? (
            <select
              id="question"
              aria-label="Support question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            >
              {config.examples.map((ex) => (
                <option key={ex.id}>{ex.question}</option>
              ))}
            </select>
          ) : (
            <textarea
              id="question"
              placeholder="What would you like to know?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={1200}
              rows={3}
              required
              minLength={3}
            />
          )}
          <div className="composer-bottom">
            <span className="composer-label">
              <Layers3 size={14} />
              {mode === "recorded" ? (
                "Saved answers · no API calls"
              ) : (
                <select
                  aria-label="Search approach"
                  value={searchMode}
                  onChange={(e) => setSearchMode(e.target.value)}
                >
                  <option value="hybrid">Hybrid search</option>
                  <option value="semantic">Semantic search</option>
                </select>
              )}
            </span>
            <button
              className="ask-submit"
              type="submit"
              aria-label="Ask Sourcewell"
              disabled={busy || question.trim().length < 3}
            >
              {busy ? <span className="spinner" /> : <ArrowUp size={21} />}
            </button>
          </div>
        </form>
        <p className="composer-hint">
          <CornerDownLeft size={12} />
          {mode === "recorded"
            ? "Choose an example to explore the full answer-and-evidence flow."
            : "Answers use your indexed documents. Live calls consume API credits."}
        </p>
        {error && (
          <Notice error>
            {error}
            {mode === "live" && (
              <button
                className="text-button"
                onClick={() => {
                  setMode("recorded");
                  setQuestion(config.examples[0].question);
                  setError("");
                  setAnswer(null);
                }}
              >
                Try recorded examples
              </button>
            )}
          </Notice>
        )}
        {availability.live_status === "budget_exhausted" && !error && (
          <Notice>
            Daily live capacity is exhausted. Recorded examples remain available
            without API calls.
          </Notice>
        )}
        {saved && (
          <Notice>
            <span className="saved">
              <Check size={15} />
              Handoff saved in your session’s inbox.
            </span>
            <button className="text-button" onClick={onTicket}>
              Open inbox <ArrowRight size={14} />
            </button>
          </Notice>
        )}
        {busy && !handoff && (
          <div className="loading-panel" role="status">
            <span className="spinner" />
            {mode === "recorded"
              ? "Loading saved evidence…"
              : "Finding evidence and checking the answer…"}
          </div>
        )}
        {answer ? (
          <AnswerCard
            answer={answer}
            onSource={onSource}
            onHandoff={() => setHandoff(true)}
          />
        ) : (
          !busy && (
            <section className="suggestions">
              <div className="section-heading">
                <h2>Take a closer look</h2>
                <span className="caption">Five recorded scenarios</span>
              </div>
              <div className="example-grid">
                {config.examples.slice(0, 4).map((ex, i) => (
                  <button
                    key={ex.id}
                    disabled={mode !== "recorded"}
                    onClick={() => void ask(ex.question)}
                    className="example-card"
                  >
                    <span className="eyebrow">
                      0{i + 1} / {ex.category}
                    </span>
                    <strong>{ex.question}</strong>
                    <ArrowUp size={17} />
                  </button>
                ))}
              </div>
            </section>
          )
        )}
        {handoff && (
          <Modal title="Ask a specialist" onClose={() => setHandoff(false)}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendHandoff();
              }}
            >
              <p className="muted">
                Save this question, answer attempt, and source passages to your
                private session inbox. No external message is sent.
              </p>
              <label htmlFor="reason">What needs a closer look?</label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                minLength={3}
                maxLength={1000}
                required
              />
              {error && <Notice error>{error}</Notice>}
              <button className="button primary" disabled={busy}>
                Save handoff <ArrowRight size={16} />
              </button>
            </form>
          </Modal>
        )}
      </div>
      <aside className="context-column">
        <div className="workspace-card">
          <span className="eyebrow">
            <span className="dot" /> Connected knowledge
          </span>
          <div className="company-icon">c.</div>
          <h3>Cedarline Cloud</h3>
          <p>
            A fictional workspace.
            <br />A real evidence-first workflow.
          </p>
          <div className="workspace-meta">
            <span>Public sample documents</span>
            <span className="tag">Fictional data</span>
          </div>
        </div>
        <div className="how-it-works">
          <span className="eyebrow">Built to be inspected</span>
          <div>
            <FileSearch size={18} />
            <section>
              <h4>Find the right passage</h4>
              <p>
                Live mode combines keyword matching with semantic retrieval.
              </p>
            </section>
          </div>
          <div>
            <Sparkles size={18} />
            <section>
              <h4>Keep the answer grounded</h4>
              <p>
                Inspect cited passages and the limits of model-based checks.
              </p>
            </section>
          </div>
          <div>
            <MessageSquare size={18} />
            <section>
              <h4>Know when to ask a human</h4>
              <p>
                Missing or conflicting evidence becomes a reviewable handoff.
              </p>
            </section>
          </div>
        </div>
        <div className="sidebar-note">
          <span className="serif">Clarity over confidence.</span>
          <p>
            No invented accuracy scores. No hidden switch from live AI to saved
            responses.
          </p>
        </div>
      </aside>
    </div>
  );
}
