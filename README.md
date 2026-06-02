# Meridian

[![React](https://img.shields.io/badge/React-18-blue.svg?style=for-the-badge&logo=react)](#)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF.svg?style=for-the-badge&logo=vite)](#)
[![Node.js](https://img.shields.io/badge/Node.js-20-43853D.svg?style=for-the-badge&logo=node.js)](#)
[![Express](https://img.shields.io/badge/Express-4.x-000000.svg?style=for-the-badge&logo=express)](#)
[![Coral](https://img.shields.io/badge/Coral-SQL_Runtime-FF4F00.svg?style=for-the-badge)](#)
[![OpenRouter](https://img.shields.io/badge/OpenRouter-Llama_3.3_70B-8A2BE2.svg?style=for-the-badge)](#)

Meridian is a premium, real-time workflow intelligence tool built during the **Coral Hackathon**. It unifies fragmented workflow data across platforms like Google Calendar, Gmail, GitHub, Slack, Notion, and Discord into a single, beautifully designed operational command center. It leverages an advanced **LLM Orchestration Layer** (OpenRouter / Llama 3.3 70B) to synthesize highly personalized, actionable morning briefings, focus debt analysis, and a unified context timeline.

---

## 🚀 Features

- **Morning Briefing** : AI-powered synthesis of your most urgent tasks, stale loops, and optimal focus blocks, drawn from live data across Calendar, Gmail, Slack, and Notion.
- **Focus Debt Analyzer** : A rolling 7-day visualization (Recharts) of planned vs. completed work extracted from your project management tools.
- **Unfinished Loops** : Identifies attention sinkholes: open issues with heavy comment activity or Notion cards stuck "In Progress" for days.
- **Unified Timeline** : Streams chronological activity across all registered source platforms into one filtered feed.
- **Coral SQL Console** : Directly query your connected SaaS platforms using standard SQL grammar through the integrated Coral engine.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS + Lucide Icons + Recharts |
| Backend | Node.js + Express (Coral proxy) |
| Data layer | [Coral CLI](https://coral.so/docs) : SQL over live APIs |
| LLM synthesis | OpenRouter API (`meta-llama/llama-3.3-70b-instruct`) |
| Discord source | Custom Coral HTTP source spec |

---

## 🗂 Project Structure

```
meridian/
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

## ⚙️ Prerequisites

1. **Node.js** ≥ 18
2. **npm** ≥ 9 (workspaces support)
3. **Coral CLI** installed and on your PATH — [Installation guide](https://coral.so/docs/install)
4. **OpenRouter API key** — [openrouter.ai](https://openrouter.ai)
5. Coral sources added (see below)

> **No Coral? No problem.** Set `MOCK_MODE=true` in your `.env` to run the full dashboard with realistic fake data — no integrations required.

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/your-org/meridian.git
cd meridian
npm run install:all
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your values
```

Key variables:

```env
PORT=3001
MOCK_MODE=false                        # Set to true to skip Coral setup

# OpenRouter
OPENROUTER_API_KEY=your_key_here

# Source Integration Tokens (used by Coral directly)
GITHUB_ENABLED=false
GITHUB_OWNER=your_github_owner
GITHUB_REPO=your_github_repo
GMAIL_ACCESS_TOKEN=your_token
GOOGLE_CALENDAR_ACCESS_TOKEN=your_token
SLACK_TOKEN=your_token
NOTION_TOKEN=your_token
```

### 3. Add Coral Sources

```bash
coral source add github
coral source add slack
coral source add google_calendar
coral source add notion
```

For the custom Discord integration:

```bash
# Linux/macOS
cp -r sources/discord/ ~/.coral/workspaces/default/sources/discord/

# Windows (PowerShell)
Copy-Item -Recurse sources\discord\ "$env:USERPROFILE\.coral\workspaces\default\sources\discord\"

coral source add --file sources/discord/manifest.yaml
```

Ensure `DISCORD_BOT_TOKEN` and `DISCORD_GUILD_ID` are exported in your environment. See `sources/discord/README.md` for details.

### 4. Run

You need two terminal windows to run the frontend and backend simultaneously.

**Terminal 1 — Backend:**

```bash
cd backend
npm install
npm run dev
```

**Terminal 2 — Frontend:**

```bash
cd frontend
npm install
npm run dev
```

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

> **Note on Windows Security**: The backend injects OAuth/API tokens directly into process memory (`shell: false`) to safely bypass Windows Credential Manager/Keychain lockouts when interacting with the Coral CLI.

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/query` | Run raw Coral SQL |
| `GET` | `/api/briefing` | Morning briefing via LLM + all sources |
| `GET` | `/api/focus-debt` | Planned vs. completed tasks (7 days) |
| `GET` | `/api/unfinished-loops` | Work touched but never closed |
| `GET` | `/api/sources` | Connected source status |
| `GET` | `/api/health` | Health check |

---

## 🖥 Dashboard Panels

| Panel | Description |
|---|---|
| **Today** (Focus Debt) | Bar chart of planned vs. completed work with a Focus Debt Score. |
| **Attention** (Unfinished Loops) | Items touched repeatedly but never closed — your attention sinkholes. |
| **Timeline** | Unified chronological activity stream across all sources, with per-source filters. |
| **Console** | Power-user raw SQL console with example query chips. |
| **Morning Briefing** *(always-visible right panel)* | Urgent items, waiting-on-you queue, best focus window, and today's calendar. |

---

## 🛡 Graceful Degradation

Meridian features robust error boundaries and state management. If an integration (like GitHub) is disabled or encounters a rate limit, the API dynamically handles timeouts (15s limit) and the frontend gracefully falls back to a warning state — without breaking the application layout.

---

## 🎨 Design System

| Element | Description |
|---|---|
| **Typography** | Inter (UI components), JetBrains Mono (data tables, code blocks) |
| **Color Palette** | Slate/White base · Accent Blue for primary actions · Amber for warnings · Emerald for success |
| **Components** | Tailwind CSS utility classes · Glassmorphism panels · Micro-animations (glow, pulse, fade-in) |

---

## 📄 License

This project is licensed under the [MIT License](./LICENSE).
