import { pgTable, text, timestamp, jsonb, integer, serial, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============ CORE ENTITIES ============

// Clients: First-class entity for tracking work relationships
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  type: text("type").notNull().default("client"), // 'client' | 'internal'
  color: text("color"), // hex color for UI
  isActive: integer("is_active").notNull().default(1), // 1 = active, 0 = archived
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Moves: The core work unit (20-minute tasks)
export const moves = pgTable("moves", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("backlog"), // 'active' | 'queued' | 'backlog' | 'done'
  effortEstimate: integer("effort_estimate").default(2), // 1=quick, 2=standard, 3=chunky, 4=draining
  effortActual: integer("effort_actual"), // filled after completion
  drainType: text("drain_type"), // 'deep' | 'comms' | 'admin' | 'creative' | 'easy' | null
  sortOrder: integer("sort_order").default(0), // for manual ordering within status
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  // Performance indexes for faster queries
  statusIdx: index("status_idx").on(table.status),
  clientIdIdx: index("client_id_idx").on(table.clientId),
  clientStatusIdx: index("client_status_idx").on(table.clientId, table.status),
}));

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastActiveAt: timestamp("last_active_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  taskCard: jsonb("task_card"),
});

export const clientMemory = pgTable("client_memory", {
  id: text("id").primaryKey(),
  clientName: text("client_name").notNull().unique(),
  tier: text("tier").default("active"),
  lastMoveId: text("last_move_id"),
  lastMoveDescription: text("last_move_description"),
  lastMoveAt: timestamp("last_move_at"),
  totalMoves: integer("total_moves").default(0),
  staleDays: integer("stale_days").default(0),
  notes: text("notes"),
  // Learning memory fields
  sentiment: text("sentiment").default("neutral"), // positive, neutral, negative, complicated
  importance: text("importance").default("medium"), // high, medium, low
  preferredWorkTime: text("preferred_work_time"), // morning, afternoon, evening, anytime
  avoidanceScore: integer("avoidance_score").default(0), // how often tasks for this client are deferred
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const dailyLog = pgTable("daily_log", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),
  completedMoves: jsonb("completed_moves").default([]),
  clientsTouched: jsonb("clients_touched").default([]),
  clientsSkipped: jsonb("clients_skipped").default([]),
  summary: text("summary"),
  backlogMovesCount: integer("backlog_moves_count").default(0), // moves pulled from backlog
  nonBacklogMovesCount: integer("non_backlog_moves_count").default(0), // moves from active/queued
  notificationsSent: jsonb("notifications_sent").default([]), // tracks SMS milestones sent (25, 50, 75, 100)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Learning memory: tracks behavioral patterns over time
export const userPatterns = pgTable("user_patterns", {
  id: text("id").primaryKey(),
  patternType: text("pattern_type").notNull(), // 'productivity', 'energy', 'preference', 'avoidance'
  patternKey: text("pattern_key").notNull(), // e.g., 'morning_person', 'avoids_admin_tasks'
  patternValue: jsonb("pattern_value"), // flexible data storage
  confidence: integer("confidence").default(1), // increases with more signals
  lastObserved: timestamp("last_observed").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Learning memory: captures signals about tasks (avoided, deferred, completed quickly, etc.)
// Signal types: deferred, avoided, completed_fast, struggled, excited, anxiety, starting_difficulty, needs_breakdown, energized, drained
export const taskSignals = pgTable("task_signals", {
  id: text("id").primaryKey(),
  taskId: text("task_id"), // ClickUp task ID (nullable for general patterns)
  taskName: text("task_name"),
  clientName: text("client_name"),
  signalType: text("signal_type").notNull(), // see SIGNAL_TYPES constant below
  context: text("context"), // any context captured
  hourOfDay: integer("hour_of_day"), // when the signal occurred (0-23)
  dayOfWeek: integer("day_of_week"), // 0=Sunday, 6=Saturday
  timeWindowMinutes: integer("time_window_minutes"), // how much time was available (null = unknown)
  energyLevel: text("energy_level"), // 'high', 'medium', 'low' - user's energy at the time
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Backlog resurfacing: tracks when tasks enter backlog to prevent stagnation
export const backlogEntries = pgTable("backlog_entries", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(), // ClickUp task ID
  taskName: text("task_name").notNull(),
  clientName: text("client_name").notNull(),
  enteredAt: timestamp("entered_at").defaultNow().notNull(), // when task entered backlog
  promotedAt: timestamp("promoted_at"), // when task was promoted out of backlog (null if still there)
  daysInBacklog: integer("days_in_backlog").default(0), // calculated field updated periodically
  autoPromoted: integer("auto_promoted").default(0), // 1 if auto-promoted due to aging
});

export const taskCardSchema = z.object({
  title: z.string(),
  taskId: z.string(),
  status: z.string(),
  dueDate: z.string().optional(),
});

// ============ INSERT SCHEMAS ============

export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true });
export const insertMoveSchema = createInsertSchema(moves).omit({ id: true, createdAt: true, completedAt: true });
export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true, createdAt: true, lastActiveAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, timestamp: true });
export const insertClientMemorySchema = createInsertSchema(clientMemory).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDailyLogSchema = createInsertSchema(dailyLog).omit({ id: true, createdAt: true });
export const insertUserPatternSchema = createInsertSchema(userPatterns).omit({ id: true, createdAt: true, lastObserved: true });
export const insertTaskSignalSchema = createInsertSchema(taskSignals).omit({ id: true, createdAt: true });
export const insertBacklogEntrySchema = createInsertSchema(backlogEntries).omit({ id: true });

// ============ TYPES ============

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Move = typeof moves.$inferSelect;
export type InsertMove = z.infer<typeof insertMoveSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type ClientMemory = typeof clientMemory.$inferSelect;
export type InsertClientMemory = z.infer<typeof insertClientMemorySchema>;
export type DailyLog = typeof dailyLog.$inferSelect;
export type InsertDailyLog = z.infer<typeof insertDailyLogSchema>;
export type UserPattern = typeof userPatterns.$inferSelect;
export type InsertUserPattern = z.infer<typeof insertUserPatternSchema>;
export type TaskSignal = typeof taskSignals.$inferSelect;
export type InsertTaskSignal = z.infer<typeof insertTaskSignalSchema>;
export type BacklogEntry = typeof backlogEntries.$inferSelect;
export type InsertBacklogEntry = z.infer<typeof insertBacklogEntrySchema>;
export type TaskCard = z.infer<typeof taskCardSchema>;

// ============ STATUS & EFFORT CONSTANTS ============

export const MOVE_STATUSES = ["active", "queued", "backlog", "done"] as const;
export type MoveStatus = typeof MOVE_STATUSES[number];

export const EFFORT_LEVELS = [
  { value: 1, label: "Quick", description: "< 10 min" },
  { value: 2, label: "Standard", description: "~20 min" },
  { value: 3, label: "Chunky", description: "30-45 min" },
  { value: 4, label: "Draining", description: "45+ min or high effort" },
] as const;

export const DRAIN_TYPES = ["deep", "comms", "admin", "creative", "easy"] as const;
export type DrainType = typeof DRAIN_TYPES[number];

export const DRAIN_TYPE_LABELS: Record<DrainType, { label: string; description: string }> = {
  deep: { label: "Deep Work", description: "Focus-intensive building, research, complex problems" },
  comms: { label: "Comms", description: "Meetings, emails, calls, discussions" },
  admin: { label: "Admin", description: "Invoices, scheduling, updates, paperwork" },
  creative: { label: "Creative", description: "Strategic thinking, proposals, design work" },
  easy: { label: "Easy", description: "Low-effort quick wins, routine tasks" },
} as const;

export const LEGACY_DRAIN_TYPE_MAP: Record<string, DrainType> = {
  mental: "deep",
  emotional: "comms",
  physical: "admin",
};

export function normalizeDrainType(drainType: string | null | undefined): DrainType | null {
  if (!drainType) return null;
  if (DRAIN_TYPES.includes(drainType as DrainType)) return drainType as DrainType;
  return LEGACY_DRAIN_TYPE_MAP[drainType] || null;
}

export const CLIENT_TYPES = ["client", "internal"] as const;
export type ClientType = typeof CLIENT_TYPES[number];

// ============ LEARNING SIGNAL TYPES ============

export const SIGNAL_TYPES = [
  "deferred",           // pushed to later
  "avoided",            // explicitly skipped
  "completed_fast",     // done quickly
  "struggled",          // took effort/multiple attempts
  "excited",            // user showed enthusiasm
  "anxiety",            // user felt anxious about task
  "starting_difficulty", // trouble getting started
  "needs_breakdown",    // task was too big, needed splitting
  "energized",          // task gave energy/motivation
  "drained",            // task was draining
] as const;
export type SignalType = typeof SIGNAL_TYPES[number];

export const SIGNAL_TYPE_LABELS: Record<SignalType, { label: string; description: string }> = {
  deferred: { label: "Deferred", description: "Pushed to later" },
  avoided: { label: "Avoided", description: "Explicitly skipped" },
  completed_fast: { label: "Completed Fast", description: "Done quickly" },
  struggled: { label: "Struggled", description: "Took effort or multiple attempts" },
  excited: { label: "Excited", description: "Showed enthusiasm" },
  anxiety: { label: "Anxiety", description: "Felt anxious about this task" },
  starting_difficulty: { label: "Starting Difficulty", description: "Had trouble getting started" },
  needs_breakdown: { label: "Needs Breakdown", description: "Task was too big, needed splitting" },
  energized: { label: "Energized", description: "Task gave energy and motivation" },
  drained: { label: "Drained", description: "Task was energy-draining" },
} as const;

export const ENERGY_LEVELS = ["high", "medium", "low"] as const;
export type EnergyLevel = typeof ENERGY_LEVELS[number];
