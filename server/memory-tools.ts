import { storage } from "./storage";
import { syncCompletedTasks, getLastSyncTime, isSyncRunning } from "./sync-service";

export const memoryTools = [
  {
    name: "get_client_memory",
    description: "Get memory/state for a specific client including last move, total moves, and stale days",
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
    name: "update_client_move",
    description: "Record that a move was completed for a client",
    parameters: {
      type: "object",
      properties: {
        client_name: { type: "string", description: "The client name" },
        move_id: { type: "string", description: "The ClickUp task ID for this move" },
        description: { type: "string", description: "Brief description of the move" },
      },
      required: ["client_name", "move_id", "description"],
    },
  },
  {
    name: "get_stale_clients",
    description: "Get clients who haven't had a move in X days (default 2)",
    parameters: {
      type: "object",
      properties: {
        days: { type: "number", description: "Number of days to consider stale (default 2)" },
      },
    },
  },
  {
    name: "set_client_tier",
    description: "Set a client's tier (active, paused, archived)",
    parameters: {
      type: "object",
      properties: {
        client_name: { type: "string", description: "The client name" },
        tier: { type: "string", enum: ["active", "paused", "archived"], description: "Client tier" },
      },
      required: ["client_name", "tier"],
    },
  },
  {
    name: "add_client_note",
    description: "Add a note to a client's memory",
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
    name: "sync_clickup_completions",
    description: "Sync completed tasks from ClickUp to update metrics. Call this to ensure all ClickUp completions are reflected in the Work OS metrics. Auto-runs every 15 minutes.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "cleanup_daily_log",
    description: "Remove specific task entries from today's daily log. Use this to clean up test tasks, duplicates, or incorrectly logged moves. Also deletes the tasks from ClickUp.",
    parameters: {
      type: "object",
      properties: {
        move_ids: { 
          type: "array", 
          items: { type: "string" },
          description: "Array of ClickUp task IDs to remove from the log and delete from ClickUp" 
        },
        delete_from_clickup: {
          type: "boolean",
          description: "Whether to also delete these tasks from ClickUp (default true)"
        }
      },
      required: ["move_ids"],
    },
  },
];

export async function executeMemoryTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "get_client_memory": {
      const client = await storage.getClientMemory(args.client_name as string);
      if (!client) {
        return { found: false, message: `No memory for client "${args.client_name}" yet.` };
      }
      
      const now = new Date();
      const lastMove = client.lastMoveAt ? new Date(client.lastMoveAt) : null;
      const daysSinceMove = lastMove 
        ? Math.floor((now.getTime() - lastMove.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      
      return {
        found: true,
        clientName: client.clientName,
        tier: client.tier,
        lastMove: {
          id: client.lastMoveId,
          description: client.lastMoveDescription,
          at: client.lastMoveAt,
          daysSince: daysSinceMove,
        },
        totalMoves: client.totalMoves,
        notes: client.notes,
        isStale: daysSinceMove !== null && daysSinceMove >= 2,
      };
    }

    case "get_all_clients": {
      const clients = await storage.getAllClients();
      const now = new Date();
      
      return clients.map(client => {
        const lastMove = client.lastMoveAt ? new Date(client.lastMoveAt) : null;
        const daysSince = lastMove 
          ? Math.floor((now.getTime() - lastMove.getTime()) / (1000 * 60 * 60 * 24))
          : null;
        
        return {
          name: client.clientName,
          tier: client.tier,
          lastMoveDescription: client.lastMoveDescription,
          daysSinceLastMove: daysSince,
          totalMoves: client.totalMoves,
          isStale: daysSince !== null && daysSince >= 2,
        };
      });
    }

    case "update_client_move": {
      await storage.updateClientMove(
        args.client_name as string,
        args.move_id as string,
        args.description as string
      );
      
      const today = new Date().toISOString().split('T')[0];
      let dailyLog = await storage.getDailyLog(today);
      
      if (!dailyLog) {
        dailyLog = await storage.createDailyLog({
          date: today,
          completedMoves: [],
          clientsTouched: [],
          clientsSkipped: [],
        });
      }
      
      const completedMoves = (dailyLog.completedMoves as any[]) || [];
      const clientsTouched = (dailyLog.clientsTouched as string[]) || [];
      
      completedMoves.push({
        clientName: args.client_name,
        moveId: args.move_id,
        description: args.description,
        at: new Date().toISOString(),
      });
      
      if (!clientsTouched.includes(args.client_name as string)) {
        clientsTouched.push(args.client_name as string);
      }
      
      await storage.updateDailyLog(today, { completedMoves, clientsTouched });
      
      return { 
        success: true, 
        message: `Recorded move for ${args.client_name}: ${args.description}` 
      };
    }

    case "get_stale_clients": {
      const days = (args.days as number) || 2;
      const stale = await storage.getStaleClients(days);
      
      return stale.map(client => ({
        name: client.clientName,
        tier: client.tier,
        lastMove: client.lastMoveDescription,
        lastMoveAt: client.lastMoveAt,
        staleDays: client.staleDays,
      }));
    }

    case "set_client_tier": {
      await storage.upsertClientMemory({
        clientName: args.client_name as string,
        tier: args.tier as string,
      });
      return { success: true, message: `Set ${args.client_name} to tier: ${args.tier}` };
    }

    case "add_client_note": {
      const client = await storage.getClientMemory(args.client_name as string);
      const existingNotes = client?.notes || "";
      const timestamp = new Date().toLocaleString();
      const newNote = `[${timestamp}] ${args.note}`;
      const combinedNotes = existingNotes ? `${existingNotes}\n${newNote}` : newNote;
      
      await storage.upsertClientMemory({
        clientName: args.client_name as string,
        notes: combinedNotes,
      });
      
      return { success: true, message: `Added note to ${args.client_name}` };
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
      
      const allClients = await storage.getAllClients();
      const clientsTouched = (dailyLog.clientsTouched as string[]) || [];
      const skipped = allClients
        .filter(c => c.tier === 'active' && !clientsTouched.includes(c.clientName))
        .map(c => c.clientName);
      
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

    case "sync_clickup_completions": {
      const result = await syncCompletedTasks();
      return {
        success: true,
        synced: result.synced,
        alreadyLogged: result.alreadyLogged,
        tasks: result.tasks,
        lastSyncTime: getLastSyncTime(),
        autoSyncRunning: isSyncRunning(),
        message: result.synced > 0 
          ? `Synced ${result.synced} completed tasks from ClickUp`
          : `No new completions to sync (${result.alreadyLogged} already logged)`,
      };
    }

    case "cleanup_daily_log": {
      const moveIds = args.move_ids as string[];
      const deleteFromClickup = args.delete_from_clickup !== false; // default true
      const today = new Date().toISOString().split('T')[0];
      
      // Remove from daily log
      const removedCount = await storage.removeCompletedMoves(today, moveIds);
      
      // Delete from ClickUp if requested
      const deleted: string[] = [];
      const failed: string[] = [];
      
      if (deleteFromClickup) {
        const { executeClickUpTool } = await import("./clickup-api");
        for (const taskId of moveIds) {
          try {
            await executeClickUpTool("delete_task", { task_id: taskId });
            deleted.push(taskId);
          } catch (err) {
            failed.push(taskId);
          }
        }
      }
      
      return {
        success: true,
        removedFromLog: removedCount,
        deletedFromClickup: deleted.length,
        failedToDelete: failed,
        message: `Removed ${removedCount} entries from daily log` + 
          (deleteFromClickup ? `, deleted ${deleted.length} tasks from ClickUp` : ''),
      };
    }

    default:
      throw new Error(`Unknown memory tool: ${name}`);
  }
}
