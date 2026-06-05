"""
db.py - Fachada da camada de memoria.

Escolhe automaticamente o backend:
  - Supabase (db_supabase) quando ha credenciais configuradas E o banco responde;
  - SQLite (db_sqlite) caso contrario (fallback que sempre funciona).

server.py continua usando `import db` e as mesmas funcoes de sempre.
Apos salvar a config (que pode ligar/desligar o Supabase), chame
db.reset_backend() para reavaliar qual backend usar.
"""

import db_sqlite
import db_supabase

_active = None      # "supabase" | "sqlite"
_warning = ""       # motivo do fallback, se houver


def _choose():
    global _warning
    _warning = ""
    if db_supabase.configured():
        ok, msg = db_supabase.healthy()
        if ok:
            return "supabase"
        _warning = msg  # configurado mas indisponivel -> cai p/ SQLite e avisa
    return "sqlite"


def _backend():
    global _active
    if _active is None:
        _active = _choose()
    return db_supabase if _active == "supabase" else db_sqlite


def reset_backend():
    """Forca reavaliar o backend (ex.: depois de salvar credenciais)."""
    global _active
    _active = None


def active_storage():
    _backend()  # garante avaliacao
    return _active


def storage_warning():
    return _warning


# ---- interface delegada ----
def init_db():
    return _backend().init_db()


def ensure_session(session_id, title=None):
    return _backend().ensure_session(session_id, title=title)


def upsert_session(session_id, title=None, settings=None):
    return _backend().upsert_session(session_id, title=title, settings=settings)


def get_session(session_id):
    return _backend().get_session(session_id)


def list_sessions():
    return _backend().list_sessions()


def add_message(session_id, mtype, content, extra=None):
    return _backend().add_message(session_id, mtype, content, extra=extra)


def get_history(session_id, limit=None):
    return _backend().get_history(session_id, limit=limit)


def clear_session(session_id):
    return _backend().clear_session(session_id)


def delete_session(session_id):
    return _backend().delete_session(session_id)
