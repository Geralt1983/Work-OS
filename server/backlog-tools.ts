import { storage } from "./storage";
import OpenAI from "openai";

const openai = new OpenAI();

const AGING_THRESHOLD_DAYS = 7;
const AUTO_PROMOTE_THRESHOLD_DAYS = 10;
const ONE_FROM_BACK_THRESHOLD = 5;

export const backlogToolDefinitions: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_backlog_health",
      description: "Get backlog health metrics per client - shows oldest task age, count of aging tasks (7+ days), total backlog count, and average days in backlog. Use to identify which clients have stale backlogs.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_aging_backlog",
      description: "Get all backlog moves that have been sitting for 7+ days. These are at risk of becoming forgotten. Returns move details with days in backlog.",
      parameters: {
        type: "object",
        properties: {
          days_threshold: {
            type: "number",
            description: "Minimum days in backlog to be considered aging. Default is 7.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "auto_promote_stale_backlog",
      description: "Automatically promote backlog moves that have been sitting for 10+ days to Queued status. Prevents backlog rot by forcing stale moves back into view. Returns list of promoted moves.",
      parameters: {
        type: "object",
        properties: {
          days_threshold: {
            type: "number",
            description: "Days in backlog before auto-promotion. Default is 10.",
          },
          dry_run: {
            type: "boolean",
            description: "If true, just show what would be promoted without actually doing it.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "should_pull_from_backlog",
      description: "Check if it's time to pull a move from backlog based on recent move patterns. Uses 'one from the back' rule - after 5 moves from active/queued without touching backlog, suggests pulling from backlog.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_backlog_triage",
      description: "Run a backlog triage session - reviews aging backlog moves, suggests which to promote/delete/rewrite, and provides an overall backlog health summary. Good to run weekly or when backlog feels overwhelming.",
      parameters: {
        type: "object",
        properties: {
          client_name: {
            type: "string",
            description: "Optional: Focus on a specific client's backlog.",
          },
        },
        required: [],
      },
    },
  },
];

export async function getBacklogHealth(): Promise<{
  clients: { clientName: string; oldestDays: number; agingCount: number; totalCount: number; avgDays: number }[];
  summary: string;
  overallHealth: "healthy" | "warning" | "critical";
}> {
  const health = await storage.getBacklogHealth();
  
  if (health.length === 0) {
    return {
      clients: [],
      summary: "No backlog moves being tracked.",
      overallHealth: "healthy",
    };
  }
  
  const totalAging = health.reduce((sum, c) => sum + c.agingCount, 0);
  const maxAge = Math.max(...health.map(c => c.oldestDays));
  
  let overallHealth: "healthy" | "warning" | "critical" = "healthy";
  if (maxAge >= AUTO_PROMOTE_THRESHOLD_DAYS || totalAging >= 5) {
    overallHealth = "critical";
  } else if (maxAge >= AGING_THRESHOLD_DAYS || totalAging >= 2) {
    overallHealth = "warning";
  }
  
  const summary = `${health.length} clients with backlog. ${totalAging} moves aging (7+ days). Oldest move: ${maxAge} days.`;
  
  return { clients: health, summary, overallHealth };
}

export async function getAgingBacklog(daysThreshold: number = AGING_THRESHOLD_DAYS): Promise<{
  tasks: { taskId: string; taskName: string; clientName: string; daysInBacklog: number }[];
  count: number;
  recommendation: string;
}> {
  const aging = await storage.getAgingBacklogTasks(daysThreshold);
  
  const tasks = aging.map(entry => ({
    taskId: entry.taskId,
    taskName: entry.taskName,
    clientName: entry.clientName,
    daysInBacklog: entry.daysInBacklog || 0,
  }));
  
  let recommendation = "";
  if (tasks.length === 0) {
    recommendation = "No aging backlog moves - backlog is fresh!";
  } else if (tasks.length <= 2) {
    recommendation = `${tasks.length} aging moves - consider promoting one to Queued today.`;
  } else if (tasks.length <= 5) {
    recommendation = `${tasks.length} aging moves - schedule a 10-minute backlog triage.`;
  } else {
    recommendation = `${tasks.length} aging moves - backlog is getting stale! Recommend a dedicated triage session.`;
  }
  
  return { tasks, count: tasks.length, recommendation };
}

export async function autoPromoteStaleBacklog(
  daysThreshold: number = AUTO_PROMOTE_THRESHOLD_DAYS,
  dryRun: boolean = false
): Promise<{
  promoted: { taskId: string; taskName: string; clientName: string; daysInBacklog: number }[];
  message: string;
}> {
  const aging = await storage.getAgingBacklogTasks(daysThreshold);
  
  if (aging.length === 0) {
    return {
      promoted: [],
      message: `No moves have been in backlog for ${daysThreshold}+ days. Backlog is healthy!`,
    };
  }
  
  const promoted: { taskId: string; taskName: string; clientName: string; daysInBacklog: number }[] = [];
  
  for (const entry of aging) {
    if (!dryRun) {
      try {
        // Promote the move using local storage
        const moveId = parseInt(entry.taskId);
        if (!isNaN(moveId)) {
          await storage.updateMove(moveId, { status: "queued" });
          await storage.markBacklogPromoted(entry.taskId, true);
        }
      } catch (error) {
        console.error(`Failed to promote move ${entry.taskId}:`, error);
        continue;
      }
    }
    
    promoted.push({
      taskId: entry.taskId,
      taskName: entry.taskName,
      clientName: entry.clientName,
      daysInBacklog: entry.daysInBacklog || 0,
    });
  }
  
  const action = dryRun ? "would be" : "have been";
  return {
    promoted,
    message: `${promoted.length} moves ${action} auto-promoted from backlog to Queued after ${daysThreshold}+ days.`,
  };
}

export async function shouldPullFromBacklog(): Promise<{
  shouldPull: boolean;
  reason: string;
  movesSinceBacklog: number;
  suggestion: string | null;
}> {
  const stats = await storage.getBacklogMoveStats(14);
  const health = await storage.getBacklogHealth();
  
  const totalMoves = stats.backlogMoves + stats.nonBacklogMoves;
  const backlogRatio = totalMoves > 0 ? stats.backlogMoves / totalMoves : 0;
  
  const movesSinceBacklog = stats.nonBacklogMoves - (stats.backlogMoves * ONE_FROM_BACK_THRESHOLD);
  const shouldPull = movesSinceBacklog >= ONE_FROM_BACK_THRESHOLD || (backlogRatio < 0.1 && totalMoves >= 5);
  
  let reason = "";
  let suggestion: string | null = null;
  
  if (shouldPull) {
    reason = `You've completed ${stats.nonBacklogMoves} moves from active/queued vs only ${stats.backlogMoves} from backlog. Time to pull from the back!`;
    
    const aging = await storage.getAgingBacklogTasks(1);
    if (aging.length > 0) {
      const oldest = aging[0];
      suggestion = `"${oldest.taskName}" for ${oldest.clientName} (${oldest.daysInBacklog} days in backlog)`;
    }
  } else {
    reason = `Backlog balance is healthy. ${stats.backlogMoves} backlog moves, ${stats.nonBacklogMoves} other moves.`;
  }
  
  return { shouldPull, reason, movesSinceBacklog, suggestion };
}

export async function runBacklogTriage(clientName?: string): Promise<{
  aging: { taskId: string; taskName: string; clientName: string; daysInBacklog: number; recommendation: string }[];
  health: { clientName: string; oldestDays: number; agingCount: number; totalCount: number }[];
  summary: string;
  actionItems: string[];
}> {
  const allAging = await storage.getAgingBacklogTasks(AGING_THRESHOLD_DAYS);
  const health = await storage.getBacklogHealth();
  
  const aging = clientName 
    ? allAging.filter(t => t.clientName.toLowerCase() === clientName.toLowerCase())
    : allAging;
  
  const clientHealth = clientName
    ? health.filter(h => h.clientName.toLowerCase() === clientName.toLowerCase())
    : health;
  
  const agingWithRecs = await Promise.all(aging.map(async (entry) => {
    let recommendation = "";
    const days = entry.daysInBacklog || 0;
    
    if (days >= AUTO_PROMOTE_THRESHOLD_DAYS) {
      recommendation = "AUTO-PROMOTE: Stuck too long, move to Queued";
    } else if (days >= 14) {
      recommendation = "REVIEW: Is this still relevant? Consider deleting or rewriting";
    } else {
      recommendation = "AGING: Consider promoting or breaking into smaller moves";
    }
    
    return {
      taskId: entry.taskId,
      taskName: entry.taskName,
      clientName: entry.clientName,
      daysInBacklog: days,
      recommendation,
    };
  }));
  
  const actionItems: string[] = [];
  
  const criticalCount = agingWithRecs.filter(t => t.daysInBacklog >= AUTO_PROMOTE_THRESHOLD_DAYS).length;
  if (criticalCount > 0) {
    actionItems.push(`Auto-promote ${criticalCount} moves stuck for 10+ days`);
  }
  
  const reviewCount = agingWithRecs.filter(t => t.daysInBacklog >= 14).length;
  if (reviewCount > 0) {
    actionItems.push(`Review ${reviewCount} moves for deletion/rewrite (14+ days old)`);
  }
  
  const stalClients = clientHealth.filter(c => c.agingCount >= 3);
  if (stalClients.length > 0) {
    actionItems.push(`Focus on stale clients: ${stalClients.map(c => c.clientName).join(", ")}`);
  }
  
  if (actionItems.length === 0) {
    actionItems.push("Backlog is healthy! Keep momentum going.");
  }
  
  const summary = clientName
    ? `${clientName} backlog triage: ${aging.length} aging moves, ${clientHealth[0]?.totalCount || 0} total backlog`
    : `Backlog triage: ${aging.length} aging moves across ${clientHealth.length} clients`;
  
  return { aging: agingWithRecs, health: clientHealth, summary, actionItems };
}

export async function executeBacklogTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "get_backlog_health":
      return getBacklogHealth();
    
    case "get_aging_backlog":
      return getAgingBacklog(args.days_threshold as number | undefined);
    
    case "auto_promote_stale_backlog":
      return autoPromoteStaleBacklog(
        args.days_threshold as number | undefined,
        args.dry_run as boolean | undefined
      );
    
    case "should_pull_from_backlog":
      return shouldPullFromBacklog();
    
    case "run_backlog_triage":
      return runBacklogTriage(args.client_name as string | undefined);
    
    default:
      throw new Error(`Unknown backlog tool: ${name}`);
  }
}
