
import {
  type IStorage,
  getLocalDateString
} from "../server/storage";
import {
  type Session, type InsertSession,
  type Message, type InsertMessage,
  type ClientMemory, type InsertClientMemory,
  type DailyLog, type InsertDailyLog,
  type UserPattern, type InsertUserPattern,
  type TaskSignal, type InsertTaskSignal,
  type BacklogEntry, type InsertBacklogEntry,
  type Client, type InsertClient,
  type Move, type InsertMove,
  type MoveStatus
} from "../shared/schema";
import express from "express";
import { registerRoutes } from "../server/routes";
import { randomUUID } from "crypto";

// Minimal in-memory storage implementation for testing
class MemStorage implements IStorage {
  sessions = new Map<string, Session>();
  messages = new Map<string, Message>();
  clients = new Map<number, Client>();
  moves = new Map<number, Move>();
  dailyLogs = new Map<string, DailyLog>();

  clientIdCounter = 1;
  moveIdCounter = 1;

  async createSession(session: InsertSession): Promise<Session> {
    const id = randomUUID();
    const newSession: Session = {
      id,
      createdAt: new Date(),
      lastActiveAt: new Date(),
      ...session
    };
    this.sessions.set(id, newSession);
    return newSession;
  }

  async getSession(id: string): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  async updateSessionActivity(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      session.lastActiveAt = new Date();
    }
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const newMessage: Message = {
      id,
      timestamp: new Date(),
      taskCard: null,
      ...message
    };
    this.messages.set(id, newMessage);
    return newMessage;
  }

  async getMessages(sessionId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(m => m.sessionId === sessionId);
  }

  async getSessionMessages(sessionId: string, limit?: number): Promise<Message[]> {
    const msgs = await this.getMessages(sessionId);
    if (limit) return msgs.slice(-limit);
    return msgs;
  }

  // --- Clients ---
  async createClient(client: InsertClient): Promise<Client> {
    const id = this.clientIdCounter++;
    const newClient: Client = {
      id,
      isActive: 1,
      createdAt: new Date(),
      color: null,
      ...client
    };
    this.clients.set(id, newClient);
    return newClient;
  }

  async getClient(id: number): Promise<Client | undefined> {
    return this.clients.get(id);
  }

  async getClientByName(name: string): Promise<Client | undefined> {
    return Array.from(this.clients.values()).find(c => c.name.toLowerCase() === name.toLowerCase().trim());
  }

  async getAllClientsEntity(): Promise<Client[]> {
    return Array.from(this.clients.values()).filter(c => c.isActive === 1);
  }

  async updateClient(id: number, updates: Partial<InsertClient>): Promise<Client | undefined> {
    const client = this.clients.get(id);
    if (!client) return undefined;
    const updated = { ...client, ...updates };
    this.clients.set(id, updated);
    return updated;
  }

  async archiveClient(id: number): Promise<void> {
    const client = this.clients.get(id);
    if (client) {
      client.isActive = 0;
    }
  }

  // --- Moves ---
  async createMove(move: InsertMove): Promise<Move> {
    const id = this.moveIdCounter++;
    const newMove: Move = {
      id,
      status: "backlog",
      effortEstimate: 2,
      sortOrder: 0,
      createdAt: new Date(),
      completedAt: null,
      effortActual: null,
      description: null,
      drainType: null,
      clientId: null,
      ...move
    };
    this.moves.set(id, newMove);

    if (newMove.clientId && (newMove.status === 'active' || newMove.status === 'queued')) {
      await this.rebalanceClientPipeline(newMove.clientId, newMove.id);
    }

    return newMove;
  }

  async getMove(id: number): Promise<Move | undefined> {
    return this.moves.get(id);
  }

  async getMovesByStatus(status: MoveStatus): Promise<Move[]> {
    return Array.from(this.moves.values())
      .filter(m => m.status === status)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getMovesByClient(clientId: number): Promise<Move[]> {
    return Array.from(this.moves.values())
      .filter(m => m.clientId === clientId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getAllMoves(filters?: { status?: MoveStatus; clientId?: number; includeCompleted?: boolean }): Promise<Move[]> {
    let moves = Array.from(this.moves.values());
    if (filters?.status) {
      moves = moves.filter(m => m.status === filters.status);
    } else if (!filters?.includeCompleted) {
      moves = moves.filter(m => m.status !== 'done');
    }
    if (filters?.clientId) {
      moves = moves.filter(m => m.clientId === filters.clientId);
    }
    return moves.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateMove(id: number, updates: Partial<InsertMove>): Promise<Move | undefined> {
    const move = this.moves.get(id);
    if (!move) return undefined;

    const oldStatus = move.status;

    // Logic for transitioning out of done
    if (oldStatus === 'done' && updates.status && updates.status !== 'done') {
      move.completedAt = null;
      move.effortActual = null;
    }

    Object.assign(move, updates);

    // Promote logic
    if (updates.status && updates.status !== 'backlog' && oldStatus === 'backlog') {
       await this.markBacklogPromoted(String(id));
    }

    return move;
  }

  async completeMove(id: number, effortActual?: number): Promise<Move | undefined> {
    const move = this.moves.get(id);
    if (!move) return undefined;
    move.status = "done";
    move.completedAt = new Date();
    move.effortActual = effortActual || null;
    return move;
  }

  async promoteMove(id: number): Promise<Move | undefined> {
    const move = await this.getMove(id);
    if (!move) return undefined;

    const statusOrder: MoveStatus[] = ["backlog", "queued", "active"];
    const currentIndex = statusOrder.indexOf(move.status as MoveStatus);

    if (currentIndex < 0 || currentIndex >= statusOrder.length - 1) {
      return move;
    }

    const newStatus = statusOrder[currentIndex + 1];
    const updated = await this.updateMove(id, { status: newStatus });

    if (move.clientId) {
      await this.rebalanceClientPipeline(move.clientId, id);
    }
    return updated;
  }

  async demoteMove(id: number): Promise<Move | undefined> {
    const move = await this.getMove(id);
    if (!move) return undefined;

    const statusOrder: MoveStatus[] = ["backlog", "queued", "active"];
    const currentIndex = statusOrder.indexOf(move.status as MoveStatus);

    if (currentIndex <= 0) {
      return move;
    }

    const newStatus = statusOrder[currentIndex - 1];
    return this.updateMove(id, { status: newStatus });
  }

  async deleteMove(id: number): Promise<void> {
    this.moves.delete(id);
  }

  async reorderMoves(status: MoveStatus, orderedIds: number[]): Promise<void> {
    // simplified
  }

  async demoteStaleActiveMoves(): Promise<string[]> {
    return [];
  }

  // --- Pipeline Logic Replication ---
  async rebalanceClientPipeline(clientId: number, preserveMoveId?: number): Promise<void> {
    const clientMoves = await this.getMovesByClient(clientId);

    const activeMoves = clientMoves
      .filter(m => m.status === 'active')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (activeMoves.length > 1) {
      const preservedIsActive = activeMoves.some(m => m.id === preserveMoveId);
      let keptActiveId: number | null = null;

      for (const move of activeMoves) {
        if (preservedIsActive && move.id === preserveMoveId) {
          keptActiveId = move.id;
          continue;
        }
        if (!preservedIsActive && keptActiveId === null) {
          keptActiveId = move.id;
          continue;
        }
        if (move.id === keptActiveId) {
          continue;
        }
        move.status = 'queued';
      }
    }

    // Update queued
    const updatedMoves = await this.getMovesByClient(clientId);
    const queuedMoves = updatedMoves
      .filter(m => m.status === 'queued')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

     if (queuedMoves.length > 1) {
      const preservedIsQueued = queuedMoves.some(m => m.id === preserveMoveId);
      let keptQueuedId: number | null = null;

      for (const move of queuedMoves) {
        if (preservedIsQueued && move.id === preserveMoveId) {
          keptQueuedId = move.id;
          continue;
        }
        if (!preservedIsQueued && keptQueuedId === null) {
          keptQueuedId = move.id;
          continue;
        }
        if (move.id === keptQueuedId) {
          continue;
        }
        move.status = 'backlog';
      }
    }
  }

  // --- Metrics / Logs ---
  async createDailyLog(log: InsertDailyLog): Promise<DailyLog> {
     const id = randomUUID();
     const newLog: DailyLog = {
       id,
       completedMoves: [],
       clientsTouched: [],
       clientsSkipped: [],
       summary: null,
       backlogMovesCount: 0,
       nonBacklogMovesCount: 0,
       createdAt: new Date(),
       ...log
     };
     this.dailyLogs.set(log.date, newLog);
     return newLog;
  }

  async getDailyLog(date: string): Promise<DailyLog | undefined> {
    return this.dailyLogs.get(date);
  }

  async updateDailyLog(date: string, updates: Partial<DailyLog>): Promise<void> {
    const log = this.dailyLogs.get(date);
    if (log) {
      Object.assign(log, updates);
    }
  }

  async addCompletedMove(date: string, move: { moveId: string; description: string; clientName: string; at: string; source?: string }): Promise<boolean> {
    let existing = await this.getDailyLog(date);
    if (!existing) {
      existing = await this.createDailyLog({ date });
    }

    // @ts-ignore
    const completedMoves = existing.completedMoves || [];
    // @ts-ignore
    completedMoves.push(move);

    // @ts-ignore
    existing.completedMoves = completedMoves;
    return true;
  }

  async removeCompletedMoves(date: string, moveIds: string[]): Promise<number> {
     const existing = await this.getDailyLog(date);
     if (!existing) return 0;
     // simplified
     return 0;
  }

  async getTodayMetrics(): Promise<any> {
    return {
      date: getLocalDateString(),
      movesCompleted: 0,
      estimatedMinutes: 0,
      targetMinutes: 180,
      pacingPercent: 0,
      clientsTouched: [],
      backlogMoves: 0,
      nonBacklogMoves: 0
    };
  }

  async getWeeklyMetrics(): Promise<any> { return {}; }
  async getClientMetrics(): Promise<any> { return []; }
  async getDrainTypeMetrics(daysBack?: number): Promise<any> { return []; }

  // --- Stubs for other methods ---
  async getClientMemory(clientName: string) { return undefined; }
  async getAllClients() { return []; }
  async upsertClientMemory(client: any) { return {} as any; }
  async updateClientMove() {}
  async updateClientSentiment() { return undefined; }
  async updateClientImportance() { return undefined; }
  async getStaleClients() { return []; }

  async recordPattern(pattern: any) { return {} as any; }
  async getPatterns() { return []; }
  async updatePatternConfidence() {}

  async recordSignal(signal: any) { return {} as any; }
  async getTaskSignals() { return []; }
  async getAvoidedTasks() { return []; }
  async getProductivityByHour() { return []; }

  async recordBacklogEntry(entry: any) { return {} as any; }
  async markBacklogPromoted() {}
  async getActiveBacklogEntries() { return []; }
  async getBacklogHealth() { return []; }
  async getAgingBacklogTasks() { return []; }
  async getBacklogMoveStats() { return { backlogMoves: 0, nonBacklogMoves: 0 }; }
  async incrementBacklogMoveCount() {}
  async getWeeklyLogs() { return []; }
}

async function runTests() {
  const app = express();
  app.use(express.json()); // Essential for POST requests
  const storage = new MemStorage();
  const server = await registerRoutes(app, storage);

  const port = 5555;
  const baseUrl = `http://localhost:${port}`;

  await new Promise<void>((resolve) => server.listen(port, resolve));
  console.log(`Test server running on ${baseUrl}`);

  const assert = (condition: boolean, msg: string) => {
    if (!condition) {
      console.error(`❌ FAILED: ${msg}`);
      process.exit(1);
    } else {
      console.log(`✅ PASSED: ${msg}`);
    }
  };

  try {
    // TEST 1: Health Check
    console.log("\n--- TEST 1: Health Check ---");
    const health = await fetch(`${baseUrl}/api/health`).then(r => r.json());
    assert(health.status === "ok", "Health check status is ok");

    // TEST 2: Client Lifecycle
    console.log("\n--- TEST 2: Client Lifecycle ---");
    // Create Client
    const clientRes = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test Client", type: "client", isActive: 1 })
    });
    assert(clientRes.status === 201, "Create client status 201");
    const client = await clientRes.json();
    assert(client.name === "Test Client", "Client name matches");

    // Get Clients
    const clientsRes = await fetch(`${baseUrl}/api/clients`);
    const clients = await clientsRes.json();
    assert(clients.length === 1, "Should have 1 client");
    assert(clients[0].id === client.id, "Client ID matches");

    // TEST 3: Move Lifecycle & Pipeline
    console.log("\n--- TEST 3: Move Lifecycle & Pipeline Rules ---");
    // Create Active Move 1
    const move1Res = await fetch(`${baseUrl}/api/moves`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Move 1",
        clientId: client.id,
        status: "active",
        effortEstimate: 2
      })
    });
    const move1 = await move1Res.json();
    assert(move1.status === "active", "Move 1 is active");

    // Create Active Move 2 (Should bump Move 1 to queued)
    const move2Res = await fetch(`${baseUrl}/api/moves`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Move 2",
        clientId: client.id,
        status: "active",
        effortEstimate: 2
      })
    });
    const move2 = await move2Res.json();
    assert(move2.status === "active", "Move 2 is active");

    // Verify Move 1 was demoted
    const getMove1Res = await fetch(`${baseUrl}/api/moves/${move1.id}`);
    const updatedMove1 = await getMove1Res.json();
    assert(updatedMove1.status === "queued", "Move 1 demoted to queued");

    // Create Active Move 3 (Should bump Move 2 to queued, Move 1 to backlog)
    const move3Res = await fetch(`${baseUrl}/api/moves`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Move 3",
        clientId: client.id,
        status: "active",
        effortEstimate: 2
      })
    });
    const move3 = await move3Res.json();
    assert(move3.status === "active", "Move 3 is active");

    const getMove2Res = await fetch(`${baseUrl}/api/moves/${move2.id}`);
    const updatedMove2 = await getMove2Res.json();
    assert(updatedMove2.status === "queued", "Move 2 demoted to queued");

    const getMove1ResAgain = await fetch(`${baseUrl}/api/moves/${move1.id}`);
    const updatedMove1Again = await getMove1ResAgain.json();
    assert(updatedMove1Again.status === "backlog", "Move 1 demoted to backlog");

    // TEST 4: Completing a Move
    console.log("\n--- TEST 4: Completion ---");
    const completeRes = await fetch(`${baseUrl}/api/moves/${move3.id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ effortActual: 3 })
    });
    const completedMove = await completeRes.json();
    assert(completedMove.status === "done", "Move 3 is done");
    assert(completedMove.effortActual === 3, "Effort actual recorded");

    // Verify daily log update
    const today = getLocalDateString();
    const metricsRes = await fetch(`${baseUrl}/api/metrics/today`);
    const metrics = await metricsRes.json();
    // In our mock, getTodayMetrics just returns stub, but let's check if storage has log
    const log = await storage.getDailyLog(today);
    // @ts-ignore
    assert(log?.completedMoves.length === 1, "Daily log has 1 completed move");
    // @ts-ignore
    assert(log?.completedMoves[0].moveId === String(move3.id), "Daily log has correct move ID");

    console.log("\n🎉 All tests passed!");

  } catch (e) {
    console.error("Test Error:", e);
    process.exit(1);
  } finally {
    server.close();
  }
}

runTests();
