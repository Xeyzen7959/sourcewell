import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { ArrowUpRight, BookOpen, Check, CircleHelp, X } from "lucide-react";
import type { Answer, Source } from "./types";

export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`notice ${error ? "error" : ""}`}
      role={error ? "alert" : "status"}
    >
      <CircleHelp size={16} />
      <span>{children}</span>
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const focused = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      focused?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-label={title}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function SourcePanel({
  source,
  onClose,
}: {
  source: Source;
  onClose: () => void;
}) {
  return (
    <Modal title="Source evidence" onClose={onClose}>
      <div className="source-document">
        <span className="eyebrow">
          <BookOpen size={14} /> {source.filename}
        </span>
        <h3>{source.title}</h3>
        <p className="muted">
          {source.section}
          {source.page ? ` · Page ${source.page}` : ""}
          {source.version ? ` · Version ${source.version}` : ""}
        </p>
        <blockquote>{source.text}</blockquote>
        <p className="caption">
          This is the exact saved passage. A citation link proves the source
          exists; it does not independently prove the answer is correct.
        </p>
        <details>
          <summary>Passage identifier</summary>
          <code className="break-word">{source.id}</code>
        </details>
      </div>
    </Modal>
  );
}

export function AnswerCard({
  answer,
  onSource,
  onHandoff,
}: {
  answer: Answer;
  onSource: (source: Source) => void;
  onHandoff?: () => void;
}) {
  const status =
    answer.status === "answered"
      ? "Answer with sources"
      : answer.status === "conflicting_evidence"
        ? "Sources disagree"
        : "More evidence needed";
  return (
    <article className="answer-card">
      <div className="answer-top">
        <span
          className={`status ${answer.status === "answered" ? "green" : "amber"}`}
        >
          {answer.status === "answered" ? (
            <Check size={14} />
          ) : (
            <CircleHelp size={14} />
          )}
          {status}
        </span>
        <span className="caption">
          {answer.mode === "recorded" ? "Recorded example" : "Live AI response"}
        </span>
      </div>
      <div className="answer-heading">
        <span className="brand-mark small">s</span>
        <span>
          Sourcewell<span className="muted"> · Answer</span>
        </span>
      </div>
      <div className="answer-copy">
        {answer.claims.length ? (
          answer.claims.map((claim, index) => (
            <p key={index}>
              {claim.text}
              {claim.citation_ids.map((id) => {
                const source = answer.sources.find((s) => s.id === id);
                return source ? (
                  <button
                    key={id}
                    className="citation"
                    aria-label={`View source: ${source.title}`}
                    onClick={() => onSource(source)}
                  >
                    {answer.sources.indexOf(source) + 1}
                  </button>
                ) : null;
              })}
            </p>
          ))
        ) : (
          <p>{answer.answer}</p>
        )}
      </div>
      <div className="evidence-note">
        <CircleHelp size={16} />
        <p>{answer.explanation}</p>
      </div>
      {answer.sources.length > 0 && (
        <div className="source-list">
          <span className="eyebrow">Evidence behind this answer</span>
          {answer.sources.map((source, i) => (
            <button
              key={source.id}
              onClick={() => onSource(source)}
              className="source-link"
            >
              <span className="source-number">{i + 1}</span>
              <span>
                <strong>{source.title}</strong>
                <small>
                  {source.section}
                  {source.page ? ` · Page ${source.page}` : ""}
                </small>
              </span>
              <ArrowUpRight size={16} />
            </button>
          ))}
        </div>
      )}
      <div className="answer-footer">
        <p>
          <strong>Next step</strong>
          <br />
          {answer.next_action}
        </p>
        {onHandoff && (
          <button className="button secondary" onClick={onHandoff}>
            Ask a specialist <ArrowUpRight size={15} />
          </button>
        )}
      </div>
      <details className="technical">
        <summary>Response details</summary>
        <dl>
          <dt>Generation</dt>
          <dd>{answer.model}</dd>
          <dt>Citation references</dt>
          <dd>{answer.citation_validation.replaceAll("_", " ")}</dd>
          <dt>Support assessment</dt>
          <dd>{answer.support_assessment.replaceAll("_", " ")}</dd>
          <dt>Response time</dt>
          <dd>
            {answer.latency_ms} ms{" "}
            {answer.mode === "recorded" && "(fixture delivery only)"}
          </dd>
        </dl>
        {answer.usage.length > 0 && (
          <p className="caption">
            {answer.usage
              .reduce((n, u) => n + u.input_tokens + u.output_tokens, 0)
              .toLocaleString()}{" "}
            tokens ·{" "}
            {answer.usage.every((u) => u.estimated_cost_usd !== null)
              ? `$${answer.usage.reduce((n, u) => n + (u.estimated_cost_usd ?? 0), 0).toFixed(6)} estimated`
              : "Cost unavailable: configure token prices"}
          </p>
        )}
        <p className="caption">
          Model-based support assessment is fallible. No correctness probability
          is claimed.
        </p>
      </details>
    </article>
  );
}
