# DBAI — AI-Powered Database Manager

A web-based SQLite database manager with an AI assistant that can design and modify schemas in real time.

## Features

### Session Management
- Create multiple independent database sessions, each with its own SQLite file
- Switch between sessions from the navigation dropdown
- Delete sessions you no longer need
- A default session comes pre-seeded with an e-commerce and HR schema for practice

### AI Assistant
- Chat with an AI that understands your current database schema
- Two modes when creating a new session:
  - **Empty** — start with a blank database and build it yourself
  - **AI Design** — describe what you want to build and the AI designs the schema for you
- The assistant can create tables, alter columns, add foreign keys, and execute SQL directly on your database
- Available in every view (schema, SQL workspace, table browser) with context-aware responses

> **Note:** The AI assistant runs on **Gemini Flash** only. Claude Haiku is disabled in this deployment.

### Schema View
- Visual ER diagram of all tables and their relationships
- Auto-layout with directional arrows showing foreign key references
- Live updates whenever the schema changes

### SQL Workspace
- Full SQL editor with syntax highlighting
- Run any SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, or DROP statement
- Results displayed in a paginated table with column headers

### Table Browser
- Browse, search, and paginate through any table's data
- Add new records via a form that respects column types and constraints
- Edit or delete individual rows inline

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **better-sqlite3** — per-session SQLite files
- **Google Gemini Flash** — AI assistant
- **React Flow + Dagre** — ER diagram
- **CodeMirror** — SQL editor
- **Tailwind CSS** — dark UI

## Local Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env.local` file with your API keys:
   ```
   GEMINI_API_KEY=your_gemini_api_key
   GEMINI_MODEL=gemini-2.5-flash
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000)
