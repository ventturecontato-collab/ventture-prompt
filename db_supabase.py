"""
db_supabase.py - Backend de memoria no Supabase via API REST (PostgREST).

Mesma interface do db_sqlite.py, mas guardando os dados no Postgres do Supabase.
Usa so urllib (stdlib) + a service_role key (guardada no servidor, nunca exposta
ao navegador). As tabelas sao criadas pelo usuario rodando supabase_schema.sql.

Tabelas (iguais conceitualmente ao SQLite):
  - sessions(session_id, title, provider, model, system_prompt, temperature,
             context_window, tools jsonb, created_at, updated_at)
  - n8n_chat_histories(id, session_id, message jsonb, created_at)
"""

import json
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

import config

_SSL = ssl.create_default_context()
TIMEOUT = 30

_SETTINGS_KEYS = ("provider", "model", "system_prompt", "temperature", "context_window", "tools")


class StorageError(Exception):
    pass


# --------------------------------------------------------------------------- #
# Infra HTTP (PostgREST)
# --------------------------------------------------------------------------- #
def _creds():
    sb = config.load().get("supabase", {}) or {}
    return (sb.get("url") or "").rstrip("/"), (sb.get("service_key") or "")


def configured():
    url, key = _creds()
    return bool(url and key)


def _qs(params):
    # PostgREST usa operadores como eq.<valor> e order=id.asc; mantemos esses chars legiveis
    return "&".join(
        f"{k}={urllib.parse.quote(str(v), safe='*.,()')}" for k, v in (params or [])
    )


def _req(method, table, params=None, body=None, prefer=None):
    url, key = _creds()
    if not url or not key:
        raise StorageError("Supabase nao configurado (url/service_key).")
    full = f"{url}/rest/v1/{table}"
    if params:
        full += "?" + _qs(params)
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(full, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT, context=_SSL) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw.strip() else []
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")
        raise StorageError(f"Supabase HTTP {e.code}: {detail[:500]}")
    except urllib.error.URLError as e:
        raise StorageError(f"Supabase conexao: {e.reason}")
    except StorageError:
        raise
    except Exception as e:  # noqa
        raise StorageError(f"Supabase erro: {e}")


def healthy():
    """Confere conectividade + existencia da tabela. (True, '') ou (False, msg)."""
    try:
        _req("GET", "sessions", params=[("select", "session_id"), ("limit", 1)])
        return True, ""
    except StorageError as e:
        return False, str(e)


def _iso():
    return datetime.now(timezone.utc).isoformat()


def _to_epoch(val):
    if val is None:
        return time.time()
    if isinstance(val, (int, float)):
        return float(val)
    try:
        return datetime.fromisoformat(str(val).replace("Z", "+00:00")).timestamp()
    except Exception:
        return time.time()


def _settings_payload(settings):
    if not settings:
        return {}
    return {k: settings[k] for k in _SETTINGS_KEYS if settings.get(k) is not None}


def _norm_session(r):
    return {
        "session_id": r.get("session_id"),
        "title": r.get("title"),
        "updated_at": _to_epoch(r.get("updated_at")),
        "provider": r.get("provider"),
        "model": r.get("model"),
        "system_prompt": r.get("system_prompt"),
        "temperature": r.get("temperature"),
        "context_window": r.get("context_window"),
        "tools": r.get("tools") or [],
    }


# --------------------------------------------------------------------------- #
# Interface
# --------------------------------------------------------------------------- #
def init_db():
    # Tabelas sao criadas pelo usuario (supabase_schema.sql). Nada a fazer aqui.
    pass


def get_session(session_id):
    rows = _req(
        "GET", "sessions",
        params=[("select", "*"), ("session_id", f"eq.{session_id}"), ("limit", 1)],
    )
    return _norm_session(rows[0]) if rows else None


def ensure_session(session_id, title=None):
    upsert_session(session_id, title=title)


def upsert_session(session_id, title=None, settings=None):
    now = _iso()
    exists = get_session(session_id) is not None
    if not exists:
        row = {"session_id": session_id, "title": title or "Nova conversa",
               "created_at": now, "updated_at": now}
        row.update(_settings_payload(settings))
        _req("POST", "sessions", body=[row], prefer="return=minimal")
    else:
        patch = {"updated_at": now}
        if title:
            patch["title"] = title
        patch.update(_settings_payload(settings))
        _req(
            "PATCH", "sessions",
            params=[("session_id", f"eq.{session_id}")], body=patch, prefer="return=minimal",
        )


def list_sessions():
    rows = _req("GET", "sessions", params=[("select", "*"), ("order", "updated_at.desc")])
    # conta mensagens por sessao (sem RPC: traz so session_id e tabula)
    counts = {}
    try:
        hist = _req("GET", "n8n_chat_histories", params=[("select", "session_id")])
        for h in hist:
            sid = h.get("session_id")
            counts[sid] = counts.get(sid, 0) + 1
    except StorageError:
        pass
    out = []
    for r in rows:
        d = _norm_session(r)
        d["msg_count"] = counts.get(d["session_id"], 0)
        out.append(d)
    return out


def add_message(session_id, mtype, content, extra=None):
    payload = {"type": mtype, "data": {"content": content, "additional_kwargs": extra or {}}}
    _req(
        "POST", "n8n_chat_histories",
        body=[{"session_id": session_id, "message": payload, "created_at": _iso()}],
        prefer="return=minimal",
    )
    _req(
        "PATCH", "sessions",
        params=[("session_id", f"eq.{session_id}")],
        body={"updated_at": _iso()}, prefer="return=minimal",
    )


def get_history(session_id, limit=None):
    params = [("select", "*"), ("session_id", f"eq.{session_id}")]
    if limit:
        params += [("order", "id.desc"), ("limit", limit)]
    else:
        params += [("order", "id.asc")]
    rows = _req("GET", "n8n_chat_histories", params=params)
    if limit:
        rows = list(reversed(rows))
    out = []
    for r in rows:
        msg = r.get("message") or {}
        if isinstance(msg, str):
            try:
                msg = json.loads(msg)
            except Exception:
                msg = {}
        out.append(
            {
                "id": r.get("id"),
                "type": msg.get("type"),
                "content": msg.get("data", {}).get("content", ""),
                "extra": msg.get("data", {}).get("additional_kwargs", {}),
                "created_at": _to_epoch(r.get("created_at")),
            }
        )
    return out


def clear_session(session_id):
    _req(
        "DELETE", "n8n_chat_histories",
        params=[("session_id", f"eq.{session_id}")], prefer="return=minimal",
    )
    _req(
        "PATCH", "sessions",
        params=[("session_id", f"eq.{session_id}")],
        body={"updated_at": _iso()}, prefer="return=minimal",
    )


def delete_session(session_id):
    # ON DELETE CASCADE remove as mensagens junto
    _req(
        "DELETE", "sessions",
        params=[("session_id", f"eq.{session_id}")], prefer="return=minimal",
    )
