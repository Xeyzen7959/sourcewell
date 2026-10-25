import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  FlaskConical,
  Inbox as InboxIcon,
  Menu,
  MessageSquare,
  X,
} from "lucide-react";
import { api } from "./api";
import { Ask } from "./Ask";
import { Knowledge } from "./Knowledge";
import { Inbox } from "./Inbox";
import { Evaluation } from "./Evaluation";
import { Modal, Notice, SourcePanel } from "./ui";
import type { Config, Page, Source } from "./types";

const navigation = [
  { id: "ask" as const, label: "Ask Sourcewell", icon: MessageSquare },
  { id: "knowledge" as const, label: "Knowledge", icon: BookOpen },
  { id: "inbox" as const, label: "Specialist inbox", icon: InboxIcon },
  { id: "evaluation" as const, label: "Evaluation lab", icon: FlaskConical },
];
function currentPage(): Page {
  const hash = window.location.hash.slice(1);
  return navigation.some((n) => n.id === hash) ? (hash as Page) : "ask";
}

export default function App() {
  const [page, setPage] = useState<Page>(currentPage);
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState("");
  const [source, setSource] = useState<Source | null>(null);
  const [menu, setMenu] = useState(false);
  const [about, setAbout] = useState(false);
  useEffect(() => {
    let active = true;
    api<Config>("/config")
      .then((value) => {
        if (active) setConfig(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    const navigate = () => {
      setPage(currentPage());
      setMenu(false);
    };
    window.addEventListener("hashchange", navigate);
    return () => {
      active = false;
      window.removeEventListener("hashchange", navigate);
    };
  }, []);
  function go(next: Page) {
    window.location.hash = next;
    setPage(next);
    setMenu(false);
  }
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <aside
        className={`sidebar ${menu ? "open" : ""}`}
        aria-label="Workspace navigation"
      >
        <a href="#ask" className="brand" onClick={() => go("ask")}>
          <span className="brand-mark">s</span>
          <span>
            sourcewell<span className="brand-period">.</span>
          </span>
        </a>
        <button className="workspace-switch" onClick={() => setAbout(true)}>
          <span className="workspace-avatar">C</span>
          <span>
            <strong>Cedarline Cloud</strong>
            <small>Demo workspace</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <span className="nav-label">Workspace</span>
        <nav>
          {navigation.map((item) => (
            <a
              href={`#${item.id}`}
              key={item.id}
              aria-label={item.label}
              aria-current={page === item.id ? "page" : undefined}
              onClick={() => go(item.id)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.id === "evaluation" && (
                <span className="nav-lab" aria-hidden="true">
                  LAB
                </span>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="portfolio-note">
            <span className="dot" />
            <span>Built for a closer look</span>
            <p>
              A portfolio project exploring
              <br />
              support you can substantiate.
            </p>
          </div>
          <a
            className="github-link"
            href="https://github.com/Xeyzen7959/sourcewell"
            target="_blank"
            rel="noreferrer"
          >
            Explore the source <ArrowUpRight size={15} />
          </a>
          <a
            className="builder"
            href="https://github.com/Xeyzen7959"
            target="_blank"
            rel="noreferrer"
          >
            <span className="builder-avatar">X</span>
            <span>
              Built by @Xeyzen7959<small>Software engineering portfolio</small>
            </span>
          </a>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label={menu ? "Close navigation" : "Open navigation"}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X size={21} /> : <Menu size={21} />}
          </button>
          <div className="breadcrumb">
            Workspace <span>/</span>
            <strong>{navigation.find((n) => n.id === page)?.label}</strong>
          </div>
          <button className="demo-badge" onClick={() => setAbout(true)}>
            <span className="dot" />
            Portfolio demo <span className="badge-divider" />
            Fictional data
          </button>
        </header>
        <main id="main-content" tabIndex={-1}>
          {error ? (
            <div className="content-page">
              <Notice error>
                {error} Start the API server and refresh this page.
              </Notice>
            </div>
          ) : !config ? (
            <div className="content-page">
              <Notice>Opening your workspace…</Notice>
            </div>
          ) : (
            <>
              {page === "ask" && (
                <Ask
                  config={config}
                  onSource={setSource}
                  onTicket={() => go("inbox")}
                />
              )}
              {page === "knowledge" && <Knowledge config={config} />}
              {page === "inbox" && (
                <Inbox onSource={setSource} onAsk={() => go("ask")} />
              )}
              {page === "evaluation" && <Evaluation />}
            </>
          )}
        </main>
        <footer className="workspace-footer">
          <span>Evidence first. Always.</span>
          <span>Sourcewell / v0.1</span>
        </footer>
      </div>
      {source && (
        <SourcePanel source={source} onClose={() => setSource(null)} />
      )}
      {about && (
        <Modal
          title="A workspace you can inspect"
          onClose={() => setAbout(false)}
        >
          <p>
            Sourcewell is a portfolio application built by @Xeyzen7959.
            Cedarline Cloud, its policies, and sample conversations are
            fictional.
          </p>
          <p>
            Recorded examples demonstrate saved workflows without API calls.
            Live mode uses real document retrieval and generation when
            configured on the server.
          </p>
          <p>
            Model-based checks can make mistakes. Dataset annotations require
            human review, and unrun evaluations never appear as measured
            accuracy.
          </p>
          <p className="caption">
            Sourcewell is a single-process portfolio application, not an
            enterprise support service.
          </p>
        </Modal>
      )}
    </div>
  );
}
