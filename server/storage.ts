import { db } from "./db";
import { sessions, messages, clientMemory, dailyLog, userPatterns, taskSignals, backlogEntries, clients, moves } from "@shared/schema";
import { eq, desc, and, gte, isNull, isNotNull, sql, asc } from "drizzle-orm";
import { randomUUID } from "crypto";

export function getLocalDateString(date: Date = new Date()): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(date);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

// === Weighted Scoring Engine ===
// Quick (1): 10 mins, Standard (2): 20 mins, Chunky (3): 45 mins, Draining (4): 90 mins
export function calculateEarnedMinutes(effort: number | null, drainType: string | null): number {
  const effortMap: Record<number, number> = {
    1: 10,  // Quick
    2: 20,  // Standard
    3: 45,  // Chunky
    4: 90   // Draining (High Reward)
  };
  
  return effortMap[effort || 2] || 20;
}

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
  updateClientSentiment(clientName: string, sentiment: string): Promise<ClientMemory | undefined>;
  updateClientImportance(clientName: string, importance: string): Promise<ClientMemory | undefined>;
  getStaleClients(days?: number): Promise<ClientMemory[]>;
  
  createDailyLog(log: InsertDailyLog): Promise<DailyLog>;
  getDailyLog(date: string): Promise<DailyLog | undefined>;
  updateDailyLog(date: string, updates: Partial<DailyLog>): Promise<void>;
  addCompletedMove(date: string, move: { moveId: string; description: string; clientName: string; at: string; source?: string; earnedMinutes: number }): Promise<boolean>;
  removeCompletedMoves(date: string, moveIds: string[]): Promise<number>;
  addNotificationSent(date: string, milestone: number): Promise<void>;
  
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
    momentum: {
      trend: "up" | "down" | "stable";
      percentChange: number;
      message: string;
    };
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
  getDrainTypeMetrics(daysBack?: number): Promise<Array<{
    drainType: string;
    count: number;
    minutes: number;
    percentage: number;
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
  getAllMoves(filters?: { status?: MoveStatus; clientId?: number; excludeCompleted?: boolean }): Promise<Move[]>;
  updateMove(id: number, updates: Partial<InsertMove>): Promise<Move | undefined>;
  completeMove(id: number, effortActual?: number): Promise<Move | undefined>;
  promoteMove(id: number, targetStatus?: "active" | "queued"): Promise<Move | undefined>;
  demoteMove(id: number): Promise<Move | undefined>;
  deleteMove(id: number): Promise<void>;
  reorderMoves(status: MoveStatus, orderedIds: number[]): Promise<void>;
  rebalanceClientPipeline(clientId: number, preserveMoveId?: number): Promise<void>;
  
  demoteStaleActiveMoves(): Promise<string[]>;
  backfillSignals(): Promise<string>;
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

  async updateClientSentiment(clientName: string, sentiment: string): Promise<ClientMemory | undefined> {
    const normalized = clientName.toLowerCase().trim();
    const existing = await this.getClientMemory(normalized);
    
    if (existing) {
      const [updated] = await db.update(clientMemory)
        .set({ sentiment, updatedAt: new Date() })
        .where(eq(clientMemory.id, existing.id))
        .returning();
      return updated;
    }
    return undefined;
  }

  async updateClientImportance(clientName: string, importance: string): Promise<ClientMemory | undefined> {
    const normalized = clientName.toLowerCase().trim();
    const existing = await this.getClientMemory(normalized);
    
    if (existing) {
      const [updated] = await db.update(clientMemory)
        .set({ importance, updatedAt: new Date() })
        .where(eq(clientMemory.id, existing.id))
        .returning();
      return updated;
    }
    return undefined;
  }

  async getStaleClients(days: number = 2): Promise<ClientMemory[]> {
    const allClients = await this.getAllClients();
    const now = new Date();
    
    // Get internal entities to exclude from stale checks
    const clientEntities = await this.getAllClientsEntity();
    const internalNames = new Set(
      clientEntities
        .filter(c => c.type === "internal")
        .map(c => c.name.toLowerCase())
    );
    
    return allClients.filter(client => {
      // Skip internal entities (Revenue, General Admin, etc.)
      if (internalNames.has(client.clientName.toLowerCase())) return false;
      
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

  async addCompletedMove(date: string, move: { moveId: string; description: string; clientName: string; at: string; source?: string; earnedMinutes: number }): Promise<boolean> {
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
      ? (existing.completedMoves as Array<{ moveId: string; description: string; clientName: string; at: string; source?: string; earnedMinutes?: number }>)
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

  async addNotificationSent(date: string, milestone: number): Promise<void> {
    const existing = await this.getDailyLog(date);
    if (!existing) {
      await this.createDailyLog({ date, notificationsSent: [milestone] } as InsertDailyLog);
      return;
    }

    const sent = Array.isArray(existing.notificationsSent) 
      ? (existing.notificationsSent as number[])
      : [];
    
    if (!sent.includes(milestone)) {
      sent.push(milestone);
      await db.update(dailyLog)
        .set({ notificationsSent: sent })
        .where(eq(dailyLog.date, date));
    }
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
    // 1. Get "Deferral" signals from the new learning system
    const signals = await db.select().from(taskSignals);

    // 2. Get ALL historical completed moves (Source of Truth)
    // FIX: Filter by STATUS, not timestamp, to catch legacy data with null completedAt
    const completedMoves = await db.select().from(moves)
      .where(eq(moves.status, "done"));

    // Initialize 24-hour buckets
    const hourStats = new Map<number, { completions: number; deferrals: number }>();
    for (let h = 0; h < 24; h++) {
      hourStats.set(h, { completions: 0, deferrals: 0 });
    }
    
    // Fill Deferrals from Signals
    for (const signal of signals) {
      if (signal.hourOfDay !== null && signal.hourOfDay !== undefined) {
        const stats = hourStats.get(signal.hourOfDay);
        if (stats && (signal.signalType === 'deferred' || signal.signalType === 'avoided')) {
          stats.deferrals++;
        }
      }
    }

    // Fill Completions from Actual Moves (with Fallback Logic)
    for (const move of completedMoves) {
      // FIX: Use completedAt -> updatedAt -> createdAt
      const timestamp = move.completedAt || move.updatedAt || move.createdAt;
      
      if (timestamp) {
        const date = new Date(timestamp);
        // Force Eastern Time extraction to match your "Jeremys-Life" context
        const hourStr = date.toLocaleString('en-US', { 
          timeZone: 'America/New_York', 
          hour: 'numeric', 
          hour12: false 
        });
        
        // Handle "24" edge case if API returns it, strictly 0-23
        const hour = parseInt(hourStr) % 24;
        
        const stats = hourStats.get(hour);
        if (stats) {
          stats.completions++;
        }
      }
    }
    
    return Array.from(hourStats.entries())
      .map(([hour, stats]) => ({ hour, ...stats }))
      .sort((a, b) => a.hour - b.hour);
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

  async getBacklogHealth(): Promise<{ clientName: string; oldestDays: number; agingCount: number; totalCount: number; avgDays: number; isEmpty: boolean }[]> {
    // 1. Get all active clients - we want to show ALL clients, even those with 0 backlog
    const allClients = await this.getAllClientsEntity();
    
    // 2. Get ALL moves that are currently in backlog (Source of Truth)
    const backlogMoves = await db.select().from(moves)
      .where(eq(moves.status, "backlog"));

    // 3. Get precise "entered backlog" timestamps if available
    const entries = await db.select().from(backlogEntries)
      .where(isNull(backlogEntries.promotedAt));
    
    const entryMap = new Map<string, Date>();
    entries.forEach(e => entryMap.set(e.taskId, e.enteredAt));

    // Initialize all active clients with empty stats
    const clientStats = new Map<string, { ages: number[] }>();
    for (const client of allClients) {
      clientStats.set(client.name, { ages: [] });
    }

    const now = new Date();

    for (const move of backlogMoves) {
      if (!move.clientId) continue;
      
      const client = allClients.find(c => c.id === move.clientId);
      if (!client) continue;
      
      const clientName = client.name;
      
      // Determine age: Use precise "entered backlog" time if we have it,
      // otherwise fall back to the Move's creation date.
      const startDate = entryMap.get(String(move.id)) || move.createdAt;
      const daysOld = Math.floor((now.getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
      
      clientStats.get(clientName)!.ages.push(daysOld);
    }

    // 4. Aggregate stats - include ALL clients
    return Array.from(clientStats.entries()).map(([clientName, stats]) => {
      const ages = stats.ages;
      const oldestDays = ages.length > 0 ? Math.max(...ages) : 0;
      const agingCount = ages.filter(d => d >= 7).length;
      const totalCount = ages.length;
      const avgDays = totalCount > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / totalCount) : 0;
      const isEmpty = totalCount === 0;

      return {
        clientName,
        oldestDays,
        agingCount,
        totalCount,
        avgDays,
        isEmpty
      };
    }).sort((a, b) => {
      // Sort: Empty backlogs first (unhealthy), then by oldest days descending
      if (a.isEmpty !== b.isEmpty) return a.isEmpty ? -1 : 1;
      return b.oldestDays - a.oldestDays;
    });
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
    const today = getLocalDateString();
    const log = await this.getDailyLog(today);
    
    const completedMoves = (log?.completedMoves as Array<{ earnedMinutes?: number }> || []);
    const clientsTouched = (log?.clientsTouched as string[] || []);
    const movesCompleted = completedMoves.length;
    
    // Sum weighted minutes (using earnedMinutes from each move, fallback to 20)
    const estimatedMinutes = completedMoves.reduce((sum, m) => sum + (m.earnedMinutes || 20), 0);
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
    momentum: {
      trend: "up" | "down" | "stable";
      percentChange: number;
      message: string;
    };
  }> {
    const targetMinutes = 180;
    
    // 1. Get "Today" as a string in NY Time (YYYY-MM-DD)
    // This is our Anchor of Truth.
    const todayStr = getLocalDateString(new Date());
    
    // 2. Convert to a UTC Midnight Date Object to do math safely
    // (We treat this abstractly as "The Current Date", ignoring hours)
    const anchorDate = new Date(`${todayStr}T00:00:00Z`);
    
    // 3. Calculate Days to Subtract to reach Monday
    // getUTCDay() is safe here because we forced it to Z (UTC) above
    const dayOfWeek = anchorDate.getUTCDay(); // 0=Sun, 1=Mon, etc.
    const daysToMonday = (dayOfWeek + 6) % 7;
    
    // 4. Determine "Current Week Monday"
    const currentMonday = new Date(anchorDate);
    currentMonday.setUTCDate(anchorDate.getUTCDate() - daysToMonday);
    
    // 5. Determine "Previous Week Monday"
    const prevMonday = new Date(currentMonday);
    prevMonday.setUTCDate(currentMonday.getUTCDate() - 7);
    
    // Fetch logs using the string representation of Prev Monday
    // We construct the YYYY-MM-DD string manually to avoid timezone shifts
    const prevMondayStr = prevMonday.toISOString().split('T')[0];
    
    const logs = await db.select().from(dailyLog)
      .where(gte(dailyLog.date, prevMondayStr))
      .orderBy(desc(dailyLog.date));

    const logsByDate = new Map<string, DailyLog>();
    for (const log of logs) {
      logsByDate.set(log.date, log);
    }
    
    // 6. Build Current Week Data (Strictly Mon -> Sun)
    const days: Array<{
      date: string;
      movesCompleted: number;
      estimatedMinutes: number;
      pacingPercent: number;
    }> = [];
    let currentWeekMinutes = 0;
    let currentWeekMoves = 0;
    let activeDaysCount = 0;
    let highImpactMinutes = 0;

    for (let i = 0; i < 7; i++) {
      // Create date: Monday + i days
      const d = new Date(currentMonday);
      d.setUTCDate(currentMonday.getUTCDate() + i);
      
      // Extract YYYY-MM-DD safely
      const dateStr = d.toISOString().split('T')[0];
      
      const log = logsByDate.get(dateStr);
      const movesArr = (log?.completedMoves as Array<{ earnedMinutes?: number }>) || [];
      const dailyMinutes = movesArr.reduce((sum, m) => sum + (m.earnedMinutes || 20), 0);
      
      // Impact Calculation: Count minutes from "Chunky" (45m) or "Draining" (90m) tasks
      const dailyHighImpact = movesArr
        .filter(m => (m.earnedMinutes || 0) >= 45)
        .reduce((sum, m) => sum + (m.earnedMinutes || 0), 0);
        
      highImpactMinutes += dailyHighImpact;

      if (movesArr.length > 0) activeDaysCount++;
      
      days.push({
        date: dateStr,
        movesCompleted: movesArr.length,
        estimatedMinutes: dailyMinutes,
        pacingPercent: Math.min(Math.round((dailyMinutes / targetMinutes) * 100), 100)
      });
      
      currentWeekMinutes += dailyMinutes;
      currentWeekMoves += movesArr.length;
    }

    // 7. MULTIFACTORIAL MOMENTUM SCORE (0-100)
    
    // A. Velocity (40%): Target 15 hours (900 mins) / week
    const velocityScore = Math.min((currentWeekMinutes / 900) * 100, 100);
    
    // B. Consistency (30%): Target 5 active days / week
    const consistencyScore = Math.min((activeDaysCount / 5) * 100, 100);
    
    // C. Impact (30%): Target 50% of time spent on Deep/High-Value work
    const impactRatio = currentWeekMinutes > 0 ? (highImpactMinutes / currentWeekMinutes) : 0;
    const impactScore = Math.min((impactRatio / 0.5) * 100, 100);

    // Weighted Final Score
    const rawScore = (velocityScore * 0.4) + (consistencyScore * 0.3) + (impactScore * 0.3);
    const momentumScore = Math.round(rawScore);

    let trend: "up" | "down" | "stable" = "stable";
    let message = "Building steam";

    if (momentumScore >= 80) {
      trend = "up";
      message = "Unstoppable Flow";
    } else if (momentumScore >= 60) {
      trend = "stable";
      message = "Solid Performance";
    } else if (momentumScore >= 40) {
      trend = "stable";
      message = "Gaining Traction";
    } else {
      trend = "down";
      message = "Recovery Mode";
    }

    const daysWithData = days.filter(d => d.movesCompleted > 0).length;
    
    return {
      days,
      averageMovesPerDay: daysWithData > 0 ? Math.round(currentWeekMoves / daysWithData) : 0,
      totalMoves: currentWeekMoves,
      totalMinutes: currentWeekMinutes,
      momentum: { 
        trend, 
        percentChange: momentumScore,
        message 
      }
    };
  }

  async backfillSignals(): Promise<string> {
    // FIX: Also update this to capture legacy tasks for backfilling
    const completedMoves = await db.select().from(moves)
      .where(eq(moves.status, "done"));

    let createdCount = 0;

    for (const move of completedMoves) {
      // Use fallback timestamp here too
      const timestamp = move.completedAt || move.updatedAt || move.createdAt;
      if (!timestamp) continue;

      // Check if signal exists
      const existing = await db.select().from(taskSignals)
        .where(eq(taskSignals.taskId, String(move.id)));
        
      if (existing.length === 0) {
        const date = new Date(timestamp);
        const hourStr = date.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false });
        const hour = parseInt(hourStr) % 24;
        const day = date.getDay();

        const id = randomUUID();
        await db.insert(taskSignals).values({
          id,
          taskId: String(move.id),
          taskName: move.title,
          clientName: "Backfill",
          signalType: "completed_fast",
          hourOfDay: hour,
          dayOfWeek: day,
          createdAt: date
        });
        createdCount++;
      }
    }
    return `Backfilled ${createdCount} signals from ${completedMoves.length} historical moves.`;
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
    const allClients = await this.getAllClientsEntity();
    const memories = await this.getAllClients();
    const memoryMap = new Map(memories.map(m => [m.clientName.toLowerCase(), m]));
    const now = new Date();

    const metrics = await Promise.all(allClients.map(async (client) => {
      const completedMoves = await db.select().from(moves)
        .where(and(
          eq(moves.clientId, client.id),
          eq(moves.status, "done")
        ))
        .orderBy(desc(moves.completedAt));
        
      const lastMove = completedMoves[0];
      const totalMoves = completedMoves.length;
      
      let daysSinceLastMove = 999;
      if (lastMove?.completedAt) {
        const lastDate = new Date(lastMove.completedAt);
        daysSinceLastMove = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      } else {
        const createdDate = new Date(client.createdAt);
        daysSinceLastMove = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
      }
      
      const memory = memoryMap.get(client.name.toLowerCase());
      
      return {
        clientName: client.name,
        totalMoves,
        lastMoveAt: lastMove?.completedAt || null,
        daysSinceLastMove,
        sentiment: memory?.sentiment || "neutral",
        importance: memory?.importance || "medium",
        tier: memory?.tier || "active",
      };
    }));
    
    return metrics.sort((a, b) => b.daysSinceLastMove - a.daysSinceLastMove);
  }

  async getDrainTypeMetrics(daysBack: number = 30): Promise<Array<{
    drainType: string;
    count: number;
    minutes: number;
    percentage: number;
  }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    
    const completedMoves = await db.select().from(moves)
      .where(eq(moves.status, "done"));
    
    const drainCounts = new Map<string, number>();
    let total = 0;
    
    for (const move of completedMoves) {
      if (move.completedAt && new Date(move.completedAt) >= startDate) {
        const drainType = move.drainType || "unset";
        drainCounts.set(drainType, (drainCounts.get(drainType) || 0) + 1);
        total++;
      }
    }
    
    return Array.from(drainCounts.entries())
      .map(([drainType, count]) => ({
        drainType,
        count,
        minutes: count * 20,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
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
    
    // Track backlog entry when move is created in backlog
    if (created.status === 'backlog') {
      const client = created.clientId ? await this.getClient(created.clientId) : null;
      await this.recordBacklogEntry({
        taskId: String(created.id),
        taskName: created.title,
        clientName: client?.name || 'Unknown',
      });
    }
    
    // Enforce 1 active + 1 queued per client rule
    if (created.clientId && (created.status === 'active' || created.status === 'queued')) {
      await this.rebalanceClientPipeline(created.clientId, created.id);
    }
    
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

  async getAllMoves(filters?: { status?: MoveStatus; clientId?: number; excludeCompleted?: boolean }): Promise<Move[]> {
    const conditions: any[] = [];
    
    if (filters?.status) {
      conditions.push(eq(moves.status, filters.status));
    } else if (filters?.excludeCompleted) {
      // Only exclude completed moves if explicitly requested
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
    const oldMove = await this.getMove(id);
    
    // Prepare update object - FORCE update timestamp
    const valuesToSet: any = { 
      ...updates,
      updatedAt: new Date() 
    };
    
    // If moving OUT of 'done' status, clear the completedAt timestamp and effortActual
    if (oldMove?.status === 'done' && updates.status && updates.status !== 'done') {
      valuesToSet.completedAt = null;
      valuesToSet.effortActual = null;
    }
    
    const [updated] = await db.update(moves)
      .set(valuesToSet)
      .where(eq(moves.id, id))
      .returning();
    
    // Track backlog entry when move enters backlog
    if (updated && updates.status === 'backlog' && oldMove?.status !== 'backlog') {
      const client = updated.clientId ? await this.getClient(updated.clientId) : null;
      await this.recordBacklogEntry({
        taskId: String(updated.id),
        taskName: updated.title,
        clientName: client?.name || 'Unknown',
      });
    }
    
    // Track promotion when move leaves backlog
    if (updated && oldMove?.status === 'backlog' && updates.status && updates.status !== 'backlog') {
      await this.markBacklogPromoted(String(id));
    }
    
    return updated;
  }

  async completeMove(id: number, effortActual?: number): Promise<Move | undefined> {
    const move = await this.getMove(id);
    const now = new Date();
    
    const [completed] = await db.update(moves)
      .set({
        status: "done",
        completedAt: now,
        effortActual: effortActual,
      })
      .where(eq(moves.id, id))
      .returning();
    
    // Record task signal for productivity tracking
    if (completed) {
      const client = completed.clientId ? await this.getClient(completed.clientId) : null;
      const hourET = parseInt(now.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }));
      // Get day of week (0 = Sunday, 6 = Saturday)
      const etDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const dayOfWeek = etDate.getDay();
      
      await this.recordSignal({
        taskId: String(completed.id),
        taskName: completed.title,
        clientName: client?.name || 'Unknown',
        signalType: 'completed_fast',
        hourOfDay: hourET,
        dayOfWeek: dayOfWeek,
      });
      
      // If was in backlog, mark it promoted
      if (move?.status === 'backlog') {
        await this.markBacklogPromoted(String(id));
      }
    }
    
    return completed;
  }

  async promoteMove(id: number, targetStatus?: "active" | "queued"): Promise<Move | undefined> {
    const move = await this.getMove(id);
    if (!move) return undefined;
    
    const statusOrder: MoveStatus[] = ["backlog", "queued", "active"];
    const currentIndex = statusOrder.indexOf(move.status as MoveStatus);
    
    if (currentIndex < 0 || currentIndex >= statusOrder.length - 1) {
      return move; // Already at top or invalid status
    }
    
    // If target specified, jump directly to it (if it's higher in pipeline)
    let newStatus: MoveStatus;
    if (targetStatus) {
      const targetIndex = statusOrder.indexOf(targetStatus);
      if (targetIndex > currentIndex) {
        newStatus = targetStatus;
      } else {
        newStatus = statusOrder[currentIndex + 1];
      }
    } else {
      newStatus = statusOrder[currentIndex + 1];
    }
    
    const updatedMove = await this.updateMove(id, { status: newStatus });
    
    // Enforce 1 active + 1 queued per client rule
    if (move.clientId) {
      await this.rebalanceClientPipeline(move.clientId, id);
    }
    
    return updatedMove;
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
  
  /**
   * Enforces the "1 active + 1 queued per client" rule.
   * Ensures exactly 1 active and 1 queued move per client.
   * The preserved move (newest/just-created/promoted) takes priority.
   * @param clientId The client to rebalance
   * @param preserveMoveId The move ID to preserve (won't be demoted) - usually the just-created or promoted move
   */
  async rebalanceClientPipeline(clientId: number, preserveMoveId?: number): Promise<void> {
    if (!clientId) return;
    
    const clientMoves = await this.getMovesByClient(clientId);
    
    // Get active moves sorted by newest first
    const activeMoves = clientMoves
      .filter(m => m.status === 'active')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Keep exactly 1 active move: prefer preserveMoveId if active, else keep newest
    if (activeMoves.length > 1) {
      const preservedIsActive = activeMoves.some(m => m.id === preserveMoveId);
      let keptActiveId: number | null = null;
      
      for (const move of activeMoves) {
        // Determine which one to keep
        if (preservedIsActive && move.id === preserveMoveId) {
          keptActiveId = move.id;
          continue; // Keep the preserved move
        }
        if (!preservedIsActive && keptActiveId === null) {
          keptActiveId = move.id;
          continue; // Keep the first (newest) if preserved isn't active
        }
        if (move.id === keptActiveId) {
          continue; // Already decided to keep this one
        }
        // Demote all others to queued
        await this.updateMove(move.id, { status: 'queued' });
      }
    }
    
    // Re-fetch to get updated queued list after active demotion
    const updatedMoves = await this.getMovesByClient(clientId);
    const queuedMoves = updatedMoves
      .filter(m => m.status === 'queued')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Keep exactly 1 queued move: prefer preserveMoveId if queued, else keep newest
    if (queuedMoves.length > 1) {
      const preservedIsQueued = queuedMoves.some(m => m.id === preserveMoveId);
      let keptQueuedId: number | null = null;
      
      for (const move of queuedMoves) {
        // Determine which one to keep
        if (preservedIsQueued && move.id === preserveMoveId) {
          keptQueuedId = move.id;
          continue; // Keep the preserved move
        }
        if (!preservedIsQueued && keptQueuedId === null) {
          keptQueuedId = move.id;
          continue; // Keep the first (newest) if preserved isn't queued
        }
        if (move.id === keptQueuedId) {
          continue; // Already decided to keep this one
        }
        // Demote all others to backlog
        await this.updateMove(move.id, { status: 'backlog' });
      }
    }
  }

  async deleteMove(id: number): Promise<void> {
    await db.delete(moves).where(eq(moves.id, id));
  }

  async reorderMoves(status: MoveStatus, orderedIds: number[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.update(moves)
        .set({ sortOrder: i })
        .where(eq(moves.id, orderedIds[i]));
    }
  }

  async demoteStaleActiveMoves(): Promise<string[]> {
    const activeMoves = await db.select().from(moves).where(
      eq(moves.status, "active")
    );

    const demotedTitles: string[] = [];
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    for (const move of activeMoves) {
      // CRITICAL FIX: Check updatedAt (last touched) instead of createdAt
      // If updatedAt doesn't exist yet (legacy tasks), fall back to createdAt
      const lastActive = move.updatedAt || move.createdAt;
      const lastActiveDate = new Date(lastActive);

      // Only demote if it hasn't been touched since BEFORE today
      if (lastActiveDate < startOfToday) {
        await this.updateMove(move.id, { status: 'queued' });
        demotedTitles.push(move.title);
      }
    }

    return demotedTitles;
  }
}

export const storage = new DatabaseStorage();
