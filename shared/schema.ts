import { pgTable, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const taskCardSchema = z.object({
  title: z.string(),
  taskId: z.string(),
  status: z.string(),
  dueDate: z.string().optional(),
});

export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true, createdAt: true, lastActiveAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, timestamp: true });
export const insertClientMemorySchema = createInsertSchema(clientMemory).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDailyLogSchema = createInsertSchema(dailyLog).omit({ id: true, createdAt: true });

export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type ClientMemory = typeof clientMemory.$inferSelect;
export type InsertClientMemory = z.infer<typeof insertClientMemorySchema>;
export type DailyLog = typeof dailyLog.$inferSelect;
export type InsertDailyLog = z.infer<typeof insertDailyLogSchema>;
export type TaskCard = z.infer<typeof taskCardSchema>;
