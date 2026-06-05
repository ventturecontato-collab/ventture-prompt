"""
server.py - Sistema de Teste de Prompts (localhost, so stdlib do Python).

Rodar:   py server.py        (ou:  py server.py 8000)
Abrir:   http://localhost:8000

Pecas:
  - UI estilo WhatsApp (pasta public/)
  - Memoria por sessao em SQLite, simulando a Postgres Chat Memory do n8n (db.py)
  - Multiplos provedores de IA (providers.py)
  - Tools "ativaveis": sem funcao real, mas o sistema avisa quando o prompt aciona
"""

import json
import os
import sys
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import config
import db
import providers

PUBLIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")

# Resultado "falso" devolvido ao modelo quando uma tool e acionada (sem funcao real)
TOOL_STUB_RESULT = (
    "OK (simulado): a tool foi acionada pelo sistema de teste, mas nao executa "
    "nenhuma acao real. Considere que a operacao foi concluida com sucesso e "
    "responda ao usuario."
)

MAX_TOOL_ROUNDS = 4


# --------------------------------------------------------------------------- #
# Orquestracao do chat
# --------------------------------------------------------------------------- #
def run_chat(session_id, user_text, settings=None):
    cfg = config.load()
    s = settings or {}

    # configuracao DESTA conversa (cai no default global quando ausente)
    provider = s.get("provider") or cfg.get("provider", "openai")
    model = s.get("model") or cfg.get("model", "")
    system = s.get("system_prompt") if s.get("system_prompt") is not None else cfg.get("system_prompt", "")
    temperature = float(s["temperature"] if s.get("temperature") is not None else cfg.get("temperature", 0.7))
    ctx_window = int(s["context_window"] if s.get("context_window") is not None else cfg.get("context_window", 20))
    tools = s.get("tools") if s.get("tools") is not None else (cfg.get("tools", []) or [])

    # persiste a config usada por esta conversa (config por conversa)
    db.upsert_session(
        session_id,
        settings={
            "provider": provider, "model": model, "system_prompt": system,
            "temperature": temperature, "context_window": ctx_window, "tools": tools,
        },
    )

    # 1) grava a mensagem do usuario na memoria
    db.add_message(session_id, "human", user_text)

    # se for a 1a mensagem, usa um titulo amigavel para a sessao
    history_now = db.get_history(session_id)
    if len([m for m in history_now if m["type"] == "human"]) == 1:
        title = (user_text[:40] + "...") if len(user_text) > 40 else user_text
        db.upsert_session(session_id, title=title)

    # 2) carrega a memoria (Context Window Length) e normaliza
    history = db.get_history(session_id, limit=ctx_window)
    messages = _to_normalized(history)
    context_count = len(messages)

    # 3) loop com possivel acionamento de tools
    tool_activations = []
    final_text = ""
    rounds = 0
    while rounds < MAX_TOOL_ROUNDS:
        rounds += 1
        result = providers.complete(cfg, provider, model, system, messages, tools, temperature)
        calls = result.get("tool_calls") or []

        if not calls:
            final_text = result.get("text", "")
            break

        # registra a chamada do assistente (com as tool calls) na conversa em memoria viva
        messages.append({"role": "assistant", "content": result.get("text", ""), "tool_calls": calls})

        for tc in calls:
            tool_activations.append({"name": tc["name"], "arguments": tc.get("arguments", {})})
            # persiste o evento de tool na memoria (tipo 'tool')
            db.add_message(
                session_id,
                "tool",
                TOOL_STUB_RESULT,
                extra={"tool_name": tc["name"], "arguments": tc.get("arguments", {})},
            )
            # devolve um resultado simulado para o modelo continuar
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "name": tc["name"],
                    "content": TOOL_STUB_RESULT,
                }
            )
        # volta pro topo do loop para o modelo responder com o resultado da tool
    else:
        final_text = final_text or "(limite de rounds de tool atingido)"

    # 4) grava a resposta final da IA + metadados (o que gerou esta resposta)
    extra = {
        "provider": provider,
        "model": model,
        "temperature": temperature,
        "system_prompt": system,
    }
    if tool_activations:
        extra["tool_activations"] = tool_activations
    db.add_message(session_id, "ai", final_text, extra=extra)

    return {
        "reply": final_text,
        "tool_activations": tool_activations,
        "context_count": context_count,
        "provider": provider,
        "model": model,
        "storage": db.active_storage(),
    }


def _to_normalized(history):
    """Converte mensagens do banco (formato LangChain) para o formato normalizado.

    Para o contexto da IA so reaproveitamos human/ai como texto simples
    (nao reenviamos tool_calls antigas para evitar inconsistencia entre rounds).
    """
    out = []
    for m in history:
        if m["type"] == "human":
            out.append({"role": "user", "content": m["content"]})
        elif m["type"] == "ai":
            out.append({"role": "assistant", "content": m["content"]})
        # mensagens 'tool' antigas ficam de fora do contexto reenviado
    return out


# --------------------------------------------------------------------------- #
# HTTP
# --------------------------------------------------------------------------- #
class Handler(BaseHTTPRequestHandler):
    server_version = "PromptTester/1.0"

    def log_message(self, fmt, *args):  # log enxuto
        sys.stderr.write("  %s - %s\n" % (self.address_string(), fmt % args))

    # ---- helpers ----
    def _send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        if not length:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            return {}

    def _send_file(self, path):
        if not os.path.isfile(path):
            self.send_error(404, "Nao encontrado")
            return
        ext = os.path.splitext(path)[1].lower()
        ctypes = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".svg": "image/svg+xml",
            ".png": "image/png",
            ".ico": "image/x-icon",
        }
        ctype = ctypes.get(ext, "application/octet-stream")
        with open(path, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    # ---- GET ----
    def do_GET(self):
        path = self.path.split("?", 1)[0]

        if path == "/api/config":
            view = config.public_view(config.load())
            view["storage"] = db.active_storage()
            view["storage_warning"] = db.storage_warning()
            self._send_json(view)
            return
        if path == "/api/sessions":
            self._send_json({"sessions": db.list_sessions()})
            return
        if path == "/api/models":
            qs = urllib.parse.parse_qs(self.path.split("?", 1)[1] if "?" in self.path else "")
            provider = (qs.get("provider", [""])[0]) or config.load().get("provider", "openai")
            try:
                models = providers.list_models(config.load(), provider)
                self._send_json({"models": models, "source": "api", "provider": provider})
            except providers.ProviderError as e:
                # 200 com lista vazia -> o front cai no fallback curado
                self._send_json(
                    {"models": [], "source": "error", "provider": provider, "error": str(e)}
                )
            except Exception as e:  # noqa
                self._send_json(
                    {"models": [], "source": "error", "provider": provider, "error": f"Erro interno: {e}"}
                )
            return
        if path.startswith("/api/messages/"):
            session_id = urllib.parse.unquote(path.rsplit("/", 1)[-1])
            self._send_json(
                {"messages": db.get_history(session_id), "settings": db.get_session(session_id)}
            )
            return

        # estaticos
        rel = "index.html" if path in ("/", "") else path.lstrip("/")
        rel = rel.replace("..", "")  # anti path traversal
        self._send_file(os.path.join(PUBLIC_DIR, rel))

    # ---- POST ----
    def do_POST(self):
        path = self.path.split("?", 1)[0]
        body = self._read_json()

        if path == "/api/config":
            saved = config.save(body)
            db.reset_backend()  # credenciais do Supabase podem ter mudado
            view = config.public_view(saved)
            view["storage"] = db.active_storage()
            view["storage_warning"] = db.storage_warning()
            self._send_json(view)
            return

        if path == "/api/session":
            session_id = body.get("session_id")
            if not session_id:
                self._send_json({"error": "session_id obrigatorio."}, status=400)
                return
            try:
                db.upsert_session(
                    session_id, title=body.get("title"), settings=body.get("settings")
                )
                self._send_json({"ok": True, "session": db.get_session(session_id)})
            except Exception as e:  # noqa
                self._send_json({"error": f"Erro ao salvar sessao: {e}"}, status=500)
            return

        if path == "/api/chat":
            session_id = body.get("session_id") or f"sess-{int(time.time())}"
            text = (body.get("message") or "").strip()
            if not text:
                self._send_json({"error": "Mensagem vazia."}, status=400)
                return
            try:
                result = run_chat(session_id, text, settings=body.get("settings"))
                result["session_id"] = session_id
                self._send_json(result)
            except providers.ProviderError as e:
                # status mais preciso conforme o tipo do erro do provedor
                kind = getattr(e, "kind", "provider")
                status = {"timeout": 504, "rate_limit": 429, "server": 502}.get(kind, 502)
                self._send_json({"error": str(e), "kind": kind}, status=status)
            except Exception as e:  # noqa
                self._send_json({"error": f"Erro interno: {e}"}, status=500)
            return

        if path == "/api/clear":
            session_id = body.get("session_id")
            if session_id:
                db.clear_session(session_id)
            self._send_json({"ok": True})
            return

        if path == "/api/delete":
            session_id = body.get("session_id")
            if session_id:
                db.delete_session(session_id)
            self._send_json({"ok": True})
            return

        self._send_json({"error": "Rota nao encontrada."}, status=404)


def main():
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    db.init_db()
    storage = db.active_storage()
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print("=" * 56)
    print("  Sistema de Teste de Prompts")
    print(f"  Rodando em:  http://localhost:{port}")
    print(f"  Memoria:     {storage.upper()}", end="")
    warn = db.storage_warning()
    print(f"  (Supabase indisponivel -> SQLite: {warn})" if warn else "")
    print("  Ctrl+C para parar")
    print("=" * 56)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nParando...")
        server.shutdown()


if __name__ == "__main__":
    main()
