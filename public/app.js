"use strict";

const $ = (id) => document.getElementById(id);
const api = async (url, opts) => {
  const r = await fetch(url, opts);
  return r.json();
};

// Modelos por provedor. tag = etiqueta curta exibida na direita.
const MODELS = {
  // Lista completa OpenAI (mais recente no topo). Fallback p/ quando não há key;
  // quando há key, é mesclada com a lista ao vivo da API.
  openai: [
    // --- GPT-5.5 ---
    { id: "gpt-5.5", tag: "topo" },
    { id: "gpt-5.5-2026-04-23", tag: "snapshot" },
    { id: "gpt-5.5-pro", tag: "pro" },
    { id: "gpt-5.5-pro-2026-04-23", tag: "snapshot" },
    // --- GPT-5.4 ---
    { id: "gpt-5.4", tag: "frontier" },
    { id: "gpt-5.4-2026-03-05", tag: "snapshot" },
    { id: "gpt-5.4-pro", tag: "pro" },
    { id: "gpt-5.4-pro-2026-03-05", tag: "snapshot" },
    { id: "gpt-5.4-mini", tag: "rápido" },
    { id: "gpt-5.4-mini-2026-03-17", tag: "snapshot" },
    { id: "gpt-5.4-nano", tag: "ultra rápido" },
    { id: "gpt-5.4-nano-2026-03-17", tag: "snapshot" },
    // --- GPT-5.3 ---
    { id: "gpt-5.3-codex", tag: "código" },
    { id: "gpt-5.3-chat-latest", tag: "chat (deprec.)" },
    // --- GPT-5.2 ---
    { id: "gpt-5.2", tag: "frontier" },
    { id: "gpt-5.2-2025-12-11", tag: "snapshot" },
    { id: "gpt-5.2-pro", tag: "pro" },
    { id: "gpt-5.2-pro-2025-12-11", tag: "snapshot" },
    { id: "gpt-5.2-codex", tag: "código" },
    { id: "gpt-5.2-chat-latest", tag: "chat (deprec.)" },
    // --- GPT-5.1 ---
    { id: "gpt-5.1", tag: "frontier" },
    { id: "gpt-5.1-2025-11-13", tag: "snapshot" },
    { id: "gpt-5.1-codex", tag: "código" },
    { id: "gpt-5.1-codex-mini", tag: "código" },
    { id: "gpt-5.1-codex-max", tag: "código" },
    { id: "gpt-5.1-chat-latest", tag: "chat (deprec.)" },
    // --- GPT-5 ---
    { id: "gpt-5", tag: "frontier" },
    { id: "gpt-5-2025-08-07", tag: "snapshot" },
    { id: "gpt-5-mini", tag: "rápido" },
    { id: "gpt-5-mini-2025-08-07", tag: "snapshot" },
    { id: "gpt-5-nano", tag: "ultra rápido" },
    { id: "gpt-5-nano-2025-08-07", tag: "snapshot" },
    { id: "gpt-5-codex", tag: "código" },
    { id: "gpt-5-codex-mini", tag: "código" },
    { id: "gpt-5-pro", tag: "pro" },
    { id: "gpt-5-pro-2025-10-06", tag: "snapshot" },
    { id: "gpt-5-search-api", tag: "web search" },
    { id: "gpt-5-search-api-2025-10-14", tag: "snapshot" },
    { id: "gpt-5-chat-latest", tag: "chat (deprec.)" },
    // --- GPT-4.1 ---
    { id: "gpt-4.1", tag: "rápido" },
    { id: "gpt-4.1-2025-04-14", tag: "snapshot" },
    { id: "gpt-4.1-mini", tag: "rápido" },
    { id: "gpt-4.1-mini-2025-04-14", tag: "snapshot" },
    { id: "gpt-4.1-nano", tag: "ultra rápido" },
    { id: "gpt-4.1-nano-2025-04-14", tag: "snapshot" },
    // --- GPT-4o ---
    { id: "gpt-4o", tag: "multimodal" },
    { id: "gpt-4o-2024-11-20", tag: "snapshot" },
    { id: "gpt-4o-2024-08-06", tag: "snapshot" },
    { id: "gpt-4o-2024-05-13", tag: "snapshot" },
    { id: "gpt-4o-mini", tag: "rápido" },
    { id: "gpt-4o-mini-2024-07-18", tag: "snapshot" },
    { id: "chatgpt-4o-latest", tag: "chat (deprec.)" },
    { id: "gpt-4o-search-preview", tag: "web search" },
    { id: "gpt-4o-search-preview-2025-03-11", tag: "snapshot" },
    { id: "gpt-4o-mini-search-preview", tag: "web search" },
    { id: "gpt-4o-mini-search-preview-2025-03-11", tag: "snapshot" },
    // --- série o (raciocínio) ---
    { id: "o3", tag: "raciocínio" },
    { id: "o3-2025-04-16", tag: "snapshot" },
    { id: "o3-pro", tag: "raciocínio" },
    { id: "o3-mini", tag: "raciocínio" },
    { id: "o3-mini-2025-01-31", tag: "snapshot" },
    { id: "o4-mini", tag: "raciocínio" },
    { id: "o4-mini-2025-04-16", tag: "snapshot" },
    { id: "o1", tag: "raciocínio" },
    { id: "o1-2024-12-17", tag: "snapshot" },
    { id: "o1-pro", tag: "raciocínio" },
    { id: "o1-pro-2025-03-19", tag: "snapshot" },
    { id: "o1-mini", tag: "raciocínio (deprec.)" },
    // --- GPT-4 (legado) ---
    { id: "gpt-4", tag: "legado" },
    { id: "gpt-4-0613", tag: "deprec." },
    { id: "gpt-4-turbo", tag: "legado" },
    { id: "gpt-4-turbo-2024-04-09", tag: "snapshot" },
    { id: "gpt-4-1106-preview", tag: "deprec." },
    { id: "gpt-4-0125-preview", tag: "legado" },
    { id: "gpt-4-32k", tag: "legado" },
    { id: "gpt-4-vision-preview", tag: "retirado" },
    // --- GPT-3.5 (legado) ---
    { id: "gpt-3.5-turbo", tag: "legado" },
    { id: "gpt-3.5-turbo-0125", tag: "deprec." },
    { id: "gpt-3.5-turbo-1106", tag: "legado" },
    { id: "gpt-3.5-turbo-16k", tag: "legado" },
  ],
  anthropic: [
    { id: "claude-opus-4-1", tag: "topo" },
    { id: "claude-sonnet-4-5", tag: "equilibrado" },
    { id: "claude-3-7-sonnet-latest", tag: "híbrido" },
    { id: "claude-3-5-sonnet-latest", tag: "forte" },
    { id: "claude-3-5-haiku-latest", tag: "rápido" },
    { id: "claude-3-opus-latest", tag: "legado" },
    { id: "claude-3-haiku-20240307", tag: "legado" },
  ],
  gemini: [
    { id: "gemini-2.5-pro", tag: "topo" },
    { id: "gemini-2.5-flash", tag: "rápido" },
    { id: "gemini-2.0-flash", tag: "rápido" },
    { id: "gemini-2.0-flash-lite", tag: "ultra rápido" },
    { id: "gemini-1.5-pro", tag: "legado" },
    { id: "gemini-1.5-flash", tag: "legado" },
    { id: "gemini-1.5-flash-8b", tag: "legado" },
  ],
  compativel: [
    { id: "meta-llama/llama-3.3-70b-instruct", tag: "llama" },
    { id: "meta-llama/llama-3.1-8b-instruct", tag: "llama" },
    { id: "deepseek/deepseek-chat", tag: "deepseek" },
    { id: "deepseek/deepseek-r1", tag: "raciocínio" },
    { id: "mistralai/mistral-large", tag: "mistral" },
    { id: "mistralai/mistral-7b-instruct", tag: "mistral" },
    { id: "qwen/qwen-2.5-72b-instruct", tag: "qwen" },
    { id: "google/gemma-2-9b-it", tag: "gemma" },
    { id: "x-ai/grok-2", tag: "grok" },
  ],
};

let state = {
  config: null,
  sessionId: null,
  sending: false,
  sessionExists: false, // true quando a conversa atual já tem settings/mensagens salvas
};

// modelos buscados ao vivo na API (cache por provedor, durante a sessão)
const liveModels = {}; // { provider: [{id, tag}] }
const modelSource = {}; // { provider: "loading" | "api" | "fallback" }
const modelErr = {}; // { provider: "mensagem de erro" }

/* ----------------------------- CONFIG ----------------------------- */
async function loadConfig() {
  const cfg = await api("/api/config");
  state.config = cfg;

  $("provider").value = cfg.provider || "openai";
  $("model").value = cfg.model || "";
  $("systemPrompt").value = cfg.system_prompt || "";
  $("temperature").value = cfg.temperature ?? 0.7;
  $("tempVal").textContent = cfg.temperature ?? 0.7;
  $("contextWindow").value = cfg.context_window ?? 20;
  $("compativelBaseUrl").value = cfg.compativel_base_url || "";

  // indicadores de chave configurada
  const set = cfg.api_keys_set || {};
  ["openai", "anthropic", "gemini", "compativel"].forEach((p) => {
    $("dot-" + p).classList.toggle("on", !!set[p]);
    $("key-" + p).placeholder = set[p] ? "•••• (salva) — digite p/ trocar" : $("key-" + p).placeholder;
  });

  // Supabase / banco de dados
  const sb = cfg.supabase || {};
  const sbSet = cfg.supabase_set || {};
  $("supabaseUrl").value = sb.url || "";
  $("dot-supabase-url").classList.toggle("on", !!sbSet.url);
  $("dot-supabase-key").classList.toggle("on", !!sbSet.service_key);
  if (sbSet.service_key) $("supabaseKey").placeholder = "•••• (salva) — digite p/ trocar";
  renderStorage(cfg.storage, cfg.storage_warning);

  renderTools(cfg.tools || []);
  updateModelSuggestions();
  toggleCompativel();
  updateChatHeader();
}

function renderStorage(storage, warning) {
  const badge = $("storageBadge");
  const isSupa = storage === "supabase";
  badge.textContent = isSupa ? "Supabase" : "SQLite (local)";
  badge.classList.toggle("on", isSupa);
  $("storageWarn").textContent = warning ? "⚠️ Supabase indisponível, usando SQLite: " + warning : "";
}

// settings "por conversa" lidas do painel
function collectSettings() {
  return {
    provider: $("provider").value,
    model: $("model").value.trim(),
    system_prompt: $("systemPrompt").value,
    temperature: parseFloat($("temperature").value),
    context_window: parseInt($("contextWindow").value, 10) || 0,
    tools: collectTools(),
  };
}

// aplica no painel as settings salvas de uma conversa
function applySettings(s) {
  if (!s) return;
  if (s.provider) $("provider").value = s.provider;
  $("model").value = s.model || "";
  if (s.system_prompt != null) $("systemPrompt").value = s.system_prompt;
  if (s.temperature != null) { $("temperature").value = s.temperature; $("tempVal").textContent = s.temperature; }
  if (s.context_window != null) $("contextWindow").value = s.context_window;
  if (Array.isArray(s.tools)) renderTools(s.tools);
  toggleCompativel();
  updateModelSuggestions();
  updateModelHint();
}

/* ----------------- Combobox de modelos (filtravel) ----------------- */
function currentModels() {
  const p = $("provider").value;
  const local = MODELS[p] || [];
  const live = liveModels[p];
  if (!live) return local;
  // une: modelos da API (mais recentes primeiro) + os curados que a API não retornou
  const ids = new Set(live.map((m) => m.id));
  const extras = local.filter((m) => !ids.has(m.id));
  return live.concat(extras);
}

// Busca a lista de modelos ao vivo na API do provedor (uma vez por sessão).
async function ensureModels(provider) {
  if (liveModels[provider] || modelSource[provider] === "loading") return;
  modelSource[provider] = "loading";
  updateModelCount();
  try {
    const data = await api("/api/models?provider=" + encodeURIComponent(provider));
    if (data.models && data.models.length) {
      liveModels[provider] = data.models;
      modelSource[provider] = "api";
    } else {
      modelSource[provider] = "fallback";
      modelErr[provider] = data.error || "";
    }
  } catch (e) {
    modelSource[provider] = "fallback";
    modelErr[provider] = e.message;
  }
  // re-renderiza só se ainda estamos nesse provedor
  if ($("provider").value === provider) {
    updateModelCount();
    if (!$("modelList").classList.contains("hidden")) renderModelList();
  }
}

function updateModelCount() {
  const p = $("provider").value;
  const n = currentModels().length;
  const src = modelSource[p];
  let label;
  if (src === "loading") label = "(buscando na API…)";
  else if (src === "api") label = `(${n} da API)`;
  else label = `(${n} — lista local)`;
  $("modelCount").textContent = label;
}

function renderModelList(filter = "") {
  const list = $("modelList");
  const f = filter.trim().toLowerCase();
  const all = currentModels();
  const items = f ? all.filter((m) => m.id.toLowerCase().includes(f)) : all;
  const selected = $("model").value.trim();

  list.innerHTML = "";

  const p = $("provider").value;
  if (modelSource[p] === "loading") {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "buscando modelos na API…";
    list.appendChild(li);
  } else if (modelSource[p] === "fallback" && modelErr[p]) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "API indisponível — usando lista local";
    li.title = modelErr[p];
    list.appendChild(li);
  }

  items.forEach((m) => {
    const li = document.createElement("li");
    if (m.id === selected) li.classList.add("is-selected");
    li.innerHTML = `<span>${escapeHtml(m.id)}</span><span class="tag">${escapeHtml(m.tag || "")}</span>`;
    li.onmousedown = (e) => { e.preventDefault(); chooseModel(m.id); };
    list.appendChild(li);
  });

  if (!list.children.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Nenhum modelo encontrado";
    list.appendChild(li);
  }

  updateModelCount();
}

function openModelList() {
  ensureModels($("provider").value);
  renderModelList();
  $("modelList").classList.remove("hidden");
}
function closeModelList() { $("modelList").classList.add("hidden"); }
function chooseModel(id) {
  $("model").value = id;
  closeModelList();
  updateModelCount();
  updateModelHint();
}

// Modelos "pro"/raciocinio sao lentos (30-50s+). Avisa o usuario ao selecionar.
function isSlowModel(id) {
  const m = (id || "").toLowerCase();
  return /(^|[-/])(o1|o3)-pro/.test(m) || /-pro\b/.test(m) || m.endsWith("-pro");
}
function updateModelHint() {
  const hint = $("modelHint");
  if (!hint) return;
  const id = $("model").value.trim();
  if ($("provider").value === "openai" && isSlowModel(id)) {
    hint.textContent =
      "⏳ Modelo 'pro' (raciocínio): respostas levam ~30–50s, ainda mais ao acionar tools. " +
      "Para testes rápidos prefira gpt-5.5 (chat).";
    hint.classList.remove("hidden");
  } else {
    hint.textContent = "";
    hint.classList.add("hidden");
  }
}

// dispara a busca ao vivo e atualiza o contador/lista
function updateModelSuggestions() {
  ensureModels($("provider").value);
  updateModelCount();
  if (!$("modelList").classList.contains("hidden")) renderModelList();
  updateModelHint();
}

function toggleCompativel() {
  $("compativelBox").classList.toggle("hidden", $("provider").value !== "compativel");
}

function renderTools(tools) {
  const box = $("toolsList");
  box.innerHTML = "";
  tools.forEach((t) => addToolRow(t.name, t.description));
}

function addToolRow(name = "", desc = "") {
  const box = $("toolsList");
  const div = document.createElement("div");
  div.className = "tool-item";
  div.innerHTML = `
    <input class="tool-name" placeholder="nome_da_tool" value="${escapeAttr(name)}" />
    <input class="tool-desc" placeholder="o que ela faz" value="${escapeAttr(desc)}" />
    <button title="Remover">✕</button>`;
  div.querySelector("button").onclick = () => div.remove();
  box.appendChild(div);
}

function collectTools() {
  return [...document.querySelectorAll(".tool-item")]
    .map((d) => ({
      name: d.querySelector(".tool-name").value.trim(),
      description: d.querySelector(".tool-desc").value.trim(),
    }))
    .filter((t) => t.name);
}

async function saveConfig() {
  const payload = {
    // defaults globais (usados em conversas novas) + globais de verdade
    provider: $("provider").value,
    model: $("model").value.trim(),
    system_prompt: $("systemPrompt").value,
    temperature: parseFloat($("temperature").value),
    context_window: parseInt($("contextWindow").value, 10) || 0,
    compativel_base_url: $("compativelBaseUrl").value.trim(),
    tools: collectTools(),
    api_keys: {},
    supabase: {},
  };
  // so manda chave se o usuario digitou algo novo (evita sobrescrever com mascara)
  ["openai", "anthropic", "gemini", "compativel"].forEach((p) => {
    const v = $("key-" + p).value.trim();
    if (v && v !== "********") payload.api_keys[p] = v;
  });
  // Supabase: URL sempre; key so se digitada
  payload.supabase.url = $("supabaseUrl").value.trim();
  const sk = $("supabaseKey").value.trim();
  if (sk && sk !== "********") payload.supabase.service_key = sk;

  const status = $("saveStatus");
  if (!payload.model) {
    status.textContent = "⚠️ Selecione um modelo antes de salvar.";
    openModelList();
    return;
  }
  status.textContent = "Salvando...";
  const cfg = await api("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  state.config = cfg;
  ["openai", "anthropic", "gemini", "compativel"].forEach((p) => $("key-" + p).value = "");
  $("supabaseKey").value = "";
  // invalida o cache de modelos (key/base url podem ter mudado) p/ re-buscar ao vivo
  Object.keys(liveModels).forEach((k) => delete liveModels[k]);
  Object.keys(modelSource).forEach((k) => delete modelSource[k]);
  Object.keys(modelErr).forEach((k) => delete modelErr[k]);

  // se a conversa atual já existe, salva as settings DELA também
  if (state.sessionExists && state.sessionId) {
    await api("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: state.sessionId, settings: collectSettings() }),
    });
  }

  await loadConfig();
  status.textContent = "✓ Salvo!";
  setTimeout(() => (status.textContent = ""), 2000);
}

/* ----------------------------- SESSIONS ----------------------------- */
async function loadSessions() {
  const { sessions } = await api("/api/sessions");
  const ul = $("sessionList");
  ul.innerHTML = "";
  if (!sessions.length) {
    ul.innerHTML = `<li class="muted" style="cursor:default">Nenhuma conversa ainda.</li>`;
  }
  sessions.forEach((s) => {
    const li = document.createElement("li");
    if (s.session_id === state.sessionId) li.classList.add("active");
    li.innerHTML = `
      <div class="s-title">${escapeHtml(s.title || "Conversa")}</div>
      <div class="s-meta">${s.msg_count} msgs · ${fmtTime(s.updated_at)}</div>`;
    li.onclick = () => openSession(s.session_id);
    ul.appendChild(li);
  });
}

function newChat() {
  state.sessionId = "sess-" + Date.now();
  state.sessionExists = false; // ainda não salva; usa os defaults do painel
  $("messages").innerHTML = "";
  showEmptyState();
  loadSessions();
  updateChatHeader();
  $("input").focus();
}

async function openSession(id) {
  state.sessionId = id;
  state.sessionExists = true;
  const { messages, settings } = await api("/api/messages/" + encodeURIComponent(id));
  applySettings(settings); // restaura provider/modelo/prompt/temperature/tools da conversa
  const box = $("messages");
  box.innerHTML = "";
  messages.forEach((m) => {
    if (m.type === "human") addBubble(m.content, "out", m.created_at);
    else if (m.type === "ai") {
      const acts = (m.extra && m.extra.tool_activations) || [];
      acts.forEach((a) => addToolNotice(a));
      addAiBubble(m.content, m.created_at, m.extra);
    } else if (m.type === "tool") {
      // ja exibido via tool_activations da msg de IA; ignora aqui
    }
  });
  scrollDown();
  loadSessions();
  updateChatHeader();
}

/* ----------------------------- CHAT ----------------------------- */
function updateChatHeader() {
  const c = state.config || {};
  $("chatTitle").textContent = "Assistente";
  $("chatSub").textContent = `${(c.provider || "?")} · ${(c.model || "sem modelo")}`;
}

function showEmptyState() {
  $("messages").innerHTML = `
    <div class="empty-state">
      <h3>👋 Comece a testar seu prompt</h3>
      <p>As mensagens ficam salvas na memória (SQLite/Postgres simulado) e
      a IA recebe as anteriores como contexto. Se o modelo acionar uma tool,
      o sistema avisa aqui no chat.</p>
    </div>`;
}

function addBubble(text, dir, ts) {
  removeEmptyState();
  const div = document.createElement("div");
  div.className = "bubble " + dir;
  div.innerHTML = `${escapeHtml(text)}<span class="time">${fmtTime(ts)}</span>`;
  $("messages").appendChild(div);
  scrollDown();
  return div;
}

// balão da IA com selo discreto do modelo/provider que gerou a resposta
function addAiBubble(text, ts, extra) {
  removeEmptyState();
  const model = extra && extra.model;
  const prov = extra && extra.provider;
  const badge = model
    ? `<span class="model-badge">${escapeHtml((prov ? prov + " · " : "") + model)}</span>`
    : "";
  const div = document.createElement("div");
  div.className = "bubble in";
  div.innerHTML = `${badge}${escapeHtml(text)}<span class="time">${fmtTime(ts)}</span>`;
  $("messages").appendChild(div);
  scrollDown();
  return div;
}

function addNotice(text, cls = "") {
  removeEmptyState();
  const div = document.createElement("div");
  div.className = "notice " + cls;
  div.innerHTML = text;
  $("messages").appendChild(div);
  scrollDown();
}

function addToolNotice(act) {
  const args = act.arguments && Object.keys(act.arguments).length
    ? `<span class="tool-args">args: ${escapeHtml(JSON.stringify(act.arguments))}</span>` : "";
  addNotice(`🔧 Tool acionada pelo prompt: <b>${escapeHtml(act.name)}</b>${args}`);
}

function addTyping() {
  const div = document.createElement("div");
  div.className = "typing";
  div.id = "typing";
  div.textContent = "digitando…";
  $("messages").appendChild(div);
  scrollDown();
}
function removeTyping() { const t = $("typing"); if (t) t.remove(); }

async function send() {
  const input = $("input");
  const text = input.value.trim();
  if (!text || state.sending) return;
  if (!state.sessionId) state.sessionId = "sess-" + Date.now();

  state.sending = true;
  $("send").disabled = true;
  addBubble(text, "out", Date.now() / 1000);
  input.value = "";
  input.style.height = "auto";
  addTyping();

  let res;
  try {
    res = await api("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: state.sessionId,
        message: text,
        settings: collectSettings(), // config DESTA conversa
      }),
    });
  } catch (e) {
    res = { error: "Falha de rede: " + e.message };
  }
  removeTyping();

  if (res.error) {
    addNotice("⚠️ " + escapeHtml(res.error), "err");
  } else {
    state.sessionId = res.session_id;
    state.sessionExists = true;
    (res.tool_activations || []).forEach(addToolNotice);
    addAiBubble(res.reply || "(resposta vazia)", Date.now() / 1000, {
      model: res.model,
      provider: res.provider,
    });
    if (res.storage) renderStorage(res.storage, "");
  }

  state.sending = false;
  $("send").disabled = false;
  loadSessions();
  input.focus();
}

async function clearMemory() {
  if (!state.sessionId) return;
  if (!confirm("Limpar a memória desta conversa? A IA perde o contexto anterior.")) return;
  await api("/api/clear", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: state.sessionId }),
  });
  $("messages").innerHTML = "";
  showEmptyState();
  addNotice("🧹 Memória limpa.", "ctx");
  loadSessions();
}

/* ----------------------------- helpers ----------------------------- */
function scrollDown() { const m = $("messages"); m.scrollTop = m.scrollHeight; }
function removeEmptyState() { const e = document.querySelector(".empty-state"); if (e) e.remove(); }
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, "&quot;"); }
function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/* ----------------------------- eventos ----------------------------- */
$("provider").onchange = () => {
  $("model").value = ""; // limpa o modelo: precisa escolher um do novo provedor
  updateModelSuggestions();
  toggleCompativel();
  openModelList();
};

// combobox de modelo
// campo somente-seleção: abre a lista ao focar/clicar; sem digitação livre
$("model").addEventListener("focus", openModelList);
$("model").addEventListener("click", openModelList);
$("model").addEventListener("keydown", (e) => { if (e.key === "Escape") closeModelList(); else e.preventDefault(); });
$("modelToggle").addEventListener("click", () => {
  const hidden = $("modelList").classList.contains("hidden");
  if (hidden) { $("model").focus(); openModelList(); } else { closeModelList(); }
});
document.addEventListener("click", (e) => {
  if (!$("modelCombo").contains(e.target)) closeModelList();
});
$("temperature").oninput = (e) => ($("tempVal").textContent = e.target.value);
$("saveConfig").onclick = saveConfig;
$("addTool").onclick = () => addToolRow();
$("newChat").onclick = newChat;
$("clearMemory").onclick = clearMemory;
$("send").onclick = send;
$("toggleConfig").onclick = () => document.querySelector(".app").classList.toggle("config-hidden");

$("input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
});
$("input").addEventListener("input", (e) => {
  e.target.style.height = "auto";
  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
});

/* ----------------------------- boot ----------------------------- */
(async function init() {
  await loadConfig();
  await loadSessions();
  newChat();
})();
