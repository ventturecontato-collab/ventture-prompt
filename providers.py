"""
providers.py - Integracao com os modelos de IA (so urllib, sem libs externas).

Provedores suportados:
  - openai      (Chat Completions)
  - anthropic   (Messages API / Claude)
  - gemini      (Google Generative Language)
  - compativel  (qualquer endpoint OpenAI-compativel: OpenRouter, Groq, LM Studio...)

Formato NORMALIZADO de mensagem usado internamente:
    {"role": "user"|"assistant"|"tool",
     "content": str,
     "tool_calls": [{"id","name","arguments"(dict)}],   # so em assistant
     "tool_call_id": str, "name": str}                   # so em tool

Cada provider.complete(...) devolve:
    {"text": str, "tool_calls": [{"id","name","arguments"}]}
"""

import json
import re
import socket
import ssl
import time
import urllib.error
import urllib.request

_SSL_CTX = ssl.create_default_context()
# Modelos de raciocinio ("pro") sao lentos; no fluxo de tools sao 2 chamadas
# sequenciais, entao o timeout precisa ser folgado.
TIMEOUT = 180

# Erros transitorios da API que valem uma nova tentativa (rate limit / 5xx).
RETRY_STATUSES = {429, 500, 502, 503, 504}
MAX_RETRIES = 2          # tentativas EXTRA alem da primeira
RETRY_BACKOFF = 1.5      # base do backoff exponencial (segundos)


class ProviderError(Exception):
    """Erro de provedor. `kind` ajuda a UI a explicar (timeout, rate_limit, ...)."""

    def __init__(self, message, kind="provider"):
        super().__init__(message)
        self.kind = kind


def _post(url, headers, body):
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    return _send(req)


def _get(url, headers):
    req = urllib.request.Request(url, headers=headers, method="GET")
    return _send(req)


def _clean_error_msg(detail):
    """Extrai a mensagem limpa do JSON de erro (OpenAI/Anthropic/Gemini usam error.message)."""
    msg = detail[:800]
    try:
        j = json.loads(detail)
        err = j.get("error") if isinstance(j, dict) else None
        if isinstance(err, dict) and err.get("message"):
            msg = err["message"]
        elif isinstance(err, str):
            msg = err
        elif isinstance(j, dict) and j.get("message"):
            msg = j["message"]
    except Exception:
        pass
    return msg


def _retry_after(e, attempt):
    """Segundos a esperar antes da proxima tentativa (respeita Retry-After se houver)."""
    try:
        ra = e.headers.get("Retry-After")
        if ra and ra.isdigit():
            return min(int(ra), 30)
    except Exception:
        pass
    return RETRY_BACKOFF * (2 ** (attempt - 1))  # 1.5s, 3s, ...


def _send(req):
    attempt = 0
    while True:
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT, context=_SSL_CTX) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw)
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")
            # erro transitorio (rate limit / 5xx) -> tenta de novo com backoff
            if e.code in RETRY_STATUSES and attempt < MAX_RETRIES:
                attempt += 1
                time.sleep(_retry_after(e, attempt))
                continue
            kind = "rate_limit" if e.code == 429 else ("server" if e.code >= 500 else "provider")
            raise ProviderError(_clean_error_msg(detail), kind=kind)
        except (socket.timeout, TimeoutError):
            raise ProviderError(
                f"O modelo demorou demais e atingiu o tempo limite ({TIMEOUT}s). "
                "Modelos 'pro'/raciocinio sao lentos (ainda mais quando acionam tools). "
                "Tente de novo ou escolha um modelo de chat (ex.: gpt-5.5).",
                kind="timeout",
            )
        except urllib.error.URLError as e:
            reason = e.reason
            if isinstance(reason, (socket.timeout, TimeoutError)) or "timed out" in str(reason).lower():
                raise ProviderError(
                    f"O modelo demorou demais e atingiu o tempo limite ({TIMEOUT}s). "
                    "Modelos 'pro'/raciocinio sao lentos (ainda mais quando acionam tools). "
                    "Tente de novo ou escolha um modelo de chat (ex.: gpt-5.5).",
                    kind="timeout",
                )
            raise ProviderError(f"Falha de conexao com o provedor: {reason}", kind="network")
        except ProviderError:
            raise
        except Exception as e:  # noqa
            raise ProviderError(f"Erro inesperado: {e}", kind="unknown")


def _tool_schema_generic(tools):
    """Schema de funcao 'vazio' (sem parametros reais). Aceita argumentos livres."""
    return [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t.get("description", ""),
                "parameters": {"type": "object", "properties": {}, "additionalProperties": True},
            },
        }
        for t in tools
    ]


# --------------------------------------------------------------------------- #
# OpenAI / compativel
# --------------------------------------------------------------------------- #
def _openai_messages(system, messages):
    out = []
    if system:
        out.append({"role": "system", "content": system})
    for m in messages:
        if m["role"] == "tool":
            out.append(
                {
                    "role": "tool",
                    "tool_call_id": m.get("tool_call_id", m.get("name", "tool")),
                    "content": m.get("content", ""),
                }
            )
        elif m["role"] == "assistant" and m.get("tool_calls"):
            out.append(
                {
                    "role": "assistant",
                    "content": m.get("content") or "",
                    "tool_calls": [
                        {
                            "id": tc["id"],
                            "type": "function",
                            "function": {
                                "name": tc["name"],
                                "arguments": json.dumps(tc.get("arguments", {}), ensure_ascii=False),
                            },
                        }
                        for tc in m["tool_calls"]
                    ],
                }
            )
        else:
            out.append({"role": m["role"], "content": m.get("content", "")})
    return out


def _complete_openai(base_url, api_key, model, system, messages, tools, temperature):
    url = base_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        # OpenRouter pede esses headers (ignorados pelos demais)
        "HTTP-Referer": "http://localhost",
        "X-Title": "Sistema de Prompts",
    }
    body = {
        "model": model,
        "messages": _openai_messages(system, messages),
        "temperature": temperature,
    }
    if tools:
        body["tools"] = _tool_schema_generic(tools)
        body["tool_choice"] = "auto"
    try:
        data = _post(url, headers, body)
    except ProviderError as e:
        # modelos de raciocinio (o1/o3/o4, gpt-5*) so aceitam temperature padrao (1).
        # Se reclamou da temperature, tenta de novo sem o parametro.
        if "temperature" in str(e).lower() and "temperature" in body:
            body.pop("temperature", None)
            data = _post(url, headers, body)
        else:
            raise
    try:
        msg = data["choices"][0]["message"]
    except (KeyError, IndexError):
        raise ProviderError(f"Resposta inesperada: {json.dumps(data)[:500]}")
    calls = []
    for tc in msg.get("tool_calls") or []:
        fn = tc.get("function", {})
        try:
            args = json.loads(fn.get("arguments") or "{}")
        except Exception:
            args = {"_raw": fn.get("arguments")}
        calls.append({"id": tc.get("id", "call_0"), "name": fn.get("name"), "arguments": args})
    return {"text": msg.get("content") or "", "tool_calls": calls}


# --------------------------------------------------------------------------- #
# OpenAI - Responses API (modelos "pro"/raciocinio: gpt-5.x-pro, o1-pro, ...)
# Esses modelos NAO funcionam em /v1/chat/completions; usam /v1/responses.
# --------------------------------------------------------------------------- #
def _needs_responses_api(err_msg):
    """Heuristica: a mensagem de erro indica que o modelo exige /v1/responses?"""
    m = (err_msg or "").lower()
    return (
        "not a chat model" in m
        or "v1/responses" in m
        or "use the responses api" in m
        or "only supported in" in m and "responses" in m
    )


def _responses_input(messages):
    """Converte mensagens normalizadas para o array 'input' da Responses API.

    Mistura mensagens com papel (user/assistant) e itens tipados
    (function_call / function_call_output), como a API espera.
    """
    out = []
    for m in messages:
        if m["role"] == "tool":
            out.append(
                {
                    "type": "function_call_output",
                    "call_id": m.get("tool_call_id", m.get("name", "tool")),
                    "output": m.get("content", ""),
                }
            )
        elif m["role"] == "assistant" and m.get("tool_calls"):
            if m.get("content"):
                out.append({"role": "assistant", "content": m["content"]})
            for tc in m["tool_calls"]:
                out.append(
                    {
                        "type": "function_call",
                        "call_id": tc["id"],
                        "name": tc["name"],
                        "arguments": json.dumps(tc.get("arguments", {}), ensure_ascii=False),
                    }
                )
        else:
            out.append({"role": m["role"], "content": m.get("content", "")})
    return out


def _complete_openai_responses(api_key, model, system, messages, tools, temperature):
    url = "https://api.openai.com/v1/responses"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": model,
        "input": _responses_input(messages),
        "temperature": temperature,
        # esforco de raciocinio menor => mais rapido (reduz risco de timeout).
        # "medium" e o minimo aceito por modelos como gpt-5.x-pro.
        "reasoning": {"effort": "medium"},
    }
    if system:
        body["instructions"] = system
    if tools:
        # na Responses API o schema de funcao e "plano" (sem aninhar em "function")
        body["tools"] = [
            {
                "type": "function",
                "name": t["name"],
                "description": t.get("description", ""),
                "parameters": {"type": "object", "properties": {}, "additionalProperties": True},
            }
            for t in tools
        ]
        body["tool_choice"] = "auto"

    # alguns modelos rejeitam 'temperature' e/ou 'reasoning'; remove o parametro
    # reclamado e tenta de novo (ate esgotar os candidatos).
    for _ in range(3):
        try:
            data = _post(url, headers, body)
            break
        except ProviderError as e:
            low = str(e).lower()
            if "temperature" in low and "temperature" in body:
                body.pop("temperature", None)
                continue
            # erro do tipo "'low' is not supported..." ou que cite effort/reasoning
            if ("reasoning" in low or "effort" in low) and "reasoning" in body:
                body.pop("reasoning", None)
                continue
            raise
    else:
        raise ProviderError("Nao foi possivel completar a chamada na Responses API.")
    text_parts, calls = [], []
    for item in data.get("output", []) or []:
        itype = item.get("type")
        if itype == "message":
            for block in item.get("content", []) or []:
                if block.get("type") in ("output_text", "text"):
                    text_parts.append(block.get("text", ""))
        elif itype == "function_call":
            try:
                args = json.loads(item.get("arguments") or "{}")
            except Exception:
                args = {"_raw": item.get("arguments")}
            calls.append(
                {"id": item.get("call_id", "call_0"), "name": item.get("name"), "arguments": args}
            )
        # itens "reasoning" e outros sao ignorados
    text = "".join(text_parts)
    if not text and not calls:
        # fallback: campo agregado, quando presente
        text = data.get("output_text", "") or ""
    return {"text": text, "tool_calls": calls}


def _complete_openai_auto(api_key, model, system, messages, tools, temperature):
    """OpenAI real: tenta chat/completions e cai na Responses API para modelos 'pro'."""
    try:
        return _complete_openai(
            "https://api.openai.com/v1", api_key, model, system, messages, tools, temperature
        )
    except ProviderError as e:
        if _needs_responses_api(str(e)):
            return _complete_openai_responses(api_key, model, system, messages, tools, temperature)
        raise


# --------------------------------------------------------------------------- #
# Anthropic (Claude)
# --------------------------------------------------------------------------- #
def _anthropic_messages(messages):
    out = []
    for m in messages:
        if m["role"] == "tool":
            out.append(
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "tool_result",
                            "tool_use_id": m.get("tool_call_id", "tool"),
                            "content": m.get("content", ""),
                        }
                    ],
                }
            )
        elif m["role"] == "assistant" and m.get("tool_calls"):
            blocks = []
            if m.get("content"):
                blocks.append({"type": "text", "text": m["content"]})
            for tc in m["tool_calls"]:
                blocks.append(
                    {
                        "type": "tool_use",
                        "id": tc["id"],
                        "name": tc["name"],
                        "input": tc.get("arguments", {}),
                    }
                )
            out.append({"role": "assistant", "content": blocks})
        else:
            out.append({"role": m["role"], "content": m.get("content", "")})
    return out


def _complete_anthropic(api_key, model, system, messages, tools, temperature):
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    body = {
        "model": model,
        "max_tokens": 1024,
        "temperature": temperature,
        "messages": _anthropic_messages(messages),
    }
    if system:
        body["system"] = system
    if tools:
        body["tools"] = [
            {
                "name": t["name"],
                "description": t.get("description", ""),
                "input_schema": {"type": "object", "properties": {}, "additionalProperties": True},
            }
            for t in tools
        ]
    data = _post(url, headers, body)
    if "content" not in data:
        raise ProviderError(f"Resposta inesperada: {json.dumps(data)[:500]}")
    text_parts, calls = [], []
    for block in data.get("content", []):
        if block.get("type") == "text":
            text_parts.append(block.get("text", ""))
        elif block.get("type") == "tool_use":
            calls.append(
                {"id": block.get("id", "call_0"), "name": block.get("name"), "arguments": block.get("input", {})}
            )
    return {"text": "".join(text_parts), "tool_calls": calls}


# --------------------------------------------------------------------------- #
# Google Gemini
# --------------------------------------------------------------------------- #
def _gemini_contents(messages):
    out = []
    for m in messages:
        if m["role"] == "tool":
            out.append(
                {
                    "role": "user",
                    "parts": [
                        {
                            "functionResponse": {
                                "name": m.get("name", "tool"),
                                "response": {"result": m.get("content", "")},
                            }
                        }
                    ],
                }
            )
        elif m["role"] == "assistant" and m.get("tool_calls"):
            parts = []
            if m.get("content"):
                parts.append({"text": m["content"]})
            for tc in m["tool_calls"]:
                parts.append({"functionCall": {"name": tc["name"], "args": tc.get("arguments", {})}})
            out.append({"role": "model", "parts": parts})
        else:
            role = "model" if m["role"] == "assistant" else "user"
            out.append({"role": role, "parts": [{"text": m.get("content", "")}]})
    return out


def _complete_gemini(api_key, model, system, messages, tools, temperature):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    body = {
        "contents": _gemini_contents(messages),
        "generationConfig": {"temperature": temperature},
    }
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}
    if tools:
        body["tools"] = [
            {
                "functionDeclarations": [
                    {
                        "name": t["name"],
                        "description": t.get("description", ""),
                        "parameters": {"type": "object", "properties": {}},
                    }
                    for t in tools
                ]
            }
        ]
    data = _post(url, headers, body)
    try:
        parts = data["candidates"][0]["content"]["parts"]
    except (KeyError, IndexError):
        # pode vir bloqueado por safety, etc.
        raise ProviderError(f"Resposta inesperada: {json.dumps(data)[:500]}")
    text_parts, calls = [], []
    for i, p in enumerate(parts):
        if "text" in p:
            text_parts.append(p["text"])
        elif "functionCall" in p:
            fc = p["functionCall"]
            calls.append({"id": f"call_{i}", "name": fc.get("name"), "arguments": fc.get("args", {})})
    return {"text": "".join(text_parts), "tool_calls": calls}


# --------------------------------------------------------------------------- #
# Dispatcher
# --------------------------------------------------------------------------- #
def complete(cfg, provider, model, system, messages, tools, temperature):
    keys = cfg.get("api_keys", {})
    if provider == "openai":
        key = keys.get("openai")
        if not key:
            raise ProviderError("API key da OpenAI nao configurada.")
        return _complete_openai_auto(key, model, system, messages, tools, temperature)
    if provider == "compativel":
        key = keys.get("compativel") or "sk-no-key"
        base = cfg.get("compativel_base_url") or "https://openrouter.ai/api/v1"
        return _complete_openai(base, key, model, system, messages, tools, temperature)
    if provider == "anthropic":
        key = keys.get("anthropic")
        if not key:
            raise ProviderError("API key da Anthropic nao configurada.")
        return _complete_anthropic(key, model, system, messages, tools, temperature)
    if provider == "gemini":
        key = keys.get("gemini")
        if not key:
            raise ProviderError("API key do Gemini nao configurada.")
        return _complete_gemini(key, model, system, messages, tools, temperature)
    raise ProviderError(f"Provedor desconhecido: {provider}")


# --------------------------------------------------------------------------- #
# Listagem de modelos (ao vivo, via endpoint /models de cada provedor)
# --------------------------------------------------------------------------- #

# Palavras que indicam modelo NAO-chat (embedding/audio/imagem/etc.)
_NON_CHAT = (
    "embedding", "embed", "whisper", "tts", "audio", "moderation",
    "dall-e", "dalle", "image", "imagen", "realtime", "transcribe",
    "rerank", "aqa", "veo", "speech",
)


def _is_openai_chat(model_id):
    mid = model_id.lower()
    if "instruct" in mid:  # gpt-3.5-turbo-instruct usa /v1/completions, nao e chat
        return False
    if any(w in mid for w in _NON_CHAT):
        return False
    return mid.startswith(("gpt", "o1", "o3", "o4", "chatgpt"))


def _openai_tag(mid):
    """Etiqueta curta a partir do id do modelo OpenAI."""
    m = mid.lower()
    if m.startswith(("o1", "o3", "o4")):
        return "raciocínio"
    if "codex" in m:
        return "código"
    if "search" in m:
        return "web search"
    if "-pro" in m:
        return "pro"
    if "nano" in m:
        return "ultra rápido"
    if "mini" in m:
        return "rápido"
    if "chat-latest" in m:
        return "chat"
    if re.search(r"-\d{4}(-\d{2}-\d{2})?$", m):
        return "snapshot"
    if m.startswith("gpt-3.5") or m == "gpt-4" or m.startswith("gpt-4-"):
        return "legado"
    return "chat"


def _list_openai(base_url, api_key):
    url = base_url.rstrip("/") + "/models"
    headers = {"Authorization": f"Bearer {api_key}"}
    data = _get(url, headers)
    out = []
    for m in data.get("data", []):
        mid = m.get("id")
        if not mid or not _is_openai_chat(mid):
            continue
        out.append({"id": mid, "tag": _openai_tag(mid), "created": m.get("created", 0)})
    out.sort(key=lambda x: x["created"], reverse=True)  # mais recente primeiro
    for m in out:
        del m["created"]
    return out


def _list_compativel(base_url, api_key):
    """Endpoints OpenAI-compativeis (OpenRouter, Groq, LM Studio...).

    Nao filtra por prefixo (ids variam muito), mas tenta excluir nao-chat
    via modalidade quando o provedor informa.
    """
    url = base_url.rstrip("/") + "/models"
    headers = {}
    if api_key and api_key != "sk-no-key":
        headers["Authorization"] = f"Bearer {api_key}"
    headers["HTTP-Referer"] = "http://localhost"
    headers["X-Title"] = "Sistema de Prompts"
    data = _get(url, headers)
    out = []
    for m in data.get("data", []):
        mid = m.get("id")
        if not mid:
            continue
        # filtra por modalidade de SAIDA quando informado (OpenRouter)
        arch = m.get("architecture", {}) or {}
        out_mod = m.get("output_modalities") or (
            arch.get("output_modalities") if isinstance(arch, dict) else None
        )
        modality = (arch.get("modality") or "") if isinstance(arch, dict) else ""
        # "modality" vem como "entrada->saida" (ex.: "text+image->text")
        out_part = modality.split("->", 1)[1] if "->" in modality else modality
        if out_mod and "text" not in out_mod:
            continue
        if out_part and "text" not in out_part:
            continue
        if any(w in mid.lower() for w in ("embedding", "whisper", "tts", "rerank")):
            continue
        tag = mid.split("/")[0] if "/" in mid else ""
        out.append({"id": mid, "tag": tag})
    return out


def _list_anthropic(api_key):
    url = "https://api.anthropic.com/v1/models?limit=1000"
    headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01"}
    data = _get(url, headers)
    out = []
    for m in data.get("data", []):
        mid = m.get("id")
        if not mid:
            continue
        out.append({"id": mid, "tag": m.get("display_name", "")})
    return out


def _list_gemini(api_key):
    out = []
    page_token = None
    for _ in range(20):  # trava de seguranca contra loop infinito
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models"
            f"?key={api_key}&pageSize=200"
        )
        if page_token:
            url += f"&pageToken={page_token}"
        data = _get(url, {})
        for m in data.get("models", []):
            methods = m.get("supportedGenerationMethods", [])
            if "generateContent" not in methods:
                continue
            name = m.get("name", "")
            mid = name[len("models/"):] if name.startswith("models/") else name
            if not mid or any(w in mid.lower() for w in _NON_CHAT):
                continue
            out.append({"id": mid, "tag": m.get("displayName", "")})
        page_token = data.get("nextPageToken")
        if not page_token:
            break
    return out


def list_models(cfg, provider):
    """Retorna [{"id","tag"}] de modelos de chat do provedor (ao vivo)."""
    keys = cfg.get("api_keys", {})
    if provider == "openai":
        key = keys.get("openai")
        if not key:
            raise ProviderError("API key da OpenAI nao configurada.")
        return _list_openai("https://api.openai.com/v1", key)
    if provider == "compativel":
        key = keys.get("compativel") or "sk-no-key"
        base = cfg.get("compativel_base_url") or "https://openrouter.ai/api/v1"
        return _list_compativel(base, key)
    if provider == "anthropic":
        key = keys.get("anthropic")
        if not key:
            raise ProviderError("API key da Anthropic nao configurada.")
        return _list_anthropic(key)
    if provider == "gemini":
        key = keys.get("gemini")
        if not key:
            raise ProviderError("API key do Gemini nao configurada.")
        return _list_gemini(key)
    raise ProviderError(f"Provedor desconhecido: {provider}")
