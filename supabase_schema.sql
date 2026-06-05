-- ============================================================
--  Sistema de Teste de Prompts - Esquema do Supabase
--  Rode este SQL no painel do Supabase: SQL Editor -> New query -> Run
-- ============================================================

-- Tabela de conversas (cada conversa guarda a propria configuracao)
create table if not exists sessions (
  session_id     text primary key,
  title          text,
  provider       text,
  model          text,
  system_prompt  text,
  temperature    real,
  context_window int,
  tools          jsonb default '[]'::jsonb,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Tabela de mensagens (memoria estilo "Postgres Chat Memory" do n8n/LangChain)
create table if not exists n8n_chat_histories (
  id          bigint generated always as identity primary key,
  session_id  text not null references sessions(session_id) on delete cascade,
  message     jsonb not null,          -- {"type":"human|ai|tool","data":{...}}
  created_at  timestamptz default now()
);

create index if not exists idx_chat_session on n8n_chat_histories(session_id);

-- Observacao sobre seguranca:
-- O servidor usa a chave "service_role", que IGNORA o Row Level Security (RLS).
-- Como o servidor roda local (localhost) e a chave nunca vai ao navegador,
-- pode deixar o RLS no padrao. Se quiser, habilite RLS sem criar policies
-- (a service_role continua funcionando):
-- alter table sessions enable row level security;
-- alter table n8n_chat_histories enable row level security;
