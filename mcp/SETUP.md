# HUS Dashboard — MCP Server Setup

Connect Claude Desktop or Claude Code (CLI) to the HUS dashboard so you can
say things like _"mark the checkout audit done"_ or _"what's today's briefing?"_
and have Claude read and write the live dashboard data.

---

## 1 · Install dependencies

```bash
cd ~/hus-dashboard/mcp
npm install
```

---

## 2 · Connect to Claude Desktop (Mac)

Claude Desktop reads its MCP config from:

```
~/Library/Application Support/Claude/claude_desktop_config.json
```

Open or create that file and add the `hus-dashboard` entry:

```json
{
  "mcpServers": {
    "hus-dashboard": {
      "command": "node",
      "args": ["/Users/tadahisakumagai/hus-dashboard/mcp/hus-server.js"]
    }
  }
}
```

> If the file already has other `mcpServers` entries, add the `"hus-dashboard"`
> key alongside them — do **not** replace the whole file.

Then **restart Claude Desktop** (quit completely, reopen).
You should see a 🔌 plug icon in the chat bar — click it to confirm `hus-dashboard` is listed.

---

## 2b · Connect to Claude Desktop (Windows)

Config file path:

```
%APPDATA%\Claude\claude_desktop_config.json
```

```json
{
  "mcpServers": {
    "hus-dashboard": {
      "command": "node",
      "args": ["C:\\Users\\YourName\\hus-dashboard\\mcp\\hus-server.js"]
    }
  }
}
```

---

## 3 · Connect to Claude Code (CLI)

Claude Code supports MCP via project or global settings.

**Project-level** (only active inside `~/hus-dashboard`):

```bash
# From inside ~/hus-dashboard
claude mcp add hus-dashboard node /Users/tadahisakumagai/hus-dashboard/mcp/hus-server.js
```

Or manually add to `~/hus-dashboard/.claude.json`:

```json
{
  "mcpServers": {
    "hus-dashboard": {
      "command": "node",
      "args": ["/Users/tadahisakumagai/hus-dashboard/mcp/hus-server.js"],
      "env": {
        "SUPABASE_URL": "https://xxxxxxxxxxxx.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "eyJhbGciOi..."
      }
    }
  }
}
```

> **Prod write-through (required for MCP writes to show on prod):**
> If `SUPABASE_URL` + a key (`SUPABASE_SERVICE_ROLE_KEY` _or_
> `SUPABASE_ANON_KEY`) are set in `env`, every MCP task write —
> `add_task`, `add_followup`, `complete_task` — upserts the **full task row**
> into the Supabase `tasks` table, which the deployed dashboard reads as its
> single source of truth (see `supabase/tasks_table.sql`). Without them, MCP
> writes only reach `tasks.json` and never appear on prod. The anon key works
> because RLS allows anon insert/update on `tasks`; a service role key also
> works (it bypasses RLS). Keep keys out of git.

**Global** (available in every Claude Code session):

```bash
claude mcp add --scope global hus-dashboard node /Users/tadahisakumagai/hus-dashboard/mcp/hus-server.js
```

---

## 3b · Supabase creds — the single-source-of-truth link (CRITICAL)

The dashboard (frontend) and the MCP server **must point at the same Supabase
project**, or they silently drift apart. Two separate places hold the creds:

| Where | Variables | Used by |
|---|---|---|
| **MCP server** — `~/.claude.json` (Code) / `claude_desktop_config.json` (Desktop), under the `hus-dashboard` → `env` block | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (anon key also works) | `loadTasks` / `loadProjects` / `buildRevenueSummary` reads **and** every MCP write mirror |
| **Vercel** — Project → Settings → Environment Variables | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | the deployed frontend's reads/writes |

Both must reference the **same project ref** (`zxiwqekpmkotqudlgksw`).

> **If the MCP creds go missing**, the read tools fall back to the frozen
> `src/data/*.json` seed — which lies the moment the live board has changed.
> To make that impossible to miss, `get_daily_briefing` / `ryoiki_tenkai` /
> `get_project_status` now **prepend a LOUD red banner**:
>
> ```
> 🔴🔴🔴 警告: SUPABASE creds未設定 (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) 🔴🔴🔴
>    → ローカルseed (src/data/*.json) を表示中。数字は信用するな。
> ```
>
> Banner present → creds are broken, fix the `env` block above and restart the
> MCP server. Banner absent → you are reading live Supabase.

Verify it registered:

```bash
claude mcp list
```

---

## 4 · Verify the server starts

```bash
cd ~/hus-dashboard/mcp
node hus-server.js
# Expected stderr: [HUS MCP] Server started — listening on stdio
# Then Ctrl-C
```

Or use the MCP Inspector for interactive testing:

```bash
npm run inspect
```

---

## 5 · Available tools

| Tool | What it does |
|---|---|
| `complete_task` | Marks a task done, stamps `completedAt`, advances PDCA → Act, recalculates project % |
| `update_project` | Updates any field on a project (status, owner, progress, dueDate…) |
| `add_checklist_item` | Adds an item to a named block inside a project; recalculates progress |
| `update_project_progress` | Auto-recalculates progress from checklist blocks or linked tasks |
| `add_followup` | Adds a ⚠️ follow-up to a project — appears in Task List and Alerts panel |
| `get_project_status` | Full summary: progress, tasks, blocks, follow-ups, KPI targets |
| `get_daily_briefing` | Morning brief: KPIs, overdue tasks, follow-ups, top 3 priorities, today's meetings |

---

## 6 · Example prompts (Claude Desktop / Claude Code)

```
What's today's briefing?

Mark "Checkout UX audit" as done in CVR Recovery.

CVR Recovery is now 40% done — update it.

Add a follow-up to Tuna Show: confirm chef availability for May event.

Add a checklist item to the FUNDINNO project under "Pitch Deck": record investor video. Status: pending.

Show me the full status of The Tuna Show.

Show all projects.
```

Each call writes directly to `src/data/*.json`.
If the Vite dev server is running (`npm run dev`), changes appear in the browser **instantly** — no reload needed.

---

## 7 · How the live-update loop works

```
You tell Claude ──► Claude calls MCP tool
                              │
                     hus-server.js writes JSON
                              │
                    Vite file-watcher detects change
                              │
             hus-data-hmr plugin sends WebSocket event
                              │
                AppContext.jsx updates React state
                              │
                   Dashboard re-renders instantly ✓
```

---

## 8 · Troubleshooting

| Symptom | Fix |
|---|---|
| Tool not showing in Claude | Restart Claude Desktop fully (Quit, not just close window) |
| `Cannot find module` error | Run `npm install` in `~/hus-dashboard/mcp/` |
| `ENOENT` reading JSON files | Make sure the `args` path in the config is the **absolute** path to `hus-server.js` |
| Changes not appearing in browser | Make sure `npm run dev` is running in `~/hus-dashboard/` |
| Multiple match error | Be more specific in the name, e.g. `"CVR Recovery"` not just `"CVR"` |
| 🔴 red SUPABASE banner on briefing | MCP creds missing/wrong — fix `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in the `hus-dashboard` `env` block (§3b), then restart the MCP server |
