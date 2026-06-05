"""
config.py - Persistencia das configuracoes (API keys + ajustes).

Salva em config.json ao lado do server. NAO comitar esse arquivo
(esta no .gitignore) porque guarda as API keys.
"""

import json
import os
import threading

CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")

_lock = threading.Lock()

DEFAULTS = {
    # API key por provedor
    "api_keys": {
        "openai": "",
        "anthropic": "",
        "gemini": "",
        "compativel": "",
    },
    # Base URL para o provedor "compativel" (OpenRouter, Groq, LM Studio, etc.)
    "compativel_base_url": "https://openrouter.ai/api/v1",
    # Banco de dados (Supabase via API REST). Vazio = usa SQLite local.
    "supabase": {
        "url": "",          # ex.: https://xxxx.supabase.co
        "service_key": "",  # service_role key (fica SO no servidor)
    },
    # Ajustes do "playground" (defaults para conversas NOVAS;
    # cada conversa guarda a propria copia destas configs).
    "provider": "openai",
    "model": "gpt-4o-mini",
    "system_prompt": "Voce e um assistente prestativo. Responda em portugues do Brasil.",
    "temperature": 0.7,
    "context_window": 20,  # quantas mensagens da memoria mandar como contexto
    # Tools que o prompt pode "ativar". Sem funcao real - so alertamos.
    "tools": [
        {
            "name": "consultar_agenda",
            "description": "Consulta horarios disponiveis na agenda da clinica.",
        },
        {
            "name": "registrar_lead",
            "description": "Registra um novo lead/paciente interessado.",
        },
    ],
}


def _deep_merge(base, override):
    out = dict(base)
    for k, v in (override or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


# Variaveis de ambiente que sobrescrevem o config.json (uso em producao/container).
# So sobrescrevem quando definidas e nao-vazias -> tem prioridade sobre o arquivo.
_ENV_MAP = {
    "OPENAI_API_KEY": ("api_keys", "openai"),
    "ANTHROPIC_API_KEY": ("api_keys", "anthropic"),
    "GEMINI_API_KEY": ("api_keys", "gemini"),
    "COMPATIVEL_API_KEY": ("api_keys", "compativel"),
    "COMPATIVEL_BASE_URL": ("compativel_base_url",),
    "SUPABASE_URL": ("supabase", "url"),
    "SUPABASE_SERVICE_KEY": ("supabase", "service_key"),
}


def _apply_env_overrides(cfg):
    """Sobrepoe segredos/ajustes vindos de variaveis de ambiente (se definidos)."""
    for env_name, path in _ENV_MAP.items():
        val = os.environ.get(env_name)
        if not val:
            continue
        target = cfg
        for key in path[:-1]:
            target = target.setdefault(key, {})
        target[path[-1]] = val
    return cfg


def load():
    with _lock:
        if not os.path.exists(CONFIG_PATH):
            return _apply_env_overrides(json.loads(json.dumps(DEFAULTS)))
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            return _apply_env_overrides(_deep_merge(DEFAULTS, data))
        except Exception:
            return _apply_env_overrides(json.loads(json.dumps(DEFAULTS)))


def _strip_masked(cfg):
    """Remove valores mascarados ('********') para nao sobrescrever segredos reais."""
    if not isinstance(cfg, dict):
        return cfg
    for sub in ("api_keys", "supabase"):
        d = cfg.get(sub)
        if isinstance(d, dict):
            for k in list(d.keys()):
                if d[k] == "********":
                    del d[k]
    return cfg


def save(new_config):
    """Mescla e grava. Retorna a config final."""
    with _lock:
        current = DEFAULTS
        if os.path.exists(CONFIG_PATH):
            try:
                with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                    current = _deep_merge(DEFAULTS, json.load(f))
            except Exception:
                current = json.loads(json.dumps(DEFAULTS))
        merged = _deep_merge(current, _strip_masked(new_config or {}))
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(merged, f, ensure_ascii=False, indent=2)
        return merged


def public_view(cfg):
    """Versao para o frontend: mascara as API keys (mostra se existe, nao o valor)."""
    safe = json.loads(json.dumps(cfg))
    keys = safe.get("api_keys", {})
    safe["api_keys_set"] = {k: bool(v) for k, v in keys.items()}
    # nao manda o valor das chaves para o navegador
    safe["api_keys"] = {k: ("" if not v else "********") for k, v in keys.items()}
    # Supabase: nunca expor a service_key; informar URL e se a key existe
    sb = safe.get("supabase", {}) or {}
    safe["supabase_set"] = {"url": bool(sb.get("url")), "service_key": bool(sb.get("service_key"))}
    safe["supabase"] = {
        "url": sb.get("url", ""),
        "service_key": "********" if sb.get("service_key") else "",
    }
    return safe
