# Work OS - AI-Powered Task Management

## Overview

Work OS is a conversational AI application that manages ClickUp tasks through natural language with "YOLO mode" execution. The system operates on the principle of **one move per client per day** — where a "move" is a 20-minute or less task that advances client work. The AI executes immediately without confirmations, tracks client state, and surfaces stale clients proactively.

## User Preferences

- **YOLO mode**: No confirmations, immediate execution
- **Moves**: All work decomposed into 20-minute tasks
- **One move per client per day**: Core operational principle
- **No guilt-based decisions**: System adapts, never scolds
- **Natural language intent**: "Make a Raleigh move" → creates task

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
- `daily_log`: Completed moves, clients touched/skipped per day

### AI Tools

**ClickUp Tools:**
- get_spaces, get_folders, get_lists
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

### System Prompt Behavior

The AI operates in YOLO mode:
1. **Execute immediately** — No confirmations, just action
2. **Interpret intent** — Natural language to ClickUp operations
3. **Track clients** — Auto-update memory when creating/completing tasks
4. **Surface stale clients** — Proactively mention 2+ day inactive clients
5. **No guilt** — Shrink moves if overwhelmed, maintain momentum

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
- "Push the Memphis invoice through"
- "Show me all my tasks"
