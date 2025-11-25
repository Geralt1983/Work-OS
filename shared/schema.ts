import { z } from "zod";

export const taskCardSchema = z.object({
  title: z.string(),
  taskId: z.string(),
  status: z.string(),
  dueDate: z.string().optional(),
});

export const messageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  timestamp: z.string(),
  taskCard: taskCardSchema.optional(),
});

export const sessionSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  lastActiveAt: z.string(),
});

export const insertMessageSchema = messageSchema.omit({ id: true, timestamp: true });
export const insertSessionSchema = sessionSchema.omit({ id: true, createdAt: true, lastActiveAt: true });

export type Message = z.infer<typeof messageSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type TaskCard = z.infer<typeof taskCardSchema>;
