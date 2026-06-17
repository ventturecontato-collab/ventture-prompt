"use strict";

const $ = (id) => document.getElementById(id);
// Helper robusto: nunca lança. Falha de rede / resposta não-JSON / erro HTTP
// viram { error: "..." }, para os callers tratarem sem travar a UI/boot.
const api = async (url, opts) => {
  try {
    const r = await fetch(url, opts);
    const text = await r.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return { error: `Resposta inválida do servidor (HTTP ${r.status}).` };
    }
    if (!r.ok && (!data || data.error === undefined)) {
      return { error: `Erro ${r.status} do servidor.` };
    }
    return data;
  } catch (e) {
    return { error: "Falha de rede: " + (e && e.message ? e.message : e) };
  }
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
  testing: false, // true enquanto o Agente Testador roda
  sessionExists: false, // true quando a conversa atual já tem settings/mensagens salvas
  currentReport: null, // relatório da conversa aberta (p/ reabrir no modal), se houver
  folders: [], // pastas (clientes) carregadas
  activeFolderId: null, // pasta ativa (novas conversas/testes entram nela)
  collapsed: new Set(), // pastas recolhidas na lista (e "__none__" p/ "Sem pasta")
  moveSessionId: null, // conversa sendo movida pelo modal
  editingFolderId: null, // pasta sendo editada pelo modal (null = criando)
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

  // config do Agente Testador
  const t = cfg.tester || {};
  $("testerProvider").value = t.provider || "";
  $("testerModel").value = t.model || "";
  $("testerMaxTurns").value = t.max_turns ?? 12;
  $("testerFocus").value = t.focus || "";

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
    context_window: readContextWindow(),
    tools: collectTools(),
  };
}

// lê o context_window do painel: vazio -> default (20); 0 explícito é respeitado
function readContextWindow() {
  const raw = $("contextWindow").value.trim();
  if (raw === "") return 20;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? 20 : Math.max(0, n);
}

// config do Agente Testador lida do painel
function collectTesterSettings() {
  return {
    provider: $("testerProvider").value,
    model: $("testerModel").value.trim(),
    max_turns: parseInt($("testerMaxTurns").value, 10) || 12,
    focus: $("testerFocus").value.trim(), // o que o usuário quer que seja testado
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
  const p = $("provider").value;

  // monta a lista inteira numa única string (1 reflow) com data-id para
  // event delegation — evita criar ~100 listeners e N appendChild em loop
  let header = "";
  if (modelSource[p] === "loading") {
    header = `<li class="empty">buscando modelos na API…</li>`;
  } else if (modelSource[p] === "fallback" && modelErr[p]) {
    header = `<li class="empty" title="${escapeAttr(modelErr[p])}">API indisponível — usando lista local</li>`;
  }

  const rows = items.map((m) =>
    `<li class="${m.id === selected ? "is-selected" : ""}" data-id="${escapeAttr(m.id)}">` +
    `<span>${escapeHtml(m.id)}</span><span class="tag">${escapeHtml(m.tag || "")}</span></li>`
  ).join("");

  const empty = (!items.length && !header) ? `<li class="empty">Nenhum modelo encontrado</li>` : "";
  list.innerHTML = header + rows + empty;

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

// atualiza contador/lista. NÃO busca modelos na API aqui (lazy): o fetch ao vivo
// só acontece ao abrir o dropdown (openModelList) ou trocar de provedor — evita
// chamada externa no boot e ao abrir cada conversa.
function updateModelSuggestions() {
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
    context_window: readContextWindow(),
    compativel_base_url: $("compativelBaseUrl").value.trim(),
    tools: collectTools(),
    tester: collectTesterSettings(),
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

/* ----------------------------- SESSIONS / PASTAS ----------------------------- */
async function loadSessions() {
  // busca pastas + conversas em paralelo e renderiza agrupado
  const [fData, sData] = await Promise.all([api("/api/folders"), api("/api/sessions")]);
  state.folders = fData.folders || [];
  const sessions = sData.sessions || [];
  const ul = $("sessionList");
  ul.innerHTML = "";

  // separa conversas por pasta
  const byFolder = {};
  const ungrouped = [];
  sessions.forEach((s) => {
    if (s.folder_id) (byFolder[s.folder_id] = byFolder[s.folder_id] || []).push(s);
    else ungrouped.push(s);
  });

  // pastas (já vêm ordenadas por nome do backend)
  state.folders.forEach((f) => {
    ul.appendChild(renderFolderHead(f));
    if (!state.collapsed.has(f.folder_id)) {
      (byFolder[f.folder_id] || []).forEach((s) => ul.appendChild(renderSessionItem(s, true)));
    }
  });

  // grupo "Sem pasta" (só se houver avulsas)
  if (ungrouped.length) {
    ul.appendChild(renderUngroupedHead(ungrouped.length));
    if (!state.collapsed.has("__none__")) {
      ungrouped.forEach((s) => ul.appendChild(renderSessionItem(s, false)));
    }
  }

  if (!sessions.length && !state.folders.length) {
    ul.innerHTML = `<li class="muted" style="cursor:default">Nenhuma conversa ainda.</li>`;
  }
}

// cabeçalho de uma pasta (recolhível + ativa + ações)
function renderFolderHead(f) {
  const li = document.createElement("li");
  li.className = "folder-head" + (f.folder_id === state.activeFolderId ? " active" : "");
  const caret = state.collapsed.has(f.folder_id) ? "▸" : "▾";
  li.innerHTML = `
    <span class="fold-caret">${caret}</span>
    <span class="fold-name">🗂️ ${escapeHtml(f.name)}</span>
    <span class="fold-count">${f.session_count}</span>
    <button class="fold-edit" title="Editar pasta">✎</button>
    <button class="fold-del" title="Excluir pasta">🗑️</button>`;
  // clicar no cabeçalho: torna a pasta ativa e a expande
  li.onclick = () => { setActiveFolder(f.folder_id); ensureExpanded(f.folder_id); loadSessions(); };
  // o caret apenas recolhe/expande (sem mexer na ativa)
  li.querySelector(".fold-caret").onclick = (e) => { e.stopPropagation(); toggleCollapse(f.folder_id); };
  li.querySelector(".fold-edit").onclick = (e) => { e.stopPropagation(); openFolderModal(f); };
  li.querySelector(".fold-del").onclick = (e) => { e.stopPropagation(); deleteFolder(f); };
  return li;
}

// cabeçalho do grupo "Sem pasta"
function renderUngroupedHead(count) {
  const li = document.createElement("li");
  li.className = "folder-head" + (state.activeFolderId === null ? " active" : "");
  const caret = state.collapsed.has("__none__") ? "▸" : "▾";
  li.innerHTML = `
    <span class="fold-caret">${caret}</span>
    <span class="fold-name muted-name">Sem pasta</span>
    <span class="fold-count">${count}</span>`;
  li.onclick = () => { setActiveFolder(null); state.collapsed.delete("__none__"); loadSessions(); };
  li.querySelector(".fold-caret").onclick = (e) => { e.stopPropagation(); toggleCollapse("__none__"); };
  return li;
}

// item de conversa (reutilizado em pasta e em "sem pasta")
function renderSessionItem(s, inFolder) {
  const li = document.createElement("li");
  li.className = "session-item" + (inFolder ? " in-folder" : "");
  if (s.session_id === state.sessionId) li.classList.add("active");
  li.innerHTML = `
    <div class="s-title">${escapeHtml(s.title || "Conversa")}</div>
    <div class="s-meta">${s.msg_count} msgs · ${fmtTime(s.updated_at)}</div>
    <button class="s-move" title="Mover para pasta">📁</button>
    <button class="s-del" title="Excluir conversa">🗑️</button>`;
  li.onclick = () => openSession(s.session_id);
  li.querySelector(".s-move").onclick = (e) => { e.stopPropagation(); openMoveModal(s.session_id); };
  li.querySelector(".s-del").onclick = (e) => { e.stopPropagation(); deleteSession(s.session_id); };
  return li;
}

function toggleCollapse(key) {
  if (state.collapsed.has(key)) state.collapsed.delete(key);
  else state.collapsed.add(key);
  loadSessions();
}
function ensureExpanded(key) { state.collapsed.delete(key); }

// define a pasta ativa (novas conversas/testes entram nela)
function setActiveFolder(folderId) {
  state.activeFolderId = folderId;
}

// exclui uma conversa (com confirmação) e atualiza a lista
async function deleteSession(id) {
  if (!confirm("Excluir esta conversa? Esta ação não pode ser desfeita.")) return;
  const res = await api("/api/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: id }),
  });
  if (res && res.error) { addNotice("⚠️ " + escapeHtml(res.error), "err"); return; }
  if (id === state.sessionId) newChat(); // excluiu a conversa aberta -> abre uma nova
  else loadSessions();
}

/* ------------- pastas: modal criar/editar, excluir, mover ------------- */
function folderById(id) { return state.folders.find((f) => f.folder_id === id) || null; }

// mensagem amigável quando o banco ainda não tem a tabela/coluna de pastas
function folderErrorMsg(err) {
  const e = String(err || "");
  if (/folders|folder_id|PGRST205|schema cache/i.test(e)) {
    return "As pastas/projetos ainda não foram ativados no banco de dados.\n\n" +
      "Rode uma vez o SQL do arquivo supabase_schema.sql no painel do Supabase " +
      "(SQL Editor) para criar a tabela 'folders' e a coluna 'folder_id'. " +
      "Depois recarregue a página (Ctrl+F5).";
  }
  return e;
}

function openFolderModal(folder) {
  state.editingFolderId = folder ? folder.folder_id : null;
  $("folderModalTitle").textContent = folder ? "🗂️ Editar pasta" : "🗂️ Nova pasta";
  $("folderName").value = folder ? (folder.name || "") : "";
  $("folderPrompt").value = folder ? (folder.prompt || "") : "";
  $("folderModal").classList.remove("hidden");
  $("folderName").focus();
}
function closeFolderModal() { $("folderModal").classList.add("hidden"); }

async function saveFolder() {
  const name = $("folderName").value.trim();
  if (!name) { $("folderName").focus(); return; }
  const editing = state.editingFolderId;
  const payload = { name, prompt: $("folderPrompt").value };
  if (editing) payload.folder_id = editing;
  const res = await api("/api/folder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res && res.error) { alert(folderErrorMsg(res.error)); return; }
  // ao criar uma nova pasta, já a deixa ativa
  if (!editing && res.folder) setActiveFolder(res.folder.folder_id);
  closeFolderModal();
  await loadSessions();
  // se a tela de Projetos estiver aberta, reflete lá (e abre o projeto recém-criado)
  if (projectsOpen()) {
    await refreshProjects();
    if (!editing && res.folder) openProject(res.folder.folder_id);
  }
}

async function deleteFolder(f) {
  if (!confirm(`Excluir a pasta "${f.name}"? As conversas dela NÃO são apagadas — voltam para "Sem pasta".`)) return;
  const res = await api("/api/folder/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder_id: f.folder_id }),
  });
  if (res && res.error) { addNotice("⚠️ " + escapeHtml(res.error), "err"); return; }
  if (state.activeFolderId === f.folder_id) setActiveFolder(null);
  await loadSessions();
}

function openMoveModal(sessionId) {
  state.moveSessionId = sessionId;
  const sel = $("moveSelect");
  sel.innerHTML = `<option value="">— Sem pasta —</option>` +
    state.folders.map((f) => `<option value="${escapeAttr(f.folder_id)}">${escapeHtml(f.name)}</option>`).join("");
  $("moveModal").classList.remove("hidden");
}
function closeMoveModal() { $("moveModal").classList.add("hidden"); }

async function confirmMove() {
  const folderId = $("moveSelect").value || null;
  const res = await api("/api/session/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: state.moveSessionId, folder_id: folderId }),
  });
  if (res && res.error) { addNotice("⚠️ " + escapeHtml(res.error), "err"); return; }
  closeMoveModal();
  await loadSessions();
}

/* --------------------- TELA DE PROJETOS (estilo Claude) --------------------- */
const projectsOpen = () => !$("projectsOverlay").classList.contains("hidden");

async function openProjects() {
  $("projectsOverlay").classList.remove("hidden");
  showProjectsGrid();
  await refreshProjects();
}
function closeProjects() { $("projectsOverlay").classList.add("hidden"); }

function showProjectsGrid() {
  state.openProjectId = null;
  $("projectsGridView").classList.remove("hidden");
  $("projectDetailView").classList.add("hidden");
}

// busca pastas + conversas (cache) e re-renderiza a vista atual
async function refreshProjects() {
  const [fData, sData] = await Promise.all([api("/api/folders"), api("/api/sessions")]);
  state.folders = fData.folders || [];
  state._allSessions = sData.sessions || [];
  if (state.openProjectId) renderProjectDetail(state.openProjectId);
  else renderProjectsGrid();
}

function renderProjectsGrid() {
  const grid = $("projectsGrid");
  const q = ($("projectsSearch").value || "").trim().toLowerCase();
  let list = state.folders.slice();
  if (q) list = list.filter((f) => (f.name || "").toLowerCase().includes(q));
  if ($("projectsSort").value === "name")
    list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  else list.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));

  if (!list.length) {
    grid.innerHTML = `<div class="projects-empty">${q ? "Nenhum projeto encontrado." : "Nenhum projeto ainda. Crie o primeiro em “＋ Novo projeto”."}</div>`;
    return;
  }
  grid.innerHTML = list.map((f) => `
    <div class="project-card" data-id="${escapeAttr(f.folder_id)}">
      <div class="pc-name">${escapeHtml(f.name)}</div>
      <div class="pc-prompt">${escapeHtml(f.prompt || "Sem instruções.")}</div>
      <div class="pc-meta"><span>${f.session_count} conversa(s)</span><span>Atualizado ${fmtAgo(f.updated_at)}</span></div>
    </div>`).join("");
}

function openProject(folderId) {
  state.openProjectId = folderId;
  $("projectsGridView").classList.add("hidden");
  $("projectDetailView").classList.remove("hidden");
  renderProjectDetail(folderId);
}

function renderProjectDetail(folderId) {
  const f = folderById(folderId);
  if (!f) { showProjectsGrid(); renderProjectsGrid(); return; }
  $("projectDetailName").textContent = f.name;
  $("projectPrompt").value = f.prompt || "";
  const convos = (state._allSessions || [])
    .filter((s) => s.folder_id === folderId)
    .sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
  $("projectConvoCount").textContent = `(${convos.length})`;
  const box = $("projectConvos");
  box.innerHTML = convos.length
    ? convos.map((s) => `
        <div class="pconvo" data-sid="${escapeAttr(s.session_id)}">
          <span class="pc-title">${escapeHtml(s.title || "Conversa")}</span>
          <span class="pc-sub">${s.msg_count} msgs · ${fmtAgo(s.updated_at)}</span>
        </div>`).join("")
    : `<div class="empty">Nenhuma conversa neste projeto ainda.</div>`;
}

async function saveProjectPrompt() {
  const id = state.openProjectId;
  if (!id) return;
  const res = await api("/api/folder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder_id: id, prompt: $("projectPrompt").value }),
  });
  const st = $("projectPromptStatus");
  if (res && res.error) { st.textContent = "⚠️ " + res.error; return; }
  st.textContent = "✓ Salvo";
  setTimeout(() => (st.textContent = ""), 1500);
  await refreshProjects();
  loadSessions(); // reflete na barra lateral tb
}

// tempo relativo ("há 7 dias", "há 2 h"); cai para data se muito antigo
function fmtAgo(ts) {
  if (!ts) return "";
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  const d = Math.floor(diff / 86400);
  if (d < 30) return `há ${d} dia${d > 1 ? "s" : ""}`;
  return new Date(ts * 1000).toLocaleDateString("pt-BR");
}

function newChat() {
  state.sessionId = "sess-" + Date.now();
  state.sessionExists = false; // ainda não salva; usa os defaults do painel
  state.currentReport = null;
  toggleReportButton();
  // conversa nova nasce na pasta ativa; pré-preenche o prompt do cliente (se houver)
  const f = folderById(state.activeFolderId);
  if (f && f.prompt) $("systemPrompt").value = f.prompt;
  $("messages").innerHTML = "";
  showEmptyState();
  loadSessions();
  updateChatHeader();
  $("input").focus();
}

async function openSession(id) {
  state.sessionId = id;
  state.sessionExists = true;
  const data = await api("/api/messages/" + encodeURIComponent(id));
  if (data.error) { addNotice("⚠️ " + escapeHtml(data.error), "err"); return; }
  const messages = data.messages || [];
  const settings = data.settings;
  applySettings(settings); // restaura provider/modelo/prompt/temperature/tools da conversa
  state.activeFolderId = (settings && settings.folder_id) || null; // herda a pasta da conversa

  // se esta conversa for um teste, ela guarda uma mensagem com o relatório
  const repMsg = messages.find((m) => m.extra && m.extra.kind === "tester_report");
  state.currentReport = repMsg ? {
    report: repMsg.extra.report || {},
    turns: repMsg.extra.turns || 0,
    // reconstrói a transcrição a partir dos balões (ignora a msg de relatório)
    transcript: messages
      .filter((m) => !(m.extra && m.extra.kind === "tester_report"))
      .filter((m) => m.type === "human" || m.type === "ai")
      .map((m) => ({ role: m.type === "human" ? "user" : "assistant", content: m.content })),
  } : null;
  toggleReportButton();

  const box = $("messages");
  box.innerHTML = "";
  messages.forEach((m) => {
    if (m.extra && m.extra.kind === "tester_report") return; // não é balão; abre no modal
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

  const wasNew = !state.sessionExists; // só recarrega a lista se criar conversa nova
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
        // só atribui pasta ao CRIAR a conversa (evita mover conversa existente)
        folder_id: wasNew ? state.activeFolderId : null,
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
  // evita rebuild da barra lateral a cada mensagem; só atualiza ao criar conversa nova
  if (wasNew && !res.error) loadSessions();
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

/* --------------------- AGENTE TESTADOR (modal) --------------------- */
function openTesterModal() { $("testerModal").classList.remove("hidden"); }
function closeTesterModal() { $("testerModal").classList.add("hidden"); }

// popup de "o que testar?" — abre ao clicar no 🤖, antes de rodar o teste
function openFocusPrompt() {
  if (state.testing) return;
  if (!$("model").value.trim()) {
    openModelList();
    $("saveStatus").textContent = "⚠️ Selecione um modelo antes de testar.";
    return;
  }
  $("focusInput").value = $("testerFocus").value || ""; // pré-preenche com o último foco
  $("focusModal").classList.remove("hidden");
  $("focusInput").focus();
}
function closeFocusPrompt() { $("focusModal").classList.add("hidden"); }

// confirma o foco digitado e dispara o teste
function confirmFocusAndRun() {
  // sincroniza com o campo da config (vai junto no collectTesterSettings e persiste se salvar)
  $("testerFocus").value = $("focusInput").value.trim();
  closeFocusPrompt();
  runTester();
}

// dispara o teste automatico usando a config DESTA conversa (a IA-alvo)
async function runTester() {
  if (state.testing) return;
  const settings = collectSettings();
  if (!settings.model) {
    openModelList();
    $("saveStatus").textContent = "⚠️ Selecione um modelo antes de testar.";
    return;
  }

  state.testing = true;
  $("runTester").disabled = true;
  openTesterModal();
  $("testerBody").innerHTML = `
    <div class="tester-running">
      <div class="spinner"></div>
      <p>O agente testador está conversando com a IA-alvo e montando o relatório…</p>
      <p class="muted">Isso pode levar de alguns segundos a alguns minutos, conforme o nº de turnos e o modelo.</p>
    </div>`;

  let res;
  try {
    res = await api("/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // envia tb a config do testador (inclui o "foco") e a pasta ativa
      body: JSON.stringify({ session_id: state.sessionId, settings, tester: collectTesterSettings(), folder_id: state.activeFolderId }),
    });
  } catch (e) {
    res = { error: "Falha de rede: " + e.message };
  }

  if (res.error) {
    $("testerBody").innerHTML =
      `<div class="notice err" style="max-width:none">⚠️ ${escapeHtml(res.error)}</div>`;
  } else {
    renderReport(res.report || {}, res.transcript || [], res.turns || 0);
    if (res.save_error) {
      const w = document.createElement("div");
      w.className = "notice err";
      w.style.maxWidth = "none";
      w.textContent = "⚠️ " + res.save_error + " (o relatório acima não foi salvo na lista).";
      $("testerBody").prepend(w);
    }
    // a conversa de teste foi salva como sessão: aparece na lista e abre com o botão 📊
    await loadSessions();
    if (res.session_id && !res.save_error) await openSession(res.session_id);
  }

  state.testing = false;
  $("runTester").disabled = false;
}

// mostra/oculta o botão "Ver relatório" conforme a conversa aberta tenha um
function toggleReportButton() {
  $("openReport").classList.toggle("hidden", !state.currentReport);
}

// reabre, no modal, o relatório salvo da conversa atual
function openReport() {
  if (!state.currentReport) return;
  const r = state.currentReport;
  openTesterModal();
  renderReport(r.report || {}, r.transcript || [], r.turns || 0);
}

// monta o relatorio legivel dentro do modal
function renderReport(report, transcript, turns) {
  const nota = report.nota;
  const notaTxt = (nota === null || nota === undefined) ? "—" : nota;
  const notaCls = (typeof nota === "number")
    ? (nota >= 7 ? "good" : nota >= 4 ? "mid" : "bad") : "mid";

  const list = (arr) => (Array.isArray(arr) && arr.length)
    ? `<ul>${arr.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`
    : `<p class="muted">—</p>`;

  const examples = (Array.isArray(report.exemplos) && report.exemplos.length)
    ? report.exemplos.map((ex) => `
        <div class="report-example">
          ${ex.observacao ? `<div class="ex-obs">${escapeHtml(ex.observacao)}</div>` : ""}
          <div class="ex-line"><span class="ex-who user">Usuário</span> ${escapeHtml(ex.usuario || "")}</div>
          <div class="ex-line"><span class="ex-who ia">IA</span> ${escapeHtml(ex.ia || "")}</div>
        </div>`).join("")
    : `<p class="muted">—</p>`;

  const convo = transcript.map((m) => {
    const dir = m.role === "user" ? "out" : "in";
    const who = m.role === "user" ? "Usuário (testador)" : "IA-alvo";
    return `<div class="bubble ${dir}"><span class="ex-who ${m.role === "user" ? "user" : "ia"}">${who}</span>${escapeHtml(m.content)}</div>`;
  }).join("");

  $("testerBody").innerHTML = `
    <div class="report-top">
      <div class="report-score ${notaCls}">
        <span class="score-num">${escapeHtml(notaTxt)}</span>
        <span class="score-max">/10</span>
      </div>
      <div class="report-summary">
        <h3>Resumo geral</h3>
        <p>${escapeHtml(report.resumo || "—")}</p>
        <p class="muted">${turns} turno(s) de conversa simulada.</p>
      </div>
    </div>

    <div class="report-grid">
      <section class="card report-card">
        <h3>✅ Pontos fortes</h3>${list(report.pontos_fortes)}
      </section>
      <section class="card report-card">
        <h3>⚠️ Falhas / inconsistências</h3>${list(report.falhas)}
      </section>
    </div>

    <section class="card report-card">
      <h3>💡 Sugestões de melhoria no prompt</h3>${list(report.sugestoes)}
    </section>

    <section class="card report-card">
      <h3>🔎 Exemplos reais da conversa</h3>${examples}
    </section>

    <details class="report-transcript">
      <summary>Ver conversa simulada completa (${transcript.length} mensagens)</summary>
      <div class="transcript-box">${convo || '<p class="muted">—</p>'}</div>
    </details>`;
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
// um único listener delegado na lista (em vez de um por item)
$("modelList").addEventListener("mousedown", (e) => {
  const li = e.target.closest("li[data-id]");
  if (!li) return;
  e.preventDefault();
  chooseModel(li.dataset.id);
});
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

// tela de Projetos
$("openProjects").onclick = openProjects;
$("projectsClose").onclick = closeProjects;
$("projectDetailClose").onclick = closeProjects;
$("projectBack").onclick = () => { showProjectsGrid(); renderProjectsGrid(); };
$("projectsSearch").addEventListener("input", renderProjectsGrid);
$("projectsSort").addEventListener("change", renderProjectsGrid);
$("newProject").onclick = () => openFolderModal(null);
$("projectRename").onclick = () => openFolderModal(folderById(state.openProjectId));
$("projectDelete").onclick = async () => {
  const f = folderById(state.openProjectId);
  if (!f) return;
  await deleteFolder(f);
  showProjectsGrid();
  if (projectsOpen()) await refreshProjects();
};
$("projectPromptSave").onclick = saveProjectPrompt;
$("projectNewChat").onclick = () => { setActiveFolder(state.openProjectId); closeProjects(); newChat(); };
$("projectRunTest").onclick = () => { setActiveFolder(state.openProjectId); closeProjects(); openFocusPrompt(); };
$("projectsGrid").addEventListener("click", (e) => {
  const card = e.target.closest(".project-card[data-id]");
  if (card) openProject(card.dataset.id);
});
$("projectConvos").addEventListener("click", (e) => {
  const row = e.target.closest(".pconvo[data-sid]");
  if (row) { closeProjects(); openSession(row.dataset.sid); }
});

// modal de pasta (criar/editar)
$("folderSave").onclick = saveFolder;
$("folderCancel").onclick = closeFolderModal;
$("folderCancel2").onclick = closeFolderModal;
$("folderModal").addEventListener("click", (e) => { if (e.target === $("folderModal")) closeFolderModal(); });
// modal de mover conversa
$("moveConfirm").onclick = confirmMove;
$("moveCancel").onclick = closeMoveModal;
$("moveCancel2").onclick = closeMoveModal;
$("moveModal").addEventListener("click", (e) => { if (e.target === $("moveModal")) closeMoveModal(); });
$("runTester").onclick = openFocusPrompt; // 🤖 abre o popup "o que testar?"
$("openReport").onclick = openReport;
$("testerClose").onclick = closeTesterModal;
$("testerModal").addEventListener("click", (e) => {
  if (e.target === $("testerModal")) closeTesterModal(); // clique no backdrop fecha
});

// popup de foco do teste
$("focusRun").onclick = confirmFocusAndRun;
$("focusCancel").onclick = closeFocusPrompt;
$("focusCancel2").onclick = closeFocusPrompt;
$("focusModal").addEventListener("click", (e) => {
  if (e.target === $("focusModal")) closeFocusPrompt();
});
$("focusInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); confirmFocusAndRun(); }
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!$("folderModal").classList.contains("hidden")) closeFolderModal();
  else if (!$("moveModal").classList.contains("hidden")) closeMoveModal();
  else if (!$("focusModal").classList.contains("hidden")) closeFocusPrompt();
  else if (!$("testerModal").classList.contains("hidden")) closeTesterModal();
  else if (projectsOpen()) closeProjects();
});
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
