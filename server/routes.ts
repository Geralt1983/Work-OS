import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { processChat } from "./openai-service";
import { z } from "zod";

const sendMessageSchema = z.object({
  sessionId: z.string().optional().nullable(),
  message: z.string().min(1),
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

  const httpServer = createServer(app);

  return httpServer;
}
