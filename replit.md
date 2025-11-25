# Work OS - AI-Powered Task Management

## Overview

Work OS is a conversational AI application that manages ClickUp tasks through natural language with "YOLO mode" execution. The system operates on the principle of **one move per client per day** — where a "move" is a 20-minute or less task that advances client work. The AI executes immediately without confirmations, tracks client state, and surfaces stale clients proactively.

## User Preferences

- **YOLO mode**: No confirmations, immediate execution
- **Moves**: All work decomposed into 20-minute tasks
- **One move per client per day**: Core operational principle
- **No guilt-based decisions**: System adapts, never scolds
- **Natural language intent**: "Make a Raleigh move" → creates task

## Pipeline Workflow

Every client should have a healthy pipeline:
- **Active (Today)**: 1 task currently being worked on
- **Queued (Next)**: 1 task ready to start next
- **Backlog**: Future tasks to pull from

The daily audit checks:
1. Every client has active/queued/backlog tasks
2. Tasks are actionable (clear, concrete next steps)
3. Stale clients are surfaced (2+ days without moves)

## Backlog Resurfacing

Prevents backlog stagnation through multiple mechanics:

**"One From The Back" Rule**: After 5 moves from active/queued without touching backlog, the system triggers a reminder to pull from backlog.

**Backlog Aging**: Tasks are tracked when they enter backlog:
- 7+ days in backlog = "aging" (flagged in suggestions)
- 10+ days = eligible for auto-promotion to Queued

**Backlog Health Scoring**: Per-client metrics include:
- Oldest task age in backlog
- Count of aging tasks (7+ days)
- Average backlog age

**Backlog Triage**: Weekly or on-demand review that:
- Lists all aging backlog tasks
- Recommends promotions based on priority/age
- Surfaces tasks that may need to be deleted/archived

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React with TypeScript
- Vite as the build tool
- Wouter for routing
- TanStack Query for server state
- Shadcn/ui component library
- Tailwind CSS with Apple-inspired design

**Key Components:**
- ChatHeader: "Work OS" branding with theme toggle
- ChatInput: Message input with Enter to send
- ChatMessage: User/assistant messages with TaskCard support
- EmptyState: Example prompts for Work OS workflow

### Backend Architecture

**Technology Stack:**
- Node.js with Express
- PostgreSQL (Neon serverless) for persistent state
- Drizzle ORM for database operations
- OpenAI GPT-4o with function calling
- Direct ClickUp API integration

**API Endpoints:**
- POST `/api/chat`: Process chat with AI + tools
- POST `/api/sessions`: Create new session
- GET `/api/sessions/:id/messages`: Get conversation history
- GET `/api/health`: Check ClickUp configuration

### Database Schema

**Tables:**
- `sessions`: Chat session tracking
- `messages`: Conversation history with task cards
- `client_memory`: Tracks last move, tier, stale days, notes per client
- `daily_log`: Completed moves, clients touched/skipped per day, backlog moves count
- `task_signals`: Learning signals (deferred, avoided, completed_fast, etc.)
- `learned_patterns`: Productivity patterns, preferences, avoidance detection
- `client_insights`: Sentiment and importance per client
- `backlog_entries`: Tracks when tasks enter/exit backlog tier for aging analysis

### AI Tools

**ClickUp Tools:**
- get_hierarchy: Full workspace structure (spaces/folders/lists)
- get_spaces, get_folders, get_lists, get_folderless_lists
- get_tasks, get_all_tasks, search_tasks
- create_task, update_task, delete_task, get_task

**Memory Tools:**
- get_client_memory: Get client state
- get_all_clients: List all tracked clients
- update_client_move: Record completed move
- get_stale_clients: Find inactive clients (2+ days)
- set_client_tier: Set client to active/paused/archived
- add_client_note: Add notes to client memory
- get_today_summary: Get daily activity summary
- log_daily_reset: End of day logging

**Pipeline Tools:**
- run_pipeline_audit: Check all clients have active/queued/backlog
- get_client_pipeline: Get specific client's pipeline status
- get_all_client_pipelines: Get pipelines for ALL clients at once
- check_task_actionable: AI evaluates if task is actionable
- promote_task: Move task from backlog→queued or queued→active (updates tier field)
- demote_task: Move task backwards (active→queued or queued→backlog)
- set_task_tier: Set any tier value on a task
- complete_task: Mark a task as complete

**Daily Planning Tools:**
- suggest_next_move: AI-powered task recommendation based on user context
  - Takes: time_available_minutes, energy_level, context, prefer_client
  - Returns: recommended task, reasoning, and alternatives
  - Factors in: learned patterns, avoided tasks, client sentiment, productivity times

**Learning Memory Tools:**
- record_signal: Capture task behaviors (deferred, avoided, completed_fast, struggled, excited)
- record_pattern: Store learned patterns (productivity times, preferences, avoidance)
- set_client_sentiment: Track feelings about clients (positive, neutral, negative, complicated)
- set_client_importance: Set client priority (high, medium, low)
- get_learned_patterns: Retrieve all patterns to personalize recommendations
- get_avoided_tasks: Find repeatedly deferred tasks
- get_productivity_insights: Analyze productivity by time of day
- get_client_insights: Get sentiment/importance for all clients

**Backlog Resurfacing Tools:**
- get_backlog_health: Per-client backlog age stats (oldest task age, aging count, avg age)
- get_aging_backlog: List tasks that have been in backlog 7+ days
- auto_promote_stale_backlog: Auto-promote tasks 10+ days old to Queued tier
- should_pull_from_backlog: Check if "one from the back" rule is triggered (5 moves without backlog)
- run_backlog_triage: Comprehensive backlog review with promotion recommendations

**Tier Custom Field (ClickUp):**
- Tasks are categorized by the "⛰️ Tier" dropdown field (not statuses)
- Tier values: active, next, backlog (dropdown options)
- Field name matching supports emoji prefixes
- Value reading handles both option IDs and orderindex

### System Prompt Behavior

The AI operates in YOLO mode:
1. **Execute immediately** — No confirmations, just action
2. **Interpret intent** — Natural language to ClickUp operations
3. **Track clients** — Auto-update memory when creating/completing tasks
4. **Surface stale clients** — Proactively mention 2+ day inactive clients
5. **Check pipelines** — Ensure every client has active/queued/backlog
6. **Flag non-actionable** — Identify vague tasks that need rewriting
7. **No guilt** — Shrink moves if overwhelmed, maintain momentum

## Environment Variables

- `CLICKUP_API_KEY`: ClickUp API authentication
- `CLICKUP_TEAM_ID`: Target ClickUp workspace
- `OPENAI_API_KEY`: OpenAI API authentication
- `DATABASE_URL`: PostgreSQL connection string

## Example Commands

- "Make a Raleigh move to review their backlog"
- "Summarize Memphis"
- "What did I do today?"
- "Which clients are stale?"
- "Run daily check" (pipeline audit)
- "Show me Raleigh's pipeline"
- "Push the Memphis invoice through"
- "Show me all my tasks"
- "Show me the full ClickUp structure"

**Daily Planning:**
- "I have 45 minutes and low energy, what should I work on?"
- "Just finished a call with Memphis, what's next?"
- "Need a quick win before my meeting"
- "Show me all my options across clients"
- "What's the best move right now?"

**Backlog Management:**
- "Check my backlog health"
- "Show me aging backlog tasks"
- "Run backlog triage"
- "Auto-promote stale backlog tasks"
- "Should I pull from backlog?"
