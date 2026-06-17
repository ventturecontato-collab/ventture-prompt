"""
db_sqlite.py - Backend de memoria em SQLite (arquivo local, zero instalacao).

Simula a "Postgres Chat Memory" do n8n/LangChain. Agora cada SESSAO tambem
guarda a configuracao usada (provider/model/system_prompt/temperature/
context_window/tools) -> "configuracao por conversa".

Tabelas:
  - n8n_chat_histories(id, session_id, message[json LangChain], created_at)
  - sessions(session_id, title, provider, model, system_prompt, temperature,
             context_window, tools[json], created_at, updated_at)

Interface usada pela fachada db.py / server.py:
  init_db, ensure_session, upsert_session, get_session, list_sessions,
  add_message, get_history, clear_session, delete_session
"""

import json
import os
import sqlite3
import threading
import time

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "memoria.db")

_lock = threading.Lock()

# colunas de "configuracao por conversa" guardadas na tabela sessions
_SETTINGS_COLS = {
    "provider": "TEXT",
    "model": "TEXT",
    "system_prompt": "TEXT",
    "temperature": "REAL",
    "context_window": "INTEGER",
    "tools": "TEXT",  # JSON
}

# colunas extras (nao-settings) adicionadas por migracao leve
_EXTRA_COLS = {
    "folder_id": "TEXT",  # pasta/cliente a que a conversa pertence (nulo = sem pasta)
}


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    return conn


def init_db():
    with _lock, _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS n8n_chat_histories (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id  TEXT NOT NULL,
                message     TEXT NOT NULL,
                created_at  REAL NOT NULL
            );
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_session ON n8n_chat_histories(session_id);"
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                session_id  TEXT PRIMARY KEY,
                title       TEXT,
                created_at  REAL NOT NULL,
                updated_at  REAL NOT NULL
            );
            """
        )
        # migracao leve: adiciona colunas de settings/extras se faltarem
        existing = {r["name"] for r in conn.execute("PRAGMA table_info(sessions)")}
        for col, typ in {**_SETTINGS_COLS, **_EXTRA_COLS}.items():
            if col not in existing:
                conn.execute(f"ALTER TABLE sessions ADD COLUMN {col} {typ}")
        # tabela de pastas (clientes): agrupa conversas e guarda o prompt do cliente
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS folders (
                folder_id   TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                prompt      TEXT,
                created_at  REAL NOT NULL,
                updated_at  REAL NOT NULL
            );
            """
        )
        conn.commit()


def _row_to_session(r):
    tools = []
    if r["tools"]:
        try:
            tools = json.loads(r["tools"])
        except Exception:
            tools = []
    return {
        "session_id": r["session_id"],
        "title": r["title"],
        "updated_at": r["updated_at"],
        "provider": r["provider"],
        "model": r["model"],
        "system_prompt": r["system_prompt"],
        "temperature": r["temperature"],
        "context_window": r["context_window"],
        "tools": tools,
        "folder_id": r["folder_id"] if "folder_id" in r.keys() else None,
    }


def ensure_session(session_id, title=None):
    upsert_session(session_id, title=title)


def upsert_session(session_id, title=None, settings=None, folder_id=None):
    """Cria a sessao (se nao existe) e atualiza titulo, settings e/ou pasta.

    folder_id: passe uma string para mover para a pasta, "" (ou nao passe) para
    nao mexer. Use set_session_folder(..., None) para desagrupar explicitamente.
    """
    now = time.time()
    with _lock, _connect() as conn:
        row = conn.execute(
            "SELECT session_id FROM sessions WHERE session_id = ?", (session_id,)
        ).fetchone()
        if row is None:
            conn.execute(
                "INSERT INTO sessions (session_id, title, folder_id, created_at, updated_at) VALUES (?,?,?,?,?)",
                (session_id, title or "Nova conversa", folder_id or None, now, now),
            )
        else:
            if folder_id:
                conn.execute(
                    "UPDATE sessions SET folder_id = ?, updated_at = ? WHERE session_id = ?",
                    (folder_id, now, session_id),
                )
        if row is not None and title:
            conn.execute(
                "UPDATE sessions SET title = ?, updated_at = ? WHERE session_id = ?",
                (title, now, session_id),
            )
        if settings:
            fields, vals = [], []
            for col in _SETTINGS_COLS:
                if col == "tools":
                    continue
                if settings.get(col) is not None:
                    fields.append(f"{col} = ?")
                    vals.append(settings[col])
            if settings.get("tools") is not None:
                fields.append("tools = ?")
                vals.append(json.dumps(settings["tools"], ensure_ascii=False))
            if fields:
                fields.append("updated_at = ?")
                vals.append(now)
                vals.append(session_id)
                conn.execute(
                    f"UPDATE sessions SET {', '.join(fields)} WHERE session_id = ?", vals
                )
        conn.commit()


def get_session(session_id):
    with _lock, _connect() as conn:
        r = conn.execute(
            "SELECT * FROM sessions WHERE session_id = ?", (session_id,)
        ).fetchone()
    return _row_to_session(r) if r else None


def list_sessions():
    with _lock, _connect() as conn:
        rows = conn.execute(
            """
            SELECT s.*,
                   (SELECT COUNT(*) FROM n8n_chat_histories h
                      WHERE h.session_id = s.session_id) AS msg_count
            FROM sessions s
            ORDER BY s.updated_at DESC
            """
        ).fetchall()
    out = []
    for r in rows:
        d = _row_to_session(r)
        d["msg_count"] = r["msg_count"]
        out.append(d)
    return out


def add_message(session_id, mtype, content, extra=None):
    payload = {
        "type": mtype,
        "data": {"content": content, "additional_kwargs": extra or {}},
    }
    now = time.time()
    with _lock, _connect() as conn:
        conn.execute(
            "INSERT INTO n8n_chat_histories (session_id, message, created_at) VALUES (?,?,?)",
            (session_id, json.dumps(payload, ensure_ascii=False), now),
        )
        conn.execute(
            "UPDATE sessions SET updated_at = ? WHERE session_id = ?", (now, session_id)
        )
        conn.commit()


def get_history(session_id, limit=None):
    with _lock, _connect() as conn:
        if limit:
            rows = conn.execute(
                """
                SELECT id, message, created_at FROM (
                    SELECT id, message, created_at FROM n8n_chat_histories
                    WHERE session_id = ?
                    ORDER BY id DESC LIMIT ?
                ) ORDER BY id ASC
                """,
                (session_id, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, message, created_at FROM n8n_chat_histories WHERE session_id = ? ORDER BY id ASC",
                (session_id,),
            ).fetchall()

    out = []
    for r in rows:
        msg = json.loads(r["message"])
        out.append(
            {
                "id": r["id"],
                "type": msg.get("type"),
                "content": msg.get("data", {}).get("content", ""),
                "extra": msg.get("data", {}).get("additional_kwargs", {}),
                "created_at": r["created_at"],
            }
        )
    return out


def clear_session(session_id):
    with _lock, _connect() as conn:
        conn.execute(
            "DELETE FROM n8n_chat_histories WHERE session_id = ?", (session_id,)
        )
        conn.execute(
            "UPDATE sessions SET updated_at = ? WHERE session_id = ?",
            (time.time(), session_id),
        )
        conn.commit()


def delete_session(session_id):
    with _lock, _connect() as conn:
        conn.execute(
            "DELETE FROM n8n_chat_histories WHERE session_id = ?", (session_id,)
        )
        conn.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
        conn.commit()


# --------------------------------------------------------------------------- #
# Pastas (clientes)
# --------------------------------------------------------------------------- #
def _row_to_folder(r):
    return {
        "folder_id": r["folder_id"],
        "name": r["name"],
        "prompt": r["prompt"],
        "updated_at": r["updated_at"],
    }


def list_folders():
    """Lista as pastas com a contagem de conversas em cada uma."""
    with _lock, _connect() as conn:
        rows = conn.execute(
            """
            SELECT f.*,
                   (SELECT COUNT(*) FROM sessions s WHERE s.folder_id = f.folder_id) AS session_count
            FROM folders f
            ORDER BY f.name COLLATE NOCASE ASC
            """
        ).fetchall()
    out = []
    for r in rows:
        d = _row_to_folder(r)
        d["session_count"] = r["session_count"]
        out.append(d)
    return out


def create_folder(name, prompt=""):
    folder_id = f"fold-{int(time.time() * 1000)}"
    now = time.time()
    with _lock, _connect() as conn:
        conn.execute(
            "INSERT INTO folders (folder_id, name, prompt, created_at, updated_at) VALUES (?,?,?,?,?)",
            (folder_id, name or "Nova pasta", prompt or "", now, now),
        )
        conn.commit()
    return {"folder_id": folder_id, "name": name or "Nova pasta", "prompt": prompt or "",
            "updated_at": now, "session_count": 0}


def update_folder(folder_id, name=None, prompt=None):
    now = time.time()
    fields, vals = [], []
    if name is not None:
        fields.append("name = ?"); vals.append(name)
    if prompt is not None:
        fields.append("prompt = ?"); vals.append(prompt)
    if not fields:
        return
    fields.append("updated_at = ?"); vals.append(now)
    vals.append(folder_id)
    with _lock, _connect() as conn:
        conn.execute(f"UPDATE folders SET {', '.join(fields)} WHERE folder_id = ?", vals)
        conn.commit()


def delete_folder(folder_id):
    """Remove a pasta; as conversas dela viram 'sem pasta' (nao sao apagadas)."""
    with _lock, _connect() as conn:
        conn.execute(
            "UPDATE sessions SET folder_id = NULL WHERE folder_id = ?", (folder_id,)
        )
        conn.execute("DELETE FROM folders WHERE folder_id = ?", (folder_id,))
        conn.commit()


def set_session_folder(session_id, folder_id):
    """Move uma conversa para uma pasta (folder_id None/"" = sem pasta)."""
    with _lock, _connect() as conn:
        conn.execute(
            "UPDATE sessions SET folder_id = ?, updated_at = ? WHERE session_id = ?",
            (folder_id or None, time.time(), session_id),
        )
        conn.commit()
