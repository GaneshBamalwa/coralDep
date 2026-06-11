# Meridian

[![React](https://img.shields.io/badge/React-18-blue.svg?style=for-the-badge&logo=react)](#)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF.svg?style=for-the-badge&logo=vite)](#)
[![Node.js](https://img.shields.io/badge/Node.js-20-43853D.svg?style=for-the-badge&logo=node.js)](#)
[![Express](https://img.shields.io/badge/Express-4.x-000000.svg?style=for-the-badge&logo=express)](#)
[![Coral](https://img.shields.io/badge/Coral-SQL_Runtime-FF4F00.svg?style=for-the-badge)](#)
[![Vertex AI](https://img.shields.io/badge/Vertex_AI-Gemini_2.5-4285F4.svg?style=for-the-badge&logo=googlecloud)](#)
[![Groq](https://img.shields.io/badge/Groq-Llama_3-f55036.svg?style=for-the-badge)](#)

Meridian (formerly ContextOS) is a retrieval-first personal intelligence dashboard. It unifies fragmented workflow data across platforms like Calendar, GitHub, Slack, Notion, and Discord into a single, beautifully designed operational command center. It leverages advanced LLM synthesis to provide actionable morning briefings, focus debt analysis, and a unified context timeline.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Node.js + Express (Coral proxy) |
| Data layer | [Coral CLI](https://coral.so/docs) — SQL over live APIs |
| LLM synthesis | Vertex AI core agent (`gemini-2.5-pro` by default) |
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
GOOGLE_CLOUD_PROJECT=your-project-id
GCLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
VERTEX_MODEL=gemini-2.5-pro
GITHUB_OWNER=your-org
GITHUB_REPO=your-repo
```

For the full Google Cloud setup, see [`GCP_VERTEX_SETUP.md`](./GCP_VERTEX_SETUP.md).

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

    For the custom Discord integration:
    ```bash
    # Linux/macOS
    cp -r sources/discord/ ~/.coral/workspaces/default/sources/discord/
    
    # Windows (PowerShell)
    Copy-Item -Recurse sources\discord\ "$env:USERPROFILE\.coral\workspaces\default\sources\discord\"
    
    coral source add --file sources/discord/manifest.yaml
    ```
    Ensure you export `DISCORD_BOT_TOKEN` and `DISCORD_GUILD_ID` in your environment. Detailed instructions are available in `sources/discord/README.md`.

4.  **Start the Application**

    From the root `contextos` directory:
    ```bash
    # Start both backend and frontend concurrently
    npm run dev
    ```
    
    *   **Frontend:** http://localhost:5173
    *   **Backend:** http://localhost:3001

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `POST` | `/api/query` | Run raw Coral SQL |
| `GET` | `/api/briefing` | Morning briefing via Vertex AI + all sources |
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

The application utilizes a professional, clean interface optimized for data density and quick scanning. 

| Element | Description |
|---|---|
| **Typography** | Inter (UI components), JetBrains Mono (Data tables, Code blocks) |
| **Color Palette** | Slate/White base, Accent Blue for primary actions, Amber for warnings, Emerald for success states. |
| **Components** | Tailwind CSS custom utility classes, Glassmorphism panels, Micro-animations (glow, pulse, fade-in). |

## License

This project is licensed under the MIT License.
