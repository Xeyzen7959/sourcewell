import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  FileText,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  Upload,
} from "lucide-react";
import { api } from "./api";
import { Modal, Notice } from "./ui";
import type { Config, Document } from "./types";

export function Knowledge({ config }: { config: Config }) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [selected, setSelected] = useState<Document | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [token, setToken] = useState(
    () => sessionStorage.getItem("sourcewell_admin") ?? "",
  );
  const [remove, setRemove] = useState<Document | null>(null);
  const [replacement, setReplacement] = useState<string | null>(null);
  const upload = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    api<Document[]>("/documents")
      .then((value) => {
        if (active) setDocs(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const admin = config.admin_available && Boolean(token);
  async function open(doc: Document) {
    setError("");
    try {
      setSelected(await api<Document>(`/documents/${doc.id}`));
    } catch (error) {
      setError((error as Error).message);
    }
  }
  async function mutate(path: string, method: string, body?: FormData) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(path, { method, headers: { "X-Admin-Token": token }, body });
      setDocs(await api<Document[]>("/documents"));
      setMessage("Document operation completed.");
      setSelected(null);
      setRemove(null);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const filtered = docs.filter((doc) =>
    `${doc.title} ${doc.filename}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="content-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">The source of the answer</span>
          <h1>Knowledge library</h1>
          <p>
            Readable documents. Traceable passages. Nothing behind the curtain.
          </p>
        </div>
        {config.admin_available && (
          <button
            className="button secondary"
            onClick={() => setAdminOpen(true)}
          >
            <Shield size={16} />
            Administrator access
          </button>
        )}
      </header>
      <div className="library-summary">
        <BookOpen size={24} />
        <div>
          <strong>{docs.length} documents</strong>
          <span>Fictional Cedarline policies and product guides</span>
        </div>
        <span className="tag">
          {config.app_mode === "public"
            ? "Public seed corpus only"
            : "Local workspace"}
        </span>
      </div>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      <div className="library-toolbar">
        <label className="search-box">
          <Search size={17} />
          <span className="sr-only">Search documents</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a document…"
          />
        </label>
        <span className="caption">{filtered.length} results</span>
        {admin && (
          <>
            <button
              className="button secondary"
              disabled={busy || !config.live_available}
              onClick={() => void mutate("/index", "POST")}
            >
              <RefreshCw size={15} />
              Index all for live search
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => {
                setReplacement(null);
                upload.current?.click();
              }}
            >
              <Upload size={15} />
              Upload
            </button>
          </>
        )}
      </div>
      <input
        ref={upload}
        type="file"
        accept=".md,.txt,.pdf"
        className="sr-only"
        aria-label="Upload document file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            if (file.size > config.max_upload_bytes)
              setError(
                `File exceeds ${config.max_upload_bytes.toLocaleString()} bytes.`,
              );
            else {
              const data = new FormData();
              data.append("file", file);
              void mutate(
                replacement ? `/documents/${replacement}` : "/documents",
                replacement ? "PUT" : "POST",
                data,
              );
            }
          }
          e.target.value = "";
        }}
      />
      {busy && (
        <Notice>
          Processing document operation. Indexing can take a little longer.
        </Notice>
      )}
      <div className="document-table">
        <div className="document-table-head">
          <span>Document</span>
          <span>Version</span>
          <span>Passages</span>
          <span>Source</span>
        </div>
        {filtered.map((doc) => (
          <button
            className="document-row"
            key={doc.id}
            onClick={() => void open(doc)}
          >
            <span className="document-name">
              <FileText size={20} />
              <span>
                <strong>{doc.title}</strong>
                <small>{doc.filename}</small>
              </span>
            </span>
            <span className="caption">v{doc.version}</span>
            <span className="caption">{doc.chunk_count}</span>
            <span className="document-source">
              {doc.seeded ? "Sample" : "Uploaded"}
              <ArrowRight size={15} />
            </span>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="empty-state">
            <Search size={24} />
            <h3>No matching documents</h3>
            <p>Try another title or filename.</p>
          </div>
        )}
      </div>
      <p className="caption library-foot">
        Seed documents are read-only. Uploaded files support Markdown, UTF-8
        text, and text-based PDFs up to{" "}
        {Math.round(config.max_upload_bytes / 1_000_000)} MB. Scanned PDFs
        require OCR.
      </p>
      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)}>
          <div className="document-preview">
            <span className="eyebrow">
              Version {selected.version} ·{" "}
              {selected.seeded ? "Fictional seed document" : "Local upload"}
            </span>
            <pre>{selected.content}</pre>
          </div>
          {admin && !selected.seeded && (
            <div className="action-row">
              <button
                className="button secondary"
                disabled={busy || !config.live_available}
                onClick={() =>
                  void mutate(`/documents/${selected.id}/index`, "POST")
                }
              >
                <RefreshCw size={15} />
                Index
              </button>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => {
                  setReplacement(selected.id);
                  upload.current?.click();
                }}
              >
                <Upload size={15} />
                Replace
              </button>
              <button
                className="button danger"
                onClick={() => {
                  setRemove(selected);
                  setSelected(null);
                }}
              >
                <Trash2 size={15} />
                Delete
              </button>
            </div>
          )}
        </Modal>
      )}
      {remove && (
        <Modal title="Delete this document?" onClose={() => setRemove(null)}>
          <p>
            “{remove.title}” will be removed from the active library and live
            retrieval. Saved answers and tickets keep their historical source
            snapshots.
          </p>
          <button
            className="button danger"
            disabled={busy}
            onClick={() => void mutate(`/documents/${remove.id}`, "DELETE")}
          >
            Delete document
          </button>
        </Modal>
      )}
      {adminOpen && (
        <Modal title="Administrator access" onClose={() => setAdminOpen(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sessionStorage.setItem("sourcewell_admin", token);
              setAdminOpen(false);
              setMessage(
                "Token saved in this tab. The server checks it for every document change.",
              );
            }}
          >
            <p className="muted">
              Enter the ADMIN_TOKEN configured on your local server. Document
              administration is disabled in public mode.
            </p>
            <label htmlFor="admin-token">Administrator token</label>
            <input
              id="admin-token"
              type="password"
              value={token}
              autoComplete="off"
              onChange={(e) => setToken(e.target.value)}
            />
            <div className="action-row">
              <button className="button primary">Save access</button>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setToken("");
                  sessionStorage.removeItem("sourcewell_admin");
                  setAdminOpen(false);
                }}
              >
                Clear token
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
