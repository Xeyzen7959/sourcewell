import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Inbox as InboxIcon, Save } from "lucide-react";
import { api, json } from "./api";
import { AnswerCard, Notice } from "./ui";
import type { Answer, Source, Ticket } from "./types";

export function Inbox({
  onSource,
  onAsk,
}: {
  onSource: (source: Source) => void;
  onAsk: () => void;
}) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    api<Ticket[]>("/tickets")
      .then((value) => {
        if (active) setTickets(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function open(ticket: Ticket) {
    setSaved(false);
    setError("");
    try {
      setSelected(await api<Ticket>(`/tickets/${ticket.id}`));
    } catch (error) {
      setError((error as Error).message);
    }
  }
  async function save() {
    if (!selected) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await api(`/tickets/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: selected.status,
          note: selected.note,
          draft_reply: selected.draft_reply,
        }),
      });
      setTickets(await api<Ticket[]>("/tickets"));
      setSaved(true);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function loadExample() {
    setBusy(true);
    setError("");
    try {
      const answer = await api<Answer>(
        "/ask",
        json({
          question:
            "Which retention period applies after cancellation: 30 or 60 days?",
          mode: "recorded",
        }),
      );
      await api(
        "/handoffs",
        json({
          answer_id: answer.id,
          reason:
            "Recorded handoff example: please clarify the conflicting retention policies.",
        }),
      );
      setTickets(await api<Ticket[]>("/tickets"));
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="content-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">A human when it matters</span>
          <h1>Specialist inbox</h1>
          <p>
            Every handoff arrives with the question, the answer, and the
            evidence.
          </p>
        </div>
        <span className="tag">Your session only</span>
      </header>
      <Notice>
        This inbox is a local review workflow. No email is sent, and other
        visitors cannot see your session’s tickets.
      </Notice>
      {error && <Notice error>{error}</Notice>}
      {saved && <Notice>Ticket updates saved.</Notice>}
      {tickets.length === 0 ? (
        <div className="empty-state large">
          <span className="empty-icon">
            <InboxIcon size={32} />
          </span>
          <h2>A clear inbox. A good place to start.</h2>
          <p>
            Explore an answer and select “Ask a specialist” to create your first
            handoff.
          </p>
          <button className="button primary" onClick={onAsk}>
            Explore an answer <ArrowRight size={16} />
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void loadExample()}
          >
            Load a recorded handoff example
          </button>
        </div>
      ) : (
        <div className={`inbox-layout ${selected ? "has-selection" : ""}`}>
          <section className="ticket-list">
            <label className="filter-label">
              Show tickets
              <select
                aria-label="Filter tickets"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </label>
            {tickets
              .filter((t) => filter === "all" || t.status === filter)
              .map((t) => (
                <button
                  key={t.id}
                  className={`ticket-row ${selected?.id === t.id ? "selected" : ""}`}
                  onClick={() => void open(t)}
                >
                  <span
                    className={`status ${t.status === "resolved" ? "green" : "amber"}`}
                  >
                    {t.status.replace("_", " ")}
                  </span>
                  <strong>{t.question}</strong>
                  <small>{new Date(t.created_at).toLocaleString()}</small>
                </button>
              ))}
          </section>
          <section className="ticket-detail">
            {selected ? (
              <>
                <button
                  className="text-button"
                  onClick={() => setSelected(null)}
                >
                  <ArrowLeft size={15} />
                  Back to tickets
                </button>
                <h2>{selected.question}</h2>
                <p className="muted">{selected.reason}</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save();
                  }}
                >
                  <div className="ticket-fields">
                    <label>
                      Status
                      <select
                        value={selected.status}
                        onChange={(e) =>
                          setSelected({
                            ...selected,
                            status: e.target.value as Ticket["status"],
                          })
                        }
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </label>
                    <label>
                      Internal review note
                      <textarea
                        rows={3}
                        maxLength={2000}
                        value={selected.note}
                        onChange={(e) =>
                          setSelected({ ...selected, note: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Draft reply
                      <textarea
                        rows={4}
                        maxLength={5000}
                        value={selected.draft_reply}
                        onChange={(e) =>
                          setSelected({
                            ...selected,
                            draft_reply: e.target.value,
                          })
                        }
                      />
                    </label>
                    <p className="caption">
                      Drafts stay inside Sourcewell. Saving does not contact a
                      customer.
                    </p>
                    <button className="button primary" disabled={busy}>
                      <Save size={15} />
                      Save ticket
                    </button>
                  </div>
                </form>
                {selected.answer && (
                  <AnswerCard answer={selected.answer} onSource={onSource} />
                )}
              </>
            ) : (
              <div className="empty-state">
                <InboxIcon size={28} />
                <h3>Select a handoff</h3>
                <p>Review the saved evidence and draft a reply.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
