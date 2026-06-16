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
import tester

PUBLIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")

# Resultado "falso" devolvido ao modelo quando uma tool e acionada (sem funcao real)
TOOL_STUB_RESULT = (
    "OK (simulado): a tool foi acionada pelo sistema de teste, mas nao executa "
    "nenhuma acao real. Considere que a operacao foi concluida com sucesso e "
    "responda ao usuario."
)

MAX_TOOL_ROUNDS = 4

# Limites de tamanho de payload (anti-abuso / evita travar com entradas gigantes)
MAX_MESSAGE_CHARS = 100_000   # mensagem do chat
MAX_FOCUS_CHARS = 4_000       # "foco do teste" do Agente Testador


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


def _persist_test(result, settings):
    """Salva a conversa simulada do Agente Testador como uma sessao normal.

    - A conversa vira mensagens human/ai (aparece igual as outras na lista).
    - O relatorio fica numa mensagem especial (extra.kind == 'tester_report'),
      para o front poder reabri-lo depois. Retorna o session_id criado.
    """
    test_sid = f"test-{int(time.time())}"
    transcript = result.get("transcript", [])
    report = result.get("report", {}) or {}

    # titulo amigavel: prefixo + 1a fala do usuario-simulado + nota (se houver)
    first_user = next((m["content"] for m in transcript if m["role"] == "user"), "")
    base = (first_user[:34] + "...") if len(first_user) > 34 else (first_user or "Teste de prompt")
    nota = report.get("nota")
    title = "🤖 Teste: " + base + (f" (nota {nota})" if nota is not None else "")

    # a sessao guarda a config da IA-alvo que foi testada
    db.upsert_session(test_sid, title=title, settings=settings or None)

    # baloes da conversa (com selo do modelo da IA-alvo nas respostas)
    ai_extra = {"provider": result.get("target_provider"), "model": result.get("target_model")}
    for m in transcript:
        if m["role"] == "user":
            db.add_message(test_sid, "human", m["content"])
        else:
            db.add_message(test_sid, "ai", m["content"], extra=dict(ai_extra))

    # mensagem especial com o relatorio (nao e exibida como balao; abre no modal)
    db.add_message(
        test_sid, "ai", "Relatório do Agente Testador",
        extra={"kind": "tester_report", "report": report, "turns": result.get("turns", 0)},
    )
    return test_sid


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
        # ETag por mtime+size: navegador revalida e recebe 304 se nada mudou
        # (evita rebaixar o arquivo inteiro a cada F5, sem servir conteudo velho).
        st = os.stat(path)
        etag = f'"{int(st.st_mtime)}-{st.st_size}"'
        if self.headers.get("If-None-Match") == etag:
            self.send_response(304)
            self.send_header("ETag", etag)
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            return
        with open(path, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("ETag", etag)
        self.send_header("Cache-Control", "no-cache")
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

        # estaticos: resolve e garante que o caminho final fica DENTRO de public/
        rel = "index.html" if path in ("/", "") else urllib.parse.unquote(path.lstrip("/"))
        full = os.path.abspath(os.path.normpath(os.path.join(PUBLIC_DIR, rel)))
        try:
            inside = os.path.commonpath([full, PUBLIC_DIR]) == PUBLIC_DIR
        except ValueError:  # drives diferentes etc.
            inside = False
        if not inside:
            self.send_error(404, "Nao encontrado")
            return
        self._send_file(full)

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
            if len(text) > MAX_MESSAGE_CHARS:
                self._send_json(
                    {"error": f"Mensagem muito longa (max {MAX_MESSAGE_CHARS} caracteres)."},
                    status=400,
                )
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

        if path == "/api/test":
            # Roda o Agente Testador Automatico contra a config da IA-alvo e
            # SALVA a conversa simulada como uma sessao normal (aparece na lista),
            # guardando o relatorio numa mensagem especial para poder reabrir.
            settings = body.get("settings") or {}
            cfg = config.load()
            # override da config do testador vindo da UI (provider/model/max_turns/foco),
            # para valer ja nesta execucao sem precisar salvar a config antes
            tester_over = body.get("tester")
            if isinstance(tester_over, dict):
                cfg = {**cfg, "tester": {**(cfg.get("tester") or {}), **tester_over}}
            # limita o tamanho do "foco" para evitar prompts gigantes
            _tc = cfg.get("tester") or {}
            if isinstance(_tc.get("focus"), str) and len(_tc["focus"]) > MAX_FOCUS_CHARS:
                cfg = {**cfg, "tester": {**_tc, "focus": _tc["focus"][:MAX_FOCUS_CHARS]}}
            try:
                result = tester.run_test(cfg, settings)
                try:
                    result["session_id"] = _persist_test(result, settings)
                except Exception as e:  # noqa - nao perde o relatorio se o save falhar
                    result["save_error"] = f"Falha ao salvar a sessao de teste: {e}"
                self._send_json(result)
            except providers.ProviderError as e:
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
    # Porta e host vem do ambiente (producao/container) com fallback local.
    port = int(os.environ.get("PORT", "8000"))
    host = os.environ.get("HOST", "0.0.0.0")
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    db.init_db()
    storage = db.active_storage()
    server = ThreadingHTTPServer((host, port), Handler)
    print("=" * 56)
    print("  Sistema de Teste de Prompts")
    print(f"  Escutando em: {host}:{port}  (local: http://localhost:{port})")
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
