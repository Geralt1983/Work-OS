import { type Message, type InsertMessage, type Session, type InsertSession } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  createSession(session: InsertSession): Promise<Session>;
  getSession(id: string): Promise<Session | undefined>;
  updateSessionActivity(id: string): Promise<void>;
  
  createMessage(message: InsertMessage): Promise<Message>;
  getMessages(sessionId: string): Promise<Message[]>;
  getSessionMessages(sessionId: string, limit?: number): Promise<Message[]>;
}

export class MemStorage implements IStorage {
  private sessions: Map<string, Session>;
  private messages: Map<string, Message>;

  constructor() {
    this.sessions = new Map();
    this.messages = new Map();
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const session: Session = { ...insertSession, id, createdAt: now, lastActiveAt: now };
    this.sessions.set(id, session);
    return session;
  }

  async getSession(id: string): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  async updateSessionActivity(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      session.lastActiveAt = new Date().toISOString();
      this.sessions.set(id, session);
    }
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    const message: Message = { ...insertMessage, id, timestamp };
    this.messages.set(id, message);
    return message;
  }

  async getMessages(sessionId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter((msg) => msg.sessionId === sessionId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async getSessionMessages(sessionId: string, limit?: number): Promise<Message[]> {
    const messages = await this.getMessages(sessionId);
    return limit ? messages.slice(-limit) : messages;
  }
}

export const storage = new MemStorage();
