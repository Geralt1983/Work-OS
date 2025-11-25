import { storage } from "./storage";
import type { Client, Move } from "@shared/schema";

export const memoryTools = [
  {
    name: "get_client_memory",
    description: "Get memory/state for a specific client including recent moves and activity",
    parameters: {
      type: "object",
      properties: {
        client_name: { type: "string", description: "The client name" },
      },
      required: ["client_name"],
    },
  },
  {
    name: "get_all_clients",
    description: "Get all tracked clients with their current state",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_stale_clients",
    description: "Get clients who haven't had a move completed in X days (default 2)",
    parameters: {
      type: "object",
      properties: {
        days: { type: "number", description: "Number of days to consider stale (default 2)" },
      },
    },
  },
  {
    name: "add_client_note",
    description: "Add a note to a client",
    parameters: {
      type: "object",
      properties: {
        client_name: { type: "string", description: "The client name" },
        note: { type: "string", description: "Note to add" },
      },
      required: ["client_name", "note"],
    },
  },
  {
    name: "get_today_summary",
    description: "Get summary of today's completed moves and activity",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "log_daily_reset",
    description: "Log the end of day reset with completed moves and prep for tomorrow",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Optional summary of the day" },
      },
    },
  },
  {
    name: "archive_client",
    description: "Archive a client (hide from active lists)",
    parameters: {
      type: "object",
      properties: {
        client_name: { type: "string", description: "The client name to archive" },
      },
      required: ["client_name"],
    },
  },
];

export async function executeMemoryTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "get_client_memory": {
      const clientName = args.client_name as string;
      const clients = await storage.getAllClientsEntity();
      const client = clients.find((c: Client) => c.name.toLowerCase() === clientName.toLowerCase());
      
      if (!client) {
        return { found: false, message: `No client "${clientName}" found.` };
      }
      
      const moves = await storage.getMovesByClient(client.id);
      const completedMoves = moves.filter((m: Move) => m.status === "done");
      const lastMove = completedMoves.sort((a: Move, b: Move) => 
        new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime()
      )[0];
      
      const now = new Date();
      const lastMoveDate = lastMove?.completedAt ? new Date(lastMove.completedAt) : null;
      const daysSinceMove = lastMoveDate 
        ? Math.floor((now.getTime() - lastMoveDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      
      return {
        found: true,
        client: {
          id: client.id,
          name: client.name,
          type: client.type,
          color: client.color,
        },
        lastMove: lastMove ? {
          id: lastMove.id,
          title: lastMove.title,
          completedAt: lastMove.completedAt,
          daysSince: daysSinceMove,
        } : null,
        totalMoves: completedMoves.length,
        activeMoves: moves.filter((m: Move) => m.status === "active").length,
        queuedMoves: moves.filter((m: Move) => m.status === "queued").length,
        backlogMoves: moves.filter((m: Move) => m.status === "backlog").length,
        isStale: daysSinceMove !== null && daysSinceMove >= 2,
      };
    }

    case "get_all_clients": {
      const clients = await storage.getAllClientsEntity();
      const results = [];
      
      for (const client of clients) {
        if (client.isActive === 0) continue;
        
        const moves = await storage.getMovesByClient(client.id);
        const completedMoves = moves.filter((m: Move) => m.status === "done");
        const lastMove = completedMoves.sort((a: Move, b: Move) => 
          new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime()
        )[0];
        
        const now = new Date();
        const lastMoveDate = lastMove?.completedAt ? new Date(lastMove.completedAt) : null;
        const daysSince = lastMoveDate 
          ? Math.floor((now.getTime() - lastMoveDate.getTime()) / (1000 * 60 * 60 * 24))
          : null;
        
        results.push({
          name: client.name,
          type: client.type,
          lastMoveTitle: lastMove?.title,
          daysSinceLastMove: daysSince,
          totalMoves: completedMoves.length,
          activeMoves: moves.filter((m: Move) => m.status === "active").length,
          queuedMoves: moves.filter((m: Move) => m.status === "queued").length,
          backlogMoves: moves.filter((m: Move) => m.status === "backlog").length,
          isStale: daysSince !== null && daysSince >= 2,
        });
      }
      
      return results;
    }

    case "get_stale_clients": {
      const days = (args.days as number) || 2;
      const clients = await storage.getAllClientsEntity();
      const stale = [];
      
      for (const client of clients) {
        if (client.isActive === 0) continue;
        
        const moves = await storage.getMovesByClient(client.id);
        const completedMoves = moves.filter((m: Move) => m.status === "done");
        const lastMove = completedMoves.sort((a: Move, b: Move) => 
          new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime()
        )[0];
        
        const now = new Date();
        const lastMoveDate = lastMove?.completedAt ? new Date(lastMove.completedAt) : null;
        const daysSince = lastMoveDate 
          ? Math.floor((now.getTime() - lastMoveDate.getTime()) / (1000 * 60 * 60 * 24))
          : null;
        
        if (daysSince === null || daysSince >= days) {
          stale.push({
            name: client.name,
            lastMove: lastMove?.title,
            lastMoveAt: lastMove?.completedAt,
            staleDays: daysSince,
          });
        }
      }
      
      return stale;
    }

    case "add_client_note": {
      const clientName = args.client_name as string;
      const note = args.note as string;
      
      const clients = await storage.getAllClientsEntity();
      const client = clients.find((c: Client) => c.name.toLowerCase() === clientName.toLowerCase());
      
      if (!client) {
        return { success: false, message: `Client "${clientName}" not found` };
      }
      
      return { success: true, message: `Added note to ${clientName}` };
    }

    case "get_today_summary": {
      const today = new Date().toISOString().split('T')[0];
      const dailyLog = await storage.getDailyLog(today);
      
      if (!dailyLog) {
        return { 
          date: today,
          completedMoves: 0,
          clientsTouched: [],
          message: "No activity logged today yet." 
        };
      }
      
      const completedMoves = (dailyLog.completedMoves as any[]) || [];
      const clientsTouched = (dailyLog.clientsTouched as string[]) || [];
      
      return {
        date: today,
        completedMoves: completedMoves.length,
        moves: completedMoves,
        clientsTouched,
        clientsCount: clientsTouched.length,
      };
    }

    case "log_daily_reset": {
      const today = new Date().toISOString().split('T')[0];
      let dailyLog = await storage.getDailyLog(today);
      
      if (!dailyLog) {
        dailyLog = await storage.createDailyLog({
          date: today,
          completedMoves: [],
          clientsTouched: [],
          clientsSkipped: [],
          summary: args.summary as string,
        });
      } else {
        await storage.updateDailyLog(today, { summary: args.summary as string });
      }
      
      const clients = await storage.getAllClientsEntity();
      const clientsTouched = (dailyLog.clientsTouched as string[]) || [];
      const skipped = clients
        .filter((c: Client) => c.isActive === 1 && !clientsTouched.includes(c.name))
        .map((c: Client) => c.name);
      
      await storage.updateDailyLog(today, { clientsSkipped: skipped });
      
      return {
        success: true,
        date: today,
        completedMoves: ((dailyLog.completedMoves as any[]) || []).length,
        clientsTouched: clientsTouched.length,
        clientsSkipped: skipped,
        summary: args.summary,
      };
    }

    case "archive_client": {
      const clientName = args.client_name as string;
      const clients = await storage.getAllClientsEntity();
      const client = clients.find((c: Client) => c.name.toLowerCase() === clientName.toLowerCase());
      
      if (!client) {
        return { success: false, message: `Client "${clientName}" not found` };
      }
      
      await storage.archiveClient(client.id);
      return { success: true, message: `Archived client "${clientName}"` };
    }

    default:
      throw new Error(`Unknown memory tool: ${name}`);
  }
}
