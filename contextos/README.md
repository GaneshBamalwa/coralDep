# ContextOS

> **Retrieval-first personal intelligence dashboard powered by Coral's SQL runtime.**

ContextOS pulls fragmented workflow data — calendar, tasks, GitHub, Slack, Discord — into a single operational command center. No chat interface, no "Ask AI" box. Just a dense, beautiful dashboard that shows you exactly where your attention is going.

![ContextOS Dashboard](./docs/screenshot.png)

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Node.js + Express (Coral proxy) |
| Data layer | [Coral CLI](https://coral.so/docs) — SQL over live APIs |
| LLM synthesis | Anthropic Claude (`claude-sonnet-4-20250514`) |
| Discord source | Custom Coral HTTP source spec |

---

## Project Structure

```
contextos/
├── sources/
│   └── discord/
│       ├── manifest.yaml     # Coral custom source spec
│       └── README.md         # Discord setup guide
├── backend/
│   ├── index.js              # Express API server (port 3001)
│   ├── mockData.js           # Realistic mock data for MOCK_MODE
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Three-panel layout
│   │   ├── components/
│   │   │   ├── MorningBriefing.jsx
│   │   │   ├── FocusDebt.jsx
│   │   │   ├── UnfinishedLoops.jsx
│   │   │   ├── ContextTimeline.jsx
│   │   │   ├── SourceStatus.jsx
│   │   │   └── QueryConsole.jsx
│   │   ├── hooks/
│   │   │   └── useCoral.js
│   │   └── styles/
│   │       └── globals.css
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── .env.example
└── package.json              # Root workspace
```

---

## Prerequisites

1. **Node.js** ≥ 18
2. **npm** ≥ 9 (workspaces support)
3. **Coral CLI** installed and on your PATH — [Installation guide](https://coral.so/docs/install)
4. Coral sources added (see below)

> **No Coral? No problem.** Set `MOCK_MODE=true` in your `.env` to run the full dashboard with realistic fake data.

---

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/your-org/contextos.git
cd contextos
npm run install:all
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your values
```

Key variables:

```env
MOCK_MODE=true                  # true = no Coral needed
ANTHROPIC_API_KEY=sk-ant-...    # for Claude briefing synthesis
GITHUB_OWNER=your-org
GITHUB_REPO=your-repo
```

### 3. Run

```bash
npm run dev
```

- **Frontend**: http://localhost:5173  
- **Backend API**: http://localhost:3001

---

## Coral Source Setup

### Adding standard sources

```bash
coral source add github
coral source add slack
coral source add google_calendar
coral source add notion
```

### Adding the Discord custom source

```bash
# Copy the spec into your Coral workspace
# Linux/macOS:
cp -r sources/discord/ ~/.coral/workspaces/default/sources/discord/

# Windows (PowerShell):
Copy-Item -Recurse sources\discord\ "$env:USERPROFILE\.coral\workspaces\default\sources\discord\"

# Register it
coral source add --file sources/discord/manifest.yaml

# Set credentials
export DISCORD_BOT_TOKEN=your_bot_token
export DISCORD_GUILD_ID=your_server_id
```

See [`sources/discord/README.md`](./sources/discord/README.md) for detailed Discord bot setup, required permissions, and example queries.

### Verify sources

```bash
coral source list
coral sql "SELECT summary, start FROM google_calendar.events WHERE date(start) = current_date LIMIT 5"
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/query` | Run raw Coral SQL |
| `GET` | `/api/briefing` | Morning briefing via Claude + all sources |
| `GET` | `/api/focus-debt` | Planned vs completed tasks (7 days) |
| `GET` | `/api/unfinished-loops` | Work touched but never closed |
| `GET` | `/api/sources` | Connected source status |
| `GET` | `/api/health` | Health check |

---

## Dashboard Panels

| Panel | Description |
|---|---|
| **Today** (Focus Debt) | Bar chart of planned vs completed work. Focus Debt Score. |
| **Attention** (Unfinished Loops) | Items touched repeatedly but never closed — your attention sinkholes. |
| **Timeline** | Unified chronological activity stream across all sources, with per-source filters. |
| **Console** | Power-user raw SQL console with example query chips. |
| **Morning Briefing** *(always visible right panel)* | Urgent items, waiting-on-you queue, best focus window, today's calendar. |

---

## Design System

| Token | Value | Use |
|---|---|---|
| Background base | `#0a0a0f` | App background |
| Surface | `#0f0f1a` | Cards, panels |
| Accent cyan | `#00d4ff` | Urgency, interactive |
| Amber | `#f59e0b` | Warnings, loops |
| Green | `#10b981` | Healthy states |
| Font — data | JetBrains Mono | Numbers, SQL, timestamps |
| Font — labels | Inter | UI text |

---

## Development

```bash
# Backend only
cd backend && npm run dev

# Frontend only
cd frontend && npm run dev

# Both together (from root)
npm run dev
```

---

## Discord Source: Supported Queries

```sql
-- All guilds the bot is in
SELECT id, name, member_count FROM discord.guilds;

-- Channels in a server
SELECT id, name, type, topic FROM discord.channels WHERE guild_id = '123...';

-- Recent messages
SELECT author_username, content, timestamp
FROM discord.channel_messages(channel_id => '456...', limit => 20)
ORDER BY timestamp DESC;

-- Mentions only
SELECT author_username, content, timestamp
FROM discord.mentions
WHERE channel_id = '456...'
ORDER BY timestamp DESC LIMIT 10;

-- Search across a guild
SELECT author_username, content, timestamp
FROM discord.search_guild_messages(guild_id => '123...', query => 'deployment')
ORDER BY timestamp DESC;
```

---

## License

MIT
