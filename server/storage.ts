import { db } from "./db";
import { sessions, messages, clientMemory, dailyLog } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { 
  Session, InsertSession, 
  Message, InsertMessage,
  ClientMemory, InsertClientMemory,
  DailyLog, InsertDailyLog
} from "@shared/schema";

export interface IStorage {
  createSession(session: InsertSession): Promise<Session>;
  getSession(id: string): Promise<Session | undefined>;
  updateSessionActivity(id: string): Promise<void>;
  
  createMessage(message: InsertMessage): Promise<Message>;
  getMessages(sessionId: string): Promise<Message[]>;
  getSessionMessages(sessionId: string, limit?: number): Promise<Message[]>;
  
  getClientMemory(clientName: string): Promise<ClientMemory | undefined>;
  getAllClients(): Promise<ClientMemory[]>;
  upsertClientMemory(client: Partial<InsertClientMemory> & { clientName: string }): Promise<ClientMemory>;
  updateClientMove(clientName: string, moveId: string, description: string): Promise<void>;
  getStaleClients(days?: number): Promise<ClientMemory[]>;
  
  createDailyLog(log: InsertDailyLog): Promise<DailyLog>;
  getDailyLog(date: string): Promise<DailyLog | undefined>;
  updateDailyLog(date: string, updates: Partial<DailyLog>): Promise<void>;
}

class DatabaseStorage implements IStorage {
  async createSession(insertSession: InsertSession): Promise<Session> {
    const id = randomUUID();
    const [session] = await db.insert(sessions).values({ ...insertSession, id }).returning();
    return session;
  }

  async getSession(id: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
    return session;
  }

  async updateSessionActivity(id: string): Promise<void> {
    await db.update(sessions).set({ lastActiveAt: new Date() }).where(eq(sessions.id, id));
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const [message] = await db.insert(messages).values({ ...insertMessage, id }).returning();
    return message;
  }

  async getMessages(sessionId: string): Promise<Message[]> {
    return db.select().from(messages).where(eq(messages.sessionId, sessionId));
  }

  async getSessionMessages(sessionId: string, limit?: number): Promise<Message[]> {
    const query = db.select().from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(messages.timestamp);
    
    if (limit) {
      const allMessages = await query;
      return allMessages.slice(-limit);
    }
    return query;
  }

  async getClientMemory(clientName: string): Promise<ClientMemory | undefined> {
    const normalized = clientName.toLowerCase().trim();
    const [client] = await db.select().from(clientMemory)
      .where(eq(clientMemory.clientName, normalized));
    return client;
  }

  async getAllClients(): Promise<ClientMemory[]> {
    return db.select().from(clientMemory).orderBy(desc(clientMemory.lastMoveAt));
  }

  async upsertClientMemory(client: Partial<InsertClientMemory> & { clientName: string }): Promise<ClientMemory> {
    const normalized = client.clientName.toLowerCase().trim();
    const existing = await this.getClientMemory(normalized);
    
    if (existing) {
      const [updated] = await db.update(clientMemory)
        .set({ ...client, clientName: normalized, updatedAt: new Date() })
        .where(eq(clientMemory.id, existing.id))
        .returning();
      return updated;
    } else {
      const id = randomUUID();
      const [created] = await db.insert(clientMemory)
        .values({ ...client, id, clientName: normalized })
        .returning();
      return created;
    }
  }

  async updateClientMove(clientName: string, moveId: string, description: string): Promise<void> {
    const normalized = clientName.toLowerCase().trim();
    const existing = await this.getClientMemory(normalized);
    
    if (existing) {
      await db.update(clientMemory)
        .set({
          lastMoveId: moveId,
          lastMoveDescription: description,
          lastMoveAt: new Date(),
          totalMoves: (existing.totalMoves || 0) + 1,
          staleDays: 0,
          updatedAt: new Date(),
        })
        .where(eq(clientMemory.id, existing.id));
    } else {
      await this.upsertClientMemory({
        clientName: normalized,
        lastMoveId: moveId,
        lastMoveDescription: description,
        lastMoveAt: new Date(),
        totalMoves: 1,
        staleDays: 0,
      });
    }
  }

  async getStaleClients(days: number = 2): Promise<ClientMemory[]> {
    const allClients = await this.getAllClients();
    const now = new Date();
    
    return allClients.filter(client => {
      if (!client.lastMoveAt) return true;
      const lastMove = new Date(client.lastMoveAt);
      const diffDays = Math.floor((now.getTime() - lastMove.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= days;
    });
  }

  async createDailyLog(log: InsertDailyLog): Promise<DailyLog> {
    const id = randomUUID();
    const [created] = await db.insert(dailyLog).values({ ...log, id }).returning();
    return created;
  }

  async getDailyLog(date: string): Promise<DailyLog | undefined> {
    const [log] = await db.select().from(dailyLog).where(eq(dailyLog.date, date));
    return log;
  }

  async updateDailyLog(date: string, updates: Partial<DailyLog>): Promise<void> {
    await db.update(dailyLog).set(updates).where(eq(dailyLog.date, date));
  }
}

export const storage = new DatabaseStorage();
