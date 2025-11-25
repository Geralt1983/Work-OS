import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { processChat } from "./openai-service";
import { syncCompletedTasks, startSyncInterval, getLastSyncTime, isSyncRunning } from "./sync-service";
import { z } from "zod";
import { insertClientSchema, insertMoveSchema, MOVE_STATUSES, type MoveStatus } from "@shared/schema";

const sendMessageSchema = z.object({
  sessionId: z.string().optional().nullable(),
  message: z.string().min(1),
});

const updateMoveSchema = z.object({
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  status: z.enum(MOVE_STATUSES).optional(),
  clientId: z.number().nullable().optional(),
  effortEstimate: z.number().optional(),
  effortActual: z.number().nullable().optional(),
  drainType: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
});

const updateClientSchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  color: z.string().nullable().optional(),
  isActive: z.number().optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {

  app.post("/api/sessions", async (req, res) => {
    try {
      const session = await storage.createSession({});
      res.json(session);
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(500).json({ error: "Failed to create session" });
    }
  });

  app.get("/api/sessions/:id/messages", async (req, res) => {
    try {
      const messages = await storage.getMessages(req.params.id);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { sessionId: providedSessionId, message } = sendMessageSchema.parse(req.body);

      let sessionId = providedSessionId;
      if (!sessionId) {
        const session = await storage.createSession({});
        sessionId = session.id;
      }

      const userMessage = await storage.createMessage({
        sessionId,
        role: "user",
        content: message,
      });

      const conversationHistory = await storage.getSessionMessages(sessionId, 20);

      const { content, taskCard } = await processChat(conversationHistory);

      const assistantMessage = await storage.createMessage({
        sessionId,
        role: "assistant",
        content,
        taskCard,
      });

      await storage.updateSessionActivity(sessionId);

      res.json({
        sessionId,
        userMessage,
        assistantMessage,
      });
    } catch (error) {
      console.error("Error processing chat:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to process chat" 
      });
    }
  });

  app.get("/api/health", async (req, res) => {
    const hasClickUpConfig = !!(process.env.CLICKUP_API_KEY && process.env.CLICKUP_TEAM_ID);
    res.json({
      status: "ok",
      clickupConfigured: hasClickUpConfig,
    });
  });

  // Metrics endpoints
  app.get("/api/metrics/today", async (req, res) => {
    try {
      const metrics = await storage.getTodayMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching today's metrics:", error);
      res.status(500).json({ error: "Failed to fetch metrics" });
    }
  });

  app.get("/api/metrics/weekly", async (req, res) => {
    try {
      const metrics = await storage.getWeeklyMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching weekly metrics:", error);
      res.status(500).json({ error: "Failed to fetch weekly metrics" });
    }
  });

  app.get("/api/metrics/clients", async (req, res) => {
    try {
      const metrics = await storage.getClientMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching client metrics:", error);
      res.status(500).json({ error: "Failed to fetch client metrics" });
    }
  });

  // Sync endpoints
  app.post("/api/sync", async (req, res) => {
    try {
      const result = await syncCompletedTasks();
      res.json({
        success: true,
        synced: result.synced,
        alreadyLogged: result.alreadyLogged,
        tasks: result.tasks,
        message: `Synced ${result.synced} completed tasks from ClickUp`,
      });
    } catch (error) {
      console.error("Error syncing with ClickUp:", error);
      res.status(500).json({ error: "Failed to sync with ClickUp" });
    }
  });

  app.get("/api/sync/status", async (req, res) => {
    res.json({
      running: isSyncRunning(),
      lastSyncTime: getLastSyncTime(),
    });
  });

  // Start background sync every 15 minutes
  startSyncInterval(15);

  // ============ CLIENTS API ============

  app.get("/api/clients", async (req, res) => {
    try {
      const clients = await storage.getAllClientsEntity();
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.post("/api/clients", async (req, res) => {
    try {
      const data = insertClientSchema.parse(req.body);
      const client = await storage.createClient(data);
      res.status(201).json(client);
    } catch (error) {
      console.error("Error creating client:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid client data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create client" });
      }
    }
  });

  app.get("/api/clients/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const client = await storage.getClient(id);
      if (!client) {
        res.status(404).json({ error: "Client not found" });
        return;
      }
      res.json(client);
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });

  app.patch("/api/clients/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = updateClientSchema.parse(req.body);
      const client = await storage.updateClient(id, updates);
      if (!client) {
        res.status(404).json({ error: "Client not found" });
        return;
      }
      res.json(client);
    } catch (error) {
      console.error("Error updating client:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid update data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update client" });
      }
    }
  });

  app.delete("/api/clients/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.archiveClient(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error archiving client:", error);
      res.status(500).json({ error: "Failed to archive client" });
    }
  });

  // ============ MOVES API ============

  app.get("/api/moves", async (req, res) => {
    try {
      const status = req.query.status as MoveStatus | undefined;
      const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;
      const includeCompleted = req.query.includeCompleted === "true";
      
      const moves = await storage.getAllMoves({ status, clientId, includeCompleted });
      res.json(moves);
    } catch (error) {
      console.error("Error fetching moves:", error);
      res.status(500).json({ error: "Failed to fetch moves" });
    }
  });

  app.post("/api/moves", async (req, res) => {
    try {
      const data = insertMoveSchema.parse(req.body);
      const move = await storage.createMove(data);
      res.status(201).json(move);
    } catch (error) {
      console.error("Error creating move:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid move data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create move" });
      }
    }
  });

  app.get("/api/moves/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const move = await storage.getMove(id);
      if (!move) {
        res.status(404).json({ error: "Move not found" });
        return;
      }
      res.json(move);
    } catch (error) {
      console.error("Error fetching move:", error);
      res.status(500).json({ error: "Failed to fetch move" });
    }
  });

  app.patch("/api/moves/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = updateMoveSchema.parse(req.body);
      const move = await storage.updateMove(id, updates);
      if (!move) {
        res.status(404).json({ error: "Move not found" });
        return;
      }
      res.json(move);
    } catch (error) {
      console.error("Error updating move:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid update data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update move" });
      }
    }
  });

  app.post("/api/moves/:id/complete", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const effortActual = req.body.effortActual ? parseInt(req.body.effortActual) : undefined;
      const move = await storage.completeMove(id, effortActual);
      if (!move) {
        res.status(404).json({ error: "Move not found" });
        return;
      }
      
      // Also log to daily metrics if move has a client
      if (move.clientId) {
        const client = await storage.getClient(move.clientId);
        const today = new Date().toISOString().split("T")[0];
        await storage.addCompletedMove(today, {
          moveId: move.id.toString(),
          description: move.title,
          clientName: client?.name || "unknown",
          at: new Date().toISOString(),
          source: "moves-ui",
        });
      }
      
      res.json(move);
    } catch (error) {
      console.error("Error completing move:", error);
      res.status(500).json({ error: "Failed to complete move" });
    }
  });

  app.post("/api/moves/:id/promote", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const move = await storage.promoteMove(id);
      if (!move) {
        res.status(404).json({ error: "Move not found" });
        return;
      }
      res.json(move);
    } catch (error) {
      console.error("Error promoting move:", error);
      res.status(500).json({ error: "Failed to promote move" });
    }
  });

  app.post("/api/moves/:id/demote", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const move = await storage.demoteMove(id);
      if (!move) {
        res.status(404).json({ error: "Move not found" });
        return;
      }
      res.json(move);
    } catch (error) {
      console.error("Error demoting move:", error);
      res.status(500).json({ error: "Failed to demote move" });
    }
  });

  app.delete("/api/moves/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteMove(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting move:", error);
      res.status(500).json({ error: "Failed to delete move" });
    }
  });

  app.post("/api/moves/reorder", async (req, res) => {
    try {
      const { status, orderedIds } = req.body;
      if (!status || !Array.isArray(orderedIds)) {
        res.status(400).json({ error: "status and orderedIds are required" });
        return;
      }
      await storage.reorderMoves(status as MoveStatus, orderedIds);
      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering moves:", error);
      res.status(500).json({ error: "Failed to reorder moves" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
