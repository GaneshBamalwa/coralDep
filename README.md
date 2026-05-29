# ContextOS (Coral Hackathon)

ContextOS is a premium, real-time workflow intelligence dashboard built during the Coral Hackathon. It connects scattered work and communication platforms (Google Calendar, Gmail, Notion, Slack, Discord, and GitHub) through the **Coral SQL CLI**, aggregates that raw data, and uses an advanced **LLM Orchestration Layer (OpenRouter / Llama 3.3 70b)** to synthesize a highly personalized, actionable Morning Briefing.

It includes visual productivity charts like Focus Debt, Unfinished Loops, and a Unified Timeline.

## 🚀 Features

- **Morning Briefing**: Synthesizes an AI-powered summary of your most urgent tasks, stale loops, and optimal focus blocks based on live data from Calendar, Gmail, Slack, and Notion.
- **Focus Debt Analyzer**: A beautiful rolling 7-day visualization (using Recharts) of planned versus completed work extracted from project management tools.
- **Unfinished Loops**: Identifies attention sinkholes—open issues with heavy comment activity or Notion cards stuck "In Progress" for days.
- **Unified Timeline**: Streams chronological activity across all registered source platforms into one filtered feed.
- **Coral SQL Console**: Directly query your connected SaaS platforms using standard SQL grammar through the integrated Coral engine.

## 🛠 Tech Stack

- **Frontend**: React + Vite, Tailwind CSS, Lucide Icons, Recharts
- **Backend**: Node.js + Express
- **Database/Engine**: Coral CLI (SQL Interface for external SaaS)
- **AI Orchestration**: OpenRouter API (`meta-llama/llama-3.3-70b-instruct`)

## ⚙️ Setup Instructions

### 1. Prerequisites
- Node.js (v18+)
- [Coral CLI](https://github.com/trycoral/coral) installed and available in your PATH.
- OpenRouter API key

### 2. Environment Configuration
Navigate to the `contextos` folder and set up your `.env`:

```bash
cd contextos
cp .env.example .env
```

Populate the `.env` file with your specific access tokens:
```ini
PORT=3001
MOCK_MODE=false

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

### 3. Install & Run

You need two terminal windows to run the frontend and backend simultaneously.

**Terminal 1: Backend**
```bash
cd contextos/backend
npm install
npm run dev
```

**Terminal 2: Frontend**
```bash
cd contextos/frontend
npm install
npm run dev
```

> **Note on Windows Security**: The backend injects OAuth/API tokens directly into process memory (`shell: false`) to safely bypass Windows Credential Manager/Keychain lockouts when interacting with the Coral CLI.

## 🛡 Graceful Degradation
ContextOS features robust error boundaries and state management. If an integration (like GitHub) is disabled or encounters a rate limit, the API dynamically handles timeouts (15s limit) and the frontend elegantly falls back to a warning state without breaking the application layout.

## 📄 License
MIT License
