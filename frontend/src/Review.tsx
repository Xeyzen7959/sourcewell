import { useEffect, useState } from "react";
import { api, json } from "./api";
import { Modal, Notice } from "./ui";
import type {
  Config,
  Document,
  EvalCase,
  EvalResult,
  EvalRow,
  Status,
} from "./types";

function credentials() {
  return sessionStorage.getItem("sourcewell_admin") ?? "";
}

export function CaseReview({
  item,
  config,
  onClose,
  onSaved,
}: {
  item: EvalCase;
  config: Config;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [question, setQuestion] = useState(item.question);
  const [expected, setExpected] = useState(item.expected_behavior);
  const [status, setStatus] = useState<Status>(item.expected_status);
  const [references, setReferences] = useState(
    item.relevant_documents.join(", "),
  );
  const [reviewer, setReviewer] = useState(
    sessionStorage.getItem("sourcewell_reviewer") ?? "",
  );
  const [note, setNote] = useState(item.review_note ?? "");
  const [token, setToken] = useState(credentials);
  const [attestation, setAttestation] = useState(false);
  const [docs, setDocs] = useState<Document[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all(
      item.relevant_documents.map((id) => api<Document>(`/documents/${id}`)),
    )
      .then((value) => {
        if (active) setDocs(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [item]);
  async function save() {
    setBusy(true);
    setError("");
    try {
      await api(`/reviews/${item.id}`, {
        ...json({
          question,
          expected_behavior: expected,
          expected_status: status,
          relevant_documents: references
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          reviewer,
          note,
          attestation,
        }),
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
      });
      sessionStorage.setItem("sourcewell_admin", token);
      sessionStorage.setItem("sourcewell_reviewer", reviewer);
      onSaved();
      onClose();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={`Evaluation case ${item.id}`} onClose={onClose}>
      <span className="eyebrow">
        {item.split.replace("_", "-")} split ·{" "}
        {item.category.replaceAll("_", " ")}
      </span>
      <h3 className="review-question">{item.question}</h3>
      <dl>
        <dt>Review status</dt>
        <dd>
          {item.review_status === "human_reviewed"
            ? `Human-reviewed by ${item.reviewer} on ${item.reviewed_at}`
            : "Requires human review"}
        </dd>
        <dt>Expected status</dt>
        <dd>{item.expected_status.replaceAll("_", " ")}</dd>
      </dl>
      <h4>Expected behavior</h4>
      <p>{item.expected_behavior}</p>
      <section className="review-evidence">
        <h4>Annotated evidence</h4>
        {item.relevant_documents.length === 0 && (
          <p className="muted">
            No answer source is annotated. Verify that the question cannot be
            answered from the corpus.
          </p>
        )}
        {docs.map((doc) => (
          <details key={doc.id}>
            <summary>
              {doc.title} · {doc.id}
            </summary>
            <pre>{doc.content}</pre>
          </details>
        ))}
      </section>
      {item.split === "held_out" && (
        <Notice>
          Held-out cases are for final assessment. Do not tune prompts or
          retrieval using these cases.
        </Notice>
      )}
      {config.admin_available ? (
        <form
          className="review-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <h4>Review and correct annotations</h4>
          <label>
            Question
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              required
              minLength={3}
              maxLength={1200}
              rows={2}
            />
          </label>
          <label>
            Expected behavior
            <textarea
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              required
              minLength={10}
              maxLength={4000}
              rows={4}
            />
          </label>
          <label>
            Expected status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
            >
              <option value="answered">Answered</option>
              <option value="insufficient_evidence">
                Insufficient evidence
              </option>
              <option value="conflicting_evidence">Conflicting evidence</option>
            </select>
          </label>
          <label>
            Source document IDs, separated by commas
            <input
              value={references}
              onChange={(e) => setReferences(e.target.value)}
            />
          </label>
          <label>
            Reviewer name
            <input
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
              required
              minLength={2}
              maxLength={100}
            />
          </label>
          <label>
            Review note
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              rows={2}
            />
          </label>
          <label>
            Administrator token
            <input
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={attestation}
              onChange={(e) => setAttestation(e.target.checked)}
              required
            />
            I personally checked these annotations against the source documents.
          </label>
          <p className="caption">
            The server records the review date in UTC. Split membership cannot
            be changed here. Export reviews to preserve them in Git.
          </p>
          {error && <Notice error>{error}</Notice>}
          <button className="button primary" disabled={busy || !attestation}>
            Save human review
          </button>
        </form>
      ) : (
        <Notice>
          These annotations remain AI-drafted until a person reviews them. Human
          review is available in the local administrator workspace.
        </Notice>
      )}
    </Modal>
  );
}

export function AnswerReview({
  row,
  run,
  config,
  onClose,
  onSaved,
}: {
  row: EvalRow;
  run: EvalResult;
  config: Config;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [grade, setGrade] = useState("");
  const [reviewer, setReviewer] = useState(
    sessionStorage.getItem("sourcewell_reviewer") ?? "",
  );
  const [reason, setReason] = useState("");
  const [token, setToken] = useState(credentials);
  const [attestation, setAttestation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setBusy(true);
    setError("");
    try {
      await api(`/answer-reviews/${row.id}`, {
        ...json({
          run_fingerprint: run.run_fingerprint,
          mode: row.mode,
          grade: Number(grade),
          reviewer,
          reason,
          attestation,
        }),
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
      });
      sessionStorage.setItem("sourcewell_reviewer", reviewer);
      sessionStorage.setItem("sourcewell_admin", token);
      onSaved();
      onClose();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={`Run outcome ${row.id} / ${row.mode}`} onClose={onClose}>
      <h3>{row.question}</h3>
      <p className="caption">
        Observed: {row.status} · Expected: {row.expected_status} ·{" "}
        {row.latency_ms} ms
      </p>
      {row.error ? (
        <Notice error>{row.error}</Notice>
      ) : (
        <blockquote>{row.answer}</blockquote>
      )}
      <h4>Expected behavior</h4>
      <p>{row.expected_behavior}</p>
      {row.source_passages?.map((source) => (
        <details key={source.id}>
          <summary>
            {source.document_id} / {source.section}
          </summary>
          <blockquote>{source.text}</blockquote>
        </details>
      ))}
      {config.admin_available && (
        <form
          className="review-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label>
            Human quality grade
            <select
              required
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            >
              <option value="">Choose a grade</option>
              <option value="0">
                0 — Wrong, unsupported, unsafe, or failed
              </option>
              <option value="1">1 — Material errors</option>
              <option value="2">2 — Mostly correct, incomplete</option>
              <option value="3">3 — Correct and sufficiently supported</option>
              <option value="4">4 — Correct, complete, and useful</option>
            </select>
          </label>
          <label>
            Reviewer name
            <input
              required
              minLength={2}
              maxLength={100}
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
            />
          </label>
          <label>
            Grade justification
            <textarea
              required
              minLength={10}
              maxLength={2000}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <label>
            Administrator token
            <input
              type="password"
              required
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              required
              checked={attestation}
              onChange={(e) => setAttestation(e.target.checked)}
            />
            I personally reviewed this answer against the evidence and rubric.
          </label>
          {error && <Notice error>{error}</Notice>}
          <button className="button primary" disabled={busy || !attestation}>
            Save answer grade
          </button>
        </form>
      )}
    </Modal>
  );
}
