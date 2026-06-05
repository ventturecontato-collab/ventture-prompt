# Sistema de Teste de Prompts

Um "playground" local para testar prompts em diferentes modelos de IA, com
visual estilo **WhatsApp**, **memória de conversa** (simulando a *Postgres Chat
Memory* do n8n) e **alerta de ativação de tools**.

Feito **100% com a biblioteca padrão do Python** — não precisa instalar nada
(`pip install` não é necessário).

---

## ✨ O que ele faz

- **Prompt + Modelo**: defina o *system prompt*, escolha o provedor e o modelo.
- **API Keys por provedor**: OpenAI, Anthropic (Claude), Google Gemini e
  qualquer endpoint **OpenAI-compatível** (OpenRouter, Groq, LM Studio, etc.).
  As chaves ficam salvas localmente em `config.json`.
- **Chat estilo WhatsApp**: você de um lado (verde), a IA do outro. É só o
  visual — nada a ver com a API do WhatsApp.
- **Memória (Postgres simulado)**: cada conversa tem um `session_id`. As
  mensagens são guardadas em SQLite com o mesmo esquema da tabela
  `n8n_chat_histories` do n8n/LangChain, e as últimas *N* mensagens
  (*Context Window*) são reenviadas como contexto — é assim que a IA "lembra".
- **Tools ativáveis**: você define tools (nome + descrição). Elas **não
  executam nada de verdade** — quando o modelo decide acioná-las, o sistema
  mostra um aviso no chat: `🔧 Tool acionada pelo prompt: <nome>`.

---

## 🚀 Como rodar

Pré-requisito: **Python 3.x** (aqui foi testado com o lançador `py` no Windows).

```powershell
cd sistema-de-prompts
py server.py
```

Depois abra no navegador: **http://localhost:8000**

Para usar outra porta: `py server.py 9000`

---

## 🔑 Configurando

1. Abra o app, painel **⚙️ Configuração** (à esquerda).
2. Escolha o **provedor** e digite o **modelo**.
3. Cole a **API key** do provedor correspondente.
4. Ajuste o **prompt do sistema**, **temperature** e o **Context Window**.
5. (Opcional) edite as **tools**.
6. Clique em **💾 Salvar configuração**.

> As chaves nunca aparecem de volta no navegador — o servidor só informa se
> existe uma chave salva (bolinha verde) e mascara o valor.

---

## 🧠 Sobre a "memória do Postgres"

No n8n você usaria o nó **Postgres Chat Memory**, que grava cada mensagem numa
tabela e devolve as últimas N como contexto. Aqui reproduzimos exatamente essa
ideia, só que com **SQLite** (arquivo `memoria.db`, zero instalação):

```sql
-- esquema espelhado do n8n/LangChain
CREATE TABLE n8n_chat_histories (
  id          INTEGER PRIMARY KEY,
  session_id  TEXT NOT NULL,
  message     TEXT NOT NULL   -- JSON {"type":"human|ai|tool","data":{...}}
);
```

A memória tem **dois backends** (escolhidos automaticamente): **SQLite** (padrão,
zero instalação) ou **Supabase** (Postgres de verdade) — veja abaixo.

---

## 🗄️ Usando o Supabase (Postgres de verdade)

Em vez do SQLite local, você pode guardar a memória no seu **Supabase**. A
comunicação é pela **API REST (PostgREST)** sobre HTTPS — continua sem instalar
nada. A `service_role key` fica **só no servidor** (nunca vai ao navegador).

**Passo a passo:**
1. No painel do Supabase: **SQL Editor → New query**, cole o conteúdo de
   [`supabase_schema.sql`](supabase_schema.sql) e clique em **Run** (cria as
   tabelas `sessions` e `n8n_chat_histories`).
2. Pegue as credenciais em **Settings → API**: a **Project URL**
   (`https://xxxx.supabase.co`) e a **service_role key** (em *Project API keys*).
3. No app, painel **🗄️ Banco de dados**: cole a URL e a service_role key →
   **💾 Salvar configuração**.
4. **Reinicie** `py server.py`. No startup aparece `Memoria: SUPABASE` e o selo
   no app muda para **Supabase**.

Se as credenciais estiverem vazias ou o Supabase ficar indisponível, o sistema
**cai automaticamente no SQLite** — nada quebra. Para voltar ao SQLite, é só
limpar a URL/key e salvar.

> Migração: os dados antigos do SQLite não são copiados automaticamente para o
> Supabase. Conversas novas já vão direto para o backend ativo.

---

## 🧩 Configuração por conversa

Cada conversa guarda a **própria** configuração — provider, modelo,
*system prompt*, *temperature*, *context window* e *tools*. Ao **abrir** uma
conversa, o painel restaura essas configurações, e cada resposta da IA exibe um
selo com **o modelo/provedor que a gerou**. As **API keys** continuam globais
(são credenciais por provedor), e a config do painel serve de **padrão** para
conversas novas.

---

## 🔧 Como funciona a ativação de tool

1. As tools que você define são enviadas ao modelo como *function definitions*.
2. Se o prompt fizer o modelo **decidir chamar** uma tool, a API retorna um
   *tool call*.
3. O sistema **registra a ativação**, mostra o aviso no chat e devolve ao modelo
   um resultado **simulado** ("operação concluída") para ele finalizar a
   resposta — sem executar nenhuma função real.

---

## 📁 Estrutura

```
sistema-de-prompts/
├── server.py            # servidor HTTP + orquestração do chat
├── providers.py         # integração com OpenAI / Anthropic / Gemini / compatível
├── db.py                # fachada da memória (escolhe Supabase ou SQLite)
├── db_sqlite.py         # backend SQLite (estilo Postgres Chat Memory)
├── db_supabase.py       # backend Supabase via API REST (PostgREST)
├── supabase_schema.sql  # SQL para criar as tabelas no Supabase
├── config.py            # leitura/escrita de config.json (API keys + ajustes)
├── config.example.json  # exemplo de configuração
├── public/              # frontend (UI estilo WhatsApp)
│   ├── index.html
│   ├── style.css
│   └── app.js
├── memoria.db           # criado em runtime (SQLite; ignorado no git)
└── config.json          # criado ao salvar (ignorado no git — tem as chaves)
```
