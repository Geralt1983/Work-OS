import { db } from "./db";
import { sessions, messages, clientMemory, dailyLog, userPatterns, taskSignals, backlogEntries, clients, moves } from "@shared/schema";
import { eq, desc, and, gte, isNull, sql, asc } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { 
  Session, InsertSession, 
  Message, InsertMessage,
  ClientMemory, InsertClientMemory,
  DailyLog, InsertDailyLog,
  UserPattern, InsertUserPattern,
  TaskSignal, InsertTaskSignal,
  BacklogEntry, InsertBacklogEntry,
  Client, InsertClient,
  Move, InsertMove,
  MoveStatus
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
  addCompletedMove(date: string, move: { moveId: string; description: string; clientName: string; at: string; source?: string }): Promise<boolean>;
  removeCompletedMoves(date: string, moveIds: string[]): Promise<number>;
  
  // Learning memory: patterns
  recordPattern(pattern: InsertUserPattern): Promise<UserPattern>;
  getPatterns(patternType?: string): Promise<UserPattern[]>;
  updatePatternConfidence(patternKey: string, increment: number): Promise<void>;
  
  // Learning memory: task signals
  recordSignal(signal: InsertTaskSignal): Promise<TaskSignal>;
  getTaskSignals(taskId?: string, clientName?: string, signalType?: string, daysBack?: number): Promise<TaskSignal[]>;
  getAvoidedTasks(daysBack?: number): Promise<{ taskId: string; taskName: string; clientName: string; count: number }[]>;
  getProductivityByHour(): Promise<{ hour: number; completions: number; deferrals: number }[]>;
  
  // Backlog resurfacing
  recordBacklogEntry(entry: InsertBacklogEntry): Promise<BacklogEntry>;
  markBacklogPromoted(taskId: string, autoPromoted?: boolean): Promise<void>;
  getActiveBacklogEntries(): Promise<BacklogEntry[]>;
  getBacklogHealth(): Promise<{ 
    clientName: string; 
    oldestDays: number; 
    agingCount: number; 
    totalCount: number;
    avgDays: number;
  }[]>;
  getAgingBacklogTasks(daysThreshold?: number): Promise<BacklogEntry[]>;
  getBacklogMoveStats(daysBack?: number): Promise<{ backlogMoves: number; nonBacklogMoves: number }>;
  incrementBacklogMoveCount(date: string, isBacklog: boolean): Promise<void>;
  
  // Metrics
  getWeeklyLogs(days?: number): Promise<DailyLog[]>;
  getTodayMetrics(): Promise<{
    date: string;
    movesCompleted: number;
    estimatedMinutes: number;
    targetMinutes: number;
    pacingPercent: number;
    clientsTouched: string[];
    backlogMoves: number;
    nonBacklogMoves: number;
  }>;
  getWeeklyMetrics(): Promise<{
    days: Array<{
      date: string;
      movesCompleted: number;
      estimatedMinutes: number;
      pacingPercent: number;
    }>;
    averageMovesPerDay: number;
    totalMoves: number;
    totalMinutes: number;
  }>;
  getClientMetrics(): Promise<Array<{
    clientName: string;
    totalMoves: number;
    lastMoveAt: Date | null;
    daysSinceLastMove: number;
    sentiment: string;
    importance: string;
    tier: string;
  }>>;

  // ============ CLIENTS (first-class entity) ============
  createClient(client: InsertClient): Promise<Client>;
  getClient(id: number): Promise<Client | undefined>;
  getClientByName(name: string): Promise<Client | undefined>;
  getAllClientsEntity(): Promise<Client[]>;
  updateClient(id: number, updates: Partial<InsertClient>): Promise<Client | undefined>;
  archiveClient(id: number): Promise<void>;

  // ============ MOVES (core work unit) ============
  createMove(move: InsertMove): Promise<Move>;
  getMove(id: number): Promise<Move | undefined>;
  getMovesByStatus(status: MoveStatus): Promise<Move[]>;
  getMovesByClient(clientId: number): Promise<Move[]>;
  getAllMoves(filters?: { status?: MoveStatus; clientId?: number; includeCompleted?: boolean }): Promise<Move[]>;
  updateMove(id: number, updates: Partial<InsertMove>): Promise<Move | undefined>;
  completeMove(id: number, effortActual?: number): Promise<Move | undefined>;
  promoteMove(id: number): Promise<Move | undefined>;
  demoteMove(id: number): Promise<Move | undefined>;
  deleteMove(id: number): Promise<void>;
  reorderMoves(status: MoveStatus, orderedIds: number[]): Promise<void>;
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

  async addCompletedMove(date: string, move: { moveId: string; description: string; clientName: string; at: string; source?: string }): Promise<boolean> {
    let existing = await this.getDailyLog(date);
    
    if (!existing) {
      existing = await this.createDailyLog({
        date,
        completedMoves: [],
        clientsTouched: [],
        clientsSkipped: [],
      });
    }
    
    const completedMoves = Array.isArray(existing.completedMoves) 
      ? (existing.completedMoves as Array<{ moveId: string; description: string; clientName: string; at: string; source?: string }>)
      : [];
    
    const clientsTouched = Array.isArray(existing.clientsTouched)
      ? (existing.clientsTouched as string[])
      : [];
    
    // Check if move already exists (by moveId)
    const alreadyExists = completedMoves.some(m => m.moveId === move.moveId);
    if (alreadyExists) {
      return false; // Not added, was duplicate
    }
    
    completedMoves.push(move);
    
    // Add client to touched list if not already there
    if (!clientsTouched.includes(move.clientName)) {
      clientsTouched.push(move.clientName);
    }
    
    await this.updateDailyLog(date, {
      completedMoves: completedMoves as unknown as string[],
      clientsTouched,
    });
    
    return true; // Successfully added
  }

  async removeCompletedMoves(date: string, moveIds: string[]): Promise<number> {
    const existing = await this.getDailyLog(date);
    if (!existing) return 0;

    const completedMoves = Array.isArray(existing.completedMoves) 
      ? (existing.completedMoves as Array<{ moveId: string; description: string; clientName: string; at: string; source?: string }>)
      : [];
    
    const originalCount = completedMoves.length;
    const filtered = completedMoves.filter(m => !moveIds.includes(m.moveId));
    const removedCount = originalCount - filtered.length;

    if (removedCount > 0) {
      // Recalculate clients touched from remaining moves
      const clientsTouched = Array.from(new Set(filtered.map(m => m.clientName)));
      
      await this.updateDailyLog(date, {
        completedMoves: filtered as unknown as string[],
        clientsTouched,
      });
    }

    return removedCount;
  }

  // Learning memory: patterns
  async recordPattern(pattern: InsertUserPattern): Promise<UserPattern> {
    const existing = await db.select().from(userPatterns)
      .where(eq(userPatterns.patternKey, pattern.patternKey));
    
    if (existing.length > 0) {
      const [updated] = await db.update(userPatterns)
        .set({ 
          patternValue: pattern.patternValue,
          confidence: (existing[0].confidence || 1) + 1,
          lastObserved: new Date()
        })
        .where(eq(userPatterns.patternKey, pattern.patternKey))
        .returning();
      return updated;
    }
    
    const id = randomUUID();
    const [created] = await db.insert(userPatterns)
      .values({ ...pattern, id })
      .returning();
    return created;
  }

  async getPatterns(patternType?: string): Promise<UserPattern[]> {
    if (patternType) {
      return db.select().from(userPatterns)
        .where(eq(userPatterns.patternType, patternType))
        .orderBy(desc(userPatterns.confidence));
    }
    return db.select().from(userPatterns).orderBy(desc(userPatterns.confidence));
  }

  async updatePatternConfidence(patternKey: string, increment: number): Promise<void> {
    const [existing] = await db.select().from(userPatterns)
      .where(eq(userPatterns.patternKey, patternKey));
    
    if (existing) {
      await db.update(userPatterns)
        .set({ 
          confidence: (existing.confidence || 1) + increment,
          lastObserved: new Date()
        })
        .where(eq(userPatterns.patternKey, patternKey));
    }
  }

  // Learning memory: task signals
  async recordSignal(signal: InsertTaskSignal): Promise<TaskSignal> {
    const id = randomUUID();
    const now = new Date();
    const [created] = await db.insert(taskSignals)
      .values({ 
        ...signal, 
        id,
        hourOfDay: signal.hourOfDay ?? now.getHours(),
        dayOfWeek: signal.dayOfWeek ?? now.getDay()
      })
      .returning();
    
    // Update client avoidance score if this is a deferral
    if (signal.signalType === 'deferred' || signal.signalType === 'avoided') {
      if (signal.clientName) {
        const client = await this.getClientMemory(signal.clientName);
        if (client) {
          await this.upsertClientMemory({
            clientName: signal.clientName,
            avoidanceScore: (client.avoidanceScore || 0) + 1
          });
        }
      }
    }
    
    return created;
  }

  async getTaskSignals(taskId?: string, clientName?: string, signalType?: string, daysBack?: number): Promise<TaskSignal[]> {
    let query = db.select().from(taskSignals);
    const conditions: any[] = [];
    
    if (taskId) conditions.push(eq(taskSignals.taskId, taskId));
    if (clientName) conditions.push(eq(taskSignals.clientName, clientName.toLowerCase().trim()));
    if (signalType) conditions.push(eq(taskSignals.signalType, signalType));
    if (daysBack) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysBack);
      conditions.push(gte(taskSignals.createdAt, cutoff));
    }
    
    if (conditions.length > 0) {
      return db.select().from(taskSignals)
        .where(and(...conditions))
        .orderBy(desc(taskSignals.createdAt));
    }
    
    return db.select().from(taskSignals).orderBy(desc(taskSignals.createdAt));
  }

  async getAvoidedTasks(daysBack: number = 14): Promise<{ taskId: string; taskName: string; clientName: string; count: number }[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);
    
    const signals = await db.select().from(taskSignals)
      .where(and(
        gte(taskSignals.createdAt, cutoff),
        eq(taskSignals.signalType, 'deferred')
      ));
    
    // Aggregate by taskId
    const counts = new Map<string, { taskName: string; clientName: string; count: number }>();
    for (const signal of signals) {
      if (signal.taskId) {
        const key = signal.taskId;
        const existing = counts.get(key);
        if (existing) {
          existing.count++;
        } else {
          counts.set(key, { 
            taskName: signal.taskName || 'Unknown',
            clientName: signal.clientName || 'Unknown',
            count: 1 
          });
        }
      }
    }
    
    return Array.from(counts.entries())
      .map(([taskId, data]) => ({ taskId, ...data }))
      .sort((a, b) => b.count - a.count);
  }

  async getProductivityByHour(): Promise<{ hour: number; completions: number; deferrals: number }[]> {
    const signals = await db.select().from(taskSignals);
    
    const hourStats = new Map<number, { completions: number; deferrals: number }>();
    for (let h = 0; h < 24; h++) {
      hourStats.set(h, { completions: 0, deferrals: 0 });
    }
    
    for (const signal of signals) {
      if (signal.hourOfDay !== null && signal.hourOfDay !== undefined) {
        const stats = hourStats.get(signal.hourOfDay)!;
        if (signal.signalType === 'completed_fast' || signal.signalType === 'excited') {
          stats.completions++;
        } else if (signal.signalType === 'deferred' || signal.signalType === 'avoided') {
          stats.deferrals++;
        }
      }
    }
    
    return Array.from(hourStats.entries())
      .map(([hour, stats]) => ({ hour, ...stats }));
  }

  // Backlog resurfacing
  async recordBacklogEntry(entry: InsertBacklogEntry): Promise<BacklogEntry> {
    // Check if entry already exists for this task
    const [existing] = await db.select().from(backlogEntries)
      .where(and(
        eq(backlogEntries.taskId, entry.taskId),
        isNull(backlogEntries.promotedAt)
      ));
    
    if (existing) {
      // Task is already in backlog tracking, update it
      return existing;
    }
    
    const id = randomUUID();
    const [created] = await db.insert(backlogEntries)
      .values({ ...entry, id })
      .returning();
    return created;
  }

  async markBacklogPromoted(taskId: string, autoPromoted: boolean = false): Promise<void> {
    await db.update(backlogEntries)
      .set({ 
        promotedAt: new Date(),
        autoPromoted: autoPromoted ? 1 : 0
      })
      .where(and(
        eq(backlogEntries.taskId, taskId),
        isNull(backlogEntries.promotedAt)
      ));
  }

  async getActiveBacklogEntries(): Promise<BacklogEntry[]> {
    const entries = await db.select().from(backlogEntries)
      .where(isNull(backlogEntries.promotedAt))
      .orderBy(backlogEntries.enteredAt);
    
    // Calculate days in backlog
    const now = new Date();
    return entries.map(entry => ({
      ...entry,
      daysInBacklog: Math.floor((now.getTime() - new Date(entry.enteredAt).getTime()) / (1000 * 60 * 60 * 24))
    }));
  }

  async getBacklogHealth(): Promise<{ clientName: string; oldestDays: number; agingCount: number; totalCount: number; avgDays: number }[]> {
    const entries = await this.getActiveBacklogEntries();
    
    const clientStats = new Map<string, { tasks: number[]; }>();
    
    for (const entry of entries) {
      const client = entry.clientName.toLowerCase();
      if (!clientStats.has(client)) {
        clientStats.set(client, { tasks: [] });
      }
      clientStats.get(client)!.tasks.push(entry.daysInBacklog || 0);
    }
    
    return Array.from(clientStats.entries()).map(([clientName, stats]) => {
      const tasks = stats.tasks;
      const oldestDays = Math.max(...tasks, 0);
      const agingCount = tasks.filter(d => d >= 7).length;
      const avgDays = tasks.length > 0 ? Math.round(tasks.reduce((a, b) => a + b, 0) / tasks.length) : 0;
      
      return {
        clientName,
        oldestDays,
        agingCount,
        totalCount: tasks.length,
        avgDays
      };
    }).sort((a, b) => b.oldestDays - a.oldestDays);
  }

  async getAgingBacklogTasks(daysThreshold: number = 7): Promise<BacklogEntry[]> {
    const entries = await this.getActiveBacklogEntries();
    return entries.filter(entry => (entry.daysInBacklog || 0) >= daysThreshold);
  }

  async getBacklogMoveStats(daysBack: number = 7): Promise<{ backlogMoves: number; nonBacklogMoves: number }> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);
    
    const logs = await db.select().from(dailyLog)
      .where(gte(dailyLog.createdAt, cutoff));
    
    let backlogMoves = 0;
    let nonBacklogMoves = 0;
    
    for (const log of logs) {
      backlogMoves += log.backlogMovesCount || 0;
      nonBacklogMoves += log.nonBacklogMovesCount || 0;
    }
    
    return { backlogMoves, nonBacklogMoves };
  }

  async incrementBacklogMoveCount(date: string, isBacklog: boolean): Promise<void> {
    const existing = await this.getDailyLog(date);
    
    if (existing) {
      if (isBacklog) {
        await db.update(dailyLog)
          .set({ backlogMovesCount: (existing.backlogMovesCount || 0) + 1 })
          .where(eq(dailyLog.date, date));
      } else {
        await db.update(dailyLog)
          .set({ nonBacklogMovesCount: (existing.nonBacklogMovesCount || 0) + 1 })
          .where(eq(dailyLog.date, date));
      }
    } else {
      await this.createDailyLog({
        date,
        backlogMovesCount: isBacklog ? 1 : 0,
        nonBacklogMovesCount: isBacklog ? 0 : 1
      });
    }
  }

  async getWeeklyLogs(days: number = 7): Promise<DailyLog[]> {
    const logs = await db.select().from(dailyLog)
      .orderBy(desc(dailyLog.date))
      .limit(days);
    return logs;
  }

  async getTodayMetrics(): Promise<{
    date: string;
    movesCompleted: number;
    estimatedMinutes: number;
    targetMinutes: number;
    pacingPercent: number;
    clientsTouched: string[];
    backlogMoves: number;
    nonBacklogMoves: number;
  }> {
    const today = new Date().toISOString().split("T")[0];
    const log = await this.getDailyLog(today);
    
    const completedMoves = (log?.completedMoves as string[] || []);
    const clientsTouched = (log?.clientsTouched as string[] || []);
    const movesCompleted = completedMoves.length;
    const estimatedMinutes = movesCompleted * 20; // 20 min per move
    const targetMinutes = 180; // 3 hours = 180 minutes
    
    // Calculate pacing with proper clamping
    let pacingPercent = 0;
    if (targetMinutes > 0) {
      pacingPercent = Math.min(Math.round((estimatedMinutes / targetMinutes) * 100), 100);
    }
    
    return {
      date: today,
      movesCompleted,
      estimatedMinutes,
      targetMinutes,
      pacingPercent,
      clientsTouched,
      backlogMoves: log?.backlogMovesCount || 0,
      nonBacklogMoves: log?.nonBacklogMovesCount || 0,
    };
  }

  async getWeeklyMetrics(): Promise<{
    days: Array<{
      date: string;
      movesCompleted: number;
      estimatedMinutes: number;
      pacingPercent: number;
    }>;
    averageMovesPerDay: number;
    totalMoves: number;
    totalMinutes: number;
  }> {
    const logs = await this.getWeeklyLogs(7);
    const targetMinutes = 180;
    
    // Create a map of existing logs by date
    const logsByDate = new Map<string, DailyLog>();
    for (const log of logs) {
      logsByDate.set(log.date, log);
    }
    
    // Generate array of last 7 days in chronological order
    const days: Array<{
      date: string;
      movesCompleted: number;
      estimatedMinutes: number;
      pacingPercent: number;
    }> = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      
      const log = logsByDate.get(dateStr);
      const completedMoves = log ? (log.completedMoves as string[] || []) : [];
      const movesCompleted = completedMoves.length;
      const estimatedMinutes = movesCompleted * 20;
      const pacingPercent = targetMinutes > 0 
        ? Math.min(Math.round((estimatedMinutes / targetMinutes) * 100), 100)
        : 0;
      
      days.push({
        date: dateStr,
        movesCompleted,
        estimatedMinutes,
        pacingPercent,
      });
    }
    
    const totalMoves = days.reduce((sum, d) => sum + d.movesCompleted, 0);
    const totalMinutes = totalMoves * 20;
    // Average over days with actual data
    const daysWithData = days.filter(d => d.movesCompleted > 0).length;
    const averageMovesPerDay = daysWithData > 0 ? Math.round(totalMoves / daysWithData) : 0;
    
    return {
      days,
      averageMovesPerDay,
      totalMoves,
      totalMinutes,
    };
  }

  async getClientMetrics(): Promise<Array<{
    clientName: string;
    totalMoves: number;
    lastMoveAt: Date | null;
    daysSinceLastMove: number;
    sentiment: string;
    importance: string;
    tier: string;
  }>> {
    const clients = await this.getAllClients();
    const now = new Date();
    
    return clients.map(client => {
      let daysSinceLastMove = 999;
      if (client.lastMoveAt) {
        const lastMove = new Date(client.lastMoveAt);
        daysSinceLastMove = Math.floor((now.getTime() - lastMove.getTime()) / (1000 * 60 * 60 * 24));
      }
      
      return {
        clientName: client.clientName,
        totalMoves: client.totalMoves || 0,
        lastMoveAt: client.lastMoveAt,
        daysSinceLastMove,
        sentiment: client.sentiment || "neutral",
        importance: client.importance || "medium",
        tier: client.tier || "active",
      };
    });
  }

  // ============ CLIENTS (first-class entity) ============

  async createClient(client: InsertClient): Promise<Client> {
    const [created] = await db.insert(clients).values(client).returning();
    return created;
  }

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async getClientByName(name: string): Promise<Client | undefined> {
    const normalized = name.toLowerCase().trim();
    const [client] = await db.select().from(clients)
      .where(eq(clients.name, normalized));
    return client;
  }

  async getAllClientsEntity(): Promise<Client[]> {
    return db.select().from(clients)
      .where(eq(clients.isActive, 1))
      .orderBy(asc(clients.name));
  }

  async updateClient(id: number, updates: Partial<InsertClient>): Promise<Client | undefined> {
    const [updated] = await db.update(clients)
      .set(updates)
      .where(eq(clients.id, id))
      .returning();
    return updated;
  }

  async archiveClient(id: number): Promise<void> {
    await db.update(clients)
      .set({ isActive: 0 })
      .where(eq(clients.id, id));
  }

  // ============ MOVES (core work unit) ============

  async createMove(move: InsertMove): Promise<Move> {
    const [created] = await db.insert(moves).values(move).returning();
    return created;
  }

  async getMove(id: number): Promise<Move | undefined> {
    const [move] = await db.select().from(moves).where(eq(moves.id, id));
    return move;
  }

  async getMovesByStatus(status: MoveStatus): Promise<Move[]> {
    return db.select().from(moves)
      .where(eq(moves.status, status))
      .orderBy(asc(moves.sortOrder), desc(moves.createdAt));
  }

  async getMovesByClient(clientId: number): Promise<Move[]> {
    return db.select().from(moves)
      .where(eq(moves.clientId, clientId))
      .orderBy(desc(moves.createdAt));
  }

  async getAllMoves(filters?: { status?: MoveStatus; clientId?: number; includeCompleted?: boolean }): Promise<Move[]> {
    const conditions: any[] = [];
    
    if (filters?.status) {
      conditions.push(eq(moves.status, filters.status));
    } else if (!filters?.includeCompleted) {
      // By default, exclude completed moves unless explicitly asked
      conditions.push(sql`${moves.status} != 'done'`);
    }
    
    if (filters?.clientId) {
      conditions.push(eq(moves.clientId, filters.clientId));
    }
    
    if (conditions.length > 0) {
      return db.select().from(moves)
        .where(and(...conditions))
        .orderBy(asc(moves.sortOrder), desc(moves.createdAt));
    }
    
    return db.select().from(moves)
      .orderBy(asc(moves.sortOrder), desc(moves.createdAt));
  }

  async updateMove(id: number, updates: Partial<InsertMove>): Promise<Move | undefined> {
    const [updated] = await db.update(moves)
      .set(updates)
      .where(eq(moves.id, id))
      .returning();
    return updated;
  }

  async completeMove(id: number, effortActual?: number): Promise<Move | undefined> {
    const [completed] = await db.update(moves)
      .set({
        status: "done",
        completedAt: new Date(),
        effortActual: effortActual,
      })
      .where(eq(moves.id, id))
      .returning();
    return completed;
  }

  async promoteMove(id: number): Promise<Move | undefined> {
    const move = await this.getMove(id);
    if (!move) return undefined;
    
    const statusOrder: MoveStatus[] = ["backlog", "queued", "active"];
    const currentIndex = statusOrder.indexOf(move.status as MoveStatus);
    
    if (currentIndex < 0 || currentIndex >= statusOrder.length - 1) {
      return move; // Already at top or invalid status
    }
    
    const newStatus = statusOrder[currentIndex + 1];
    return this.updateMove(id, { status: newStatus });
  }

  async demoteMove(id: number): Promise<Move | undefined> {
    const move = await this.getMove(id);
    if (!move) return undefined;
    
    const statusOrder: MoveStatus[] = ["backlog", "queued", "active"];
    const currentIndex = statusOrder.indexOf(move.status as MoveStatus);
    
    if (currentIndex <= 0) {
      return move; // Already at bottom or invalid status
    }
    
    const newStatus = statusOrder[currentIndex - 1];
    return this.updateMove(id, { status: newStatus });
  }

  async deleteMove(id: number): Promise<void> {
    await db.delete(moves).where(eq(moves.id, id));
  }

  async reorderMoves(status: MoveStatus, orderedIds: number[]): Promise<void> {
    // Update sort order based on position in array
    for (let i = 0; i < orderedIds.length; i++) {
      await db.update(moves)
        .set({ sortOrder: i })
        .where(eq(moves.id, orderedIds[i]));
    }
  }
}

export const storage = new DatabaseStorage();
