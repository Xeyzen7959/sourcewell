import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone

from fastapi import HTTPException


def now():
    return datetime.now(timezone.utc).isoformat()


class Store:
    def __init__(self, directory):
        directory.mkdir(parents=True, exist_ok=True)
        self.path = directory / "sourcewell.sqlite3"
        with self.db() as db:
            db.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY, title TEXT NOT NULL, filename TEXT NOT NULL,
                    content TEXT NOT NULL, hash TEXT NOT NULL, version INTEGER NOT NULL,
                    seeded INTEGER NOT NULL, updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS chunks (
                    id TEXT PRIMARY KEY, document_id TEXT NOT NULL, section TEXT NOT NULL,
                    page INTEGER, text TEXT NOT NULL,
                    FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS answers (
                    id TEXT PRIMARY KEY, owner TEXT NOT NULL, payload TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS tickets (
                    id TEXT PRIMARY KEY, owner TEXT NOT NULL, answer_id TEXT NOT NULL,
                    question TEXT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL,
                    note TEXT NOT NULL DEFAULT '', draft_reply TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS usage (
                    id TEXT PRIMARY KEY, created_at TEXT NOT NULL, kind TEXT NOT NULL,
                    input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
                    model TEXT NOT NULL, estimated_cost REAL
                );
            """)

    @contextmanager
    def db(self):
        db = sqlite3.connect(self.path, timeout=30)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        try:
            with db:
                yield db
        finally:
            db.close()

    def documents(self, public=False):
        with self.db() as db:
            return [
                dict(r)
                for r in db.execute(
                    "SELECT id,title,filename,hash,version,seeded,updated_at, "
                    "(SELECT count(*) FROM chunks WHERE document_id=documents.id) AS chunk_count "
                    "FROM documents WHERE (?=0 OR seeded=1) ORDER BY title",
                    (int(public),),
                )
            ]

    def document(self, doc_id, public=False):
        with self.db() as db:
            row = db.execute(
                "SELECT * FROM documents WHERE id=? AND (?=0 OR seeded=1)", (doc_id, int(public))
            ).fetchone()
        if not row:
            raise HTTPException(404, "Document not found")
        return dict(row)

    def chunks(self, public=False):
        with self.db() as db:
            return [
                dict(r)
                for r in db.execute(
                    "SELECT c.*, d.title, d.filename, d.version, d.seeded FROM chunks c "
                    "JOIN documents d ON d.id=c.document_id WHERE (?=0 OR d.seeded=1) ORDER BY c.id",
                    (int(public),),
                )
            ]

    def replace_document(self, document, chunks):
        with self.db() as db:
            db.execute(
                "INSERT OR REPLACE INTO documents VALUES (?,?,?,?,?,?,?,?)",
                (
                    document["id"],
                    document["title"],
                    document["filename"],
                    document["content"],
                    document["hash"],
                    document["version"],
                    int(document["seeded"]),
                    now(),
                ),
            )
            db.execute("DELETE FROM chunks WHERE document_id=?", (document["id"],))
            db.executemany(
                "INSERT INTO chunks VALUES (?,?,?,?,?)",
                [(c["id"], document["id"], c["section"], c["page"], c["text"]) for c in chunks],
            )

    def delete_document(self, doc_id):
        with self.db() as db:
            db.execute("DELETE FROM documents WHERE id=?", (doc_id,))

    def save_answer(self, owner, payload):
        answer_id = str(uuid.uuid4())
        payload["id"] = answer_id
        with self.db() as db:
            db.execute("INSERT INTO answers VALUES (?,?,?)", (answer_id, owner, json.dumps(payload)))
        return payload

    def answer(self, owner, answer_id):
        with self.db() as db:
            row = db.execute(
                "SELECT payload FROM answers WHERE id=? AND owner=?", (answer_id, owner)
            ).fetchone()
        if not row:
            raise HTTPException(404, "Answer not found in this session")
        return json.loads(row[0])

    def tickets(self, owner):
        with self.db() as db:
            rows = db.execute(
                "SELECT * FROM tickets WHERE owner=? ORDER BY created_at DESC", (owner,)
            ).fetchall()
        return [dict(r) for r in rows]

    def handoff(self, owner, answer_id, reason):
        answer = self.answer(owner, answer_id)
        ticket_id = str(uuid.uuid4())
        with self.db() as db:
            existing = db.execute(
                "SELECT id FROM tickets WHERE owner=? AND answer_id=?", (owner, answer_id)
            ).fetchone()
            if existing:
                return existing[0]
            db.execute(
                "INSERT INTO tickets (id,owner,answer_id,question,reason,status,created_at) "
                "VALUES (?,?,?,?,?,'open',?)",
                (ticket_id, owner, answer_id, answer["question"], reason, now()),
            )
        return ticket_id

    def update_ticket(self, owner, ticket_id, update):
        with self.db() as db:
            cursor = db.execute(
                "UPDATE tickets SET status=?,note=?,draft_reply=? WHERE id=? AND owner=?",
                (update.status, update.note, update.draft_reply, ticket_id, owner),
            )
        if cursor.rowcount == 0:
            raise HTTPException(404, "Ticket not found in this session")

    def reserve_call(self, kind, model, limit):
        call_id = str(uuid.uuid4())
        with self.db() as db:
            db.execute("BEGIN IMMEDIATE")
            count = db.execute("SELECT count(*) FROM usage WHERE created_at>=?", (now()[:10],)).fetchone()[0]
            if count >= limit:
                raise HTTPException(429, "Daily provider-call cap reached. Try recorded examples.")
            db.execute(
                "INSERT INTO usage (id,created_at,kind,model) VALUES (?,?,?,?)", (call_id, now(), kind, model)
            )
        return call_id

    def record_usage(self, call_id, input_tokens, output_tokens, cost):
        with self.db() as db:
            db.execute(
                "UPDATE usage SET input_tokens=?,output_tokens=?,estimated_cost=? WHERE id=?",
                (input_tokens, output_tokens, cost, call_id),
            )
