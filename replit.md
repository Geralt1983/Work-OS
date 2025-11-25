# ClickUp Assistant - AI Task Management Chat Interface

## Overview

ClickUp Assistant is a conversational AI application that enables users to manage their ClickUp tasks through natural language interactions. The application provides a chat-based interface where users can create, update, search, and organize tasks by simply describing what they want to do. Built with a modern React frontend and Express backend, it integrates with the ClickUp API and OpenAI to provide an intelligent, user-friendly task management experience.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React with TypeScript for type-safe component development
- Vite as the build tool and development server
- Wouter for lightweight client-side routing
- TanStack Query for server state management and caching
- Shadcn/ui component library built on Radix UI primitives
- Tailwind CSS for styling with custom design tokens

**Design Philosophy:**
- Apple-inspired minimalist design approach
- Clean, sophisticated aesthetic prioritizing clarity and elegance
- Generous white space and subtle interactions
- System-native feeling with distraction-free focus
- Custom color system supporting light and dark modes

**Component Structure:**
- Chat-based UI with header, message area, and input components
- Reusable UI primitives from Shadcn/ui (buttons, cards, dialogs, etc.)
- Custom chat components (ChatHeader, ChatMessage, ChatInput, EmptyState, TypingIndicator)
- Task card displays for showing task details within conversations
- Responsive layout with mobile-first approach

**State Management:**
- React Query for API data fetching and caching
- Local component state for UI interactions
- Session-based conversation management
- Toast notifications for user feedback

### Backend Architecture

**Technology Stack:**
- Node.js with Express for the REST API server
- TypeScript throughout for type safety
- In-memory storage for sessions and messages (MemStorage class)
- OpenAI API for natural language processing
- ClickUp API for task management operations

**API Design:**
- RESTful endpoints for session and chat management
- POST `/api/sessions` - Create new chat session
- GET `/api/sessions/:id/messages` - Retrieve conversation history
- POST `/api/chat` - Send message and receive AI response
- Health check endpoint for monitoring ClickUp configuration

**AI Integration:**
- OpenAI GPT models for natural language understanding
- Function calling (tool use) to execute ClickUp operations
- System prompt defines AI assistant behavior and capabilities
- Context-aware responses based on conversation history

**ClickUp Integration:**
- Custom wrapper around ClickUp API v2
- Tool-based architecture for discrete task operations:
  - Workspace navigation (spaces, folders, lists)
  - Task retrieval and searching
  - Task creation with configurable properties
  - Task updates (status, name, description, due date, priority)
  - Task deletion
- Error handling and API response validation

**Data Flow:**
1. User sends message through chat interface
2. Frontend creates/retrieves session and posts message
3. Backend stores user message and conversation history
4. OpenAI processes message with available tools context
5. AI determines appropriate ClickUp operations
6. Backend executes ClickUp API calls via tool functions
7. AI generates natural language response with results
8. Backend stores assistant message and returns to frontend
9. Frontend displays response with optional task cards

### Data Storage

**Current Implementation:**
- In-memory storage using Map data structures
- Session tracking with created/last active timestamps
- Message history with role, content, and optional task cards
- No persistent database (data lost on server restart)

**Schema Design:**
- Session: id, createdAt, lastActiveAt
- Message: id, sessionId, role, content, timestamp, taskCard (optional)
- TaskCard: title, taskId, status, dueDate (optional)
- Zod schemas for runtime validation

**Future Database Support:**
- Drizzle ORM configured for PostgreSQL
- Database connection setup with Neon serverless PostgreSQL
- Migration system ready via drizzle-kit
- Schema definitions exist but not yet used in production

### External Dependencies

**ClickUp API:**
- RESTful API v2 for task management operations
- Requires API key and Team ID for authentication
- Supports workspace hierarchy (teams, spaces, folders, lists)
- Task CRUD operations with rich metadata (status, priority, due dates, etc.)

**OpenAI API:**
- GPT models for conversational AI
- Function calling for structured tool execution
- Streaming responses not currently implemented
- Requires API key for authentication

**Model Context Protocol (MCP):**
- Integration point prepared for ClickUp MCP server
- StdioClientTransport for process communication
- Not actively used in current implementation
- Provides alternative integration path for ClickUp operations

**UI Dependencies:**
- Radix UI primitives for accessible component foundation
- Lucide React for icon library
- React Hook Form with Zod resolvers for form handling
- date-fns for date formatting and manipulation

**Build and Development:**
- Vite plugins for development experience (error overlay, banner)
- Replit-specific tooling for deployment environment
- ESBuild for production bundling
- PostCSS with Tailwind for CSS processing

**Environment Configuration:**
- `CLICKUP_API_KEY` - ClickUp API authentication
- `CLICKUP_TEAM_ID` - Target ClickUp workspace
- `OPENAI_API_KEY` - OpenAI API authentication
- `DATABASE_URL` - PostgreSQL connection (prepared but unused)