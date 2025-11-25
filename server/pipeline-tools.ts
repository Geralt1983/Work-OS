import OpenAI from "openai";
import { clickupApi } from "./clickup-api";
import { storage } from "./storage";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Tier custom field values - these match the dropdown options in ClickUp
export const TIER_VALUES = {
  active: ["active", "today", "current"],
  queued: ["next", "queued", "upcoming"],
  backlog: ["backlog", "later", "someday"],
  done: ["done", "complete", "completed"],
} as const;

// Default tier values to set when promoting/demoting tasks
export const DEFAULT_TIER = {
  active: "active",
  queued: "next",
  backlog: "backlog",
} as const;

// Cache for tier field info per list (avoids repeated API calls)
interface TierFieldCache {
  fieldId: string;
  options: Map<string, string>; // tier name -> option ID
}
const tierFieldCache: Map<string, TierFieldCache | null> = new Map();

interface TaskWithContext {
  id: string;
  name: string;
  description?: string;
  status: string;
  listName: string;
  listId: string;
  dueDate?: string;
  priority?: string;
}

interface ClientPipeline {
  clientName: string;
  listId: string;
  active: TaskWithContext[];
  queued: TaskWithContext[];
  backlog: TaskWithContext[];
  done: TaskWithContext[];
  issues: string[];
}

interface PipelineAuditResult {
  audited: boolean;
  date: string;
  clients: ClientPipeline[];
  summary: {
    totalClients: number;
    healthyClients: number;
    clientsNeedingAttention: ClientPipeline[];
  };
  nonActionableTasks: { task: TaskWithContext; reason: string }[];
}

export const pipelineTools = [
  {
    name: "run_pipeline_audit",
    description: "Run daily pipeline audit. Checks every client has: 1 active task (Today), 1 queued task (Next), and backlog items. Also checks tasks are actionable.",
    parameters: { 
      type: "object", 
      properties: {
        check_actionability: { 
          type: "boolean", 
          description: "Whether to use AI to check if tasks are actionable (default true)" 
        }
      }
    },
  },
  {
    name: "get_client_pipeline",
    description: "Get the current pipeline status for a specific client (active/queued/backlog tasks)",
    parameters: {
      type: "object",
      properties: {
        client_name: { type: "string", description: "The client name" },
      },
      required: ["client_name"],
    },
  },
  {
    name: "check_task_actionable",
    description: "Check if a specific task is actionable (has clear, concrete next step)",
    parameters: {
      type: "object",
      properties: {
        task_name: { type: "string", description: "The task name" },
        task_description: { type: "string", description: "The task description" },
      },
      required: ["task_name"],
    },
  },
  {
    name: "promote_task",
    description: "Move a task from backlog to queued (Next) or from queued to active (Today)",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "The task ID" },
        target: { type: "string", enum: ["today", "next"], description: "Where to move the task" },
      },
      required: ["task_id", "target"],
    },
  },
  {
    name: "set_task_tier",
    description: "Set a task's tier custom field to any value. Use this to move tasks through pipeline stages.",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "The task ID" },
        tier: { type: "string", description: "The new tier (e.g., 'active', 'next', 'backlog')" },
      },
      required: ["task_id", "tier"],
    },
  },
  {
    name: "demote_task",
    description: "Move a task backwards in the pipeline (active to queued, or queued to backlog)",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "The task ID" },
        target: { type: "string", enum: ["next", "backlog"], description: "Where to move the task" },
      },
      required: ["task_id", "target"],
    },
  },
  {
    name: "complete_task",
    description: "Mark a task as complete/done",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "The task ID" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "get_all_client_pipelines",
    description: "Get pipeline status for ALL clients at once. Returns active/queued/backlog tasks for every client. Useful for daily planning and seeing all available work.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "suggest_next_move",
    description: "Suggest the best task to work on based on user's current context. Takes into account time available, energy level, client priorities, and recent activity.",
    parameters: {
      type: "object",
      properties: {
        time_available_minutes: { 
          type: "number", 
          description: "How many minutes the user has available (e.g., 20, 60, 120)" 
        },
        energy_level: { 
          type: "string", 
          enum: ["high", "medium", "low"],
          description: "User's current energy level" 
        },
        context: { 
          type: "string", 
          description: "Any additional context from the user (e.g., 'just finished a call with Raleigh', 'need a quick win', 'want to tackle something meaty')" 
        },
        prefer_client: {
          type: "string",
          description: "If the user wants to focus on a specific client, specify the name"
        },
      },
    },
  },
];

async function getClientLists(): Promise<{ clientName: string; listId: string }[]> {
  const hierarchy = await clickupApi.getFullHierarchy();
  const clientLists: { clientName: string; listId: string }[] = [];
  
  for (const space of hierarchy.spaces) {
    for (const folder of space.folders) {
      if (folder.name.toLowerCase() === "clients") {
        for (const list of folder.lists) {
          clientLists.push({
            clientName: list.name,
            listId: list.id,
          });
        }
      }
    }
  }
  
  return clientLists;
}

function categorizeTaskByTier(task: any): "active" | "queued" | "backlog" | "done" {
  // Get tier value from custom field
  const tierValue = clickupApi.getTierValueFromTask(task);
  
  if (tierValue) {
    if (TIER_VALUES.active.some(v => tierValue.includes(v))) {
      return "active";
    }
    if (TIER_VALUES.queued.some(v => tierValue.includes(v))) {
      return "queued";
    }
    if (TIER_VALUES.done.some(v => tierValue.includes(v))) {
      return "done";
    }
    if (TIER_VALUES.backlog.some(v => tierValue.includes(v))) {
      return "backlog";
    }
  }
  
  // If no tier set, default to backlog
  return "backlog";
}

async function getTierFieldInfo(listId: string): Promise<TierFieldCache | null> {
  if (tierFieldCache.has(listId)) {
    return tierFieldCache.get(listId) || null;
  }
  
  const fieldInfo = await clickupApi.getTierFieldWithOptions(listId);
  tierFieldCache.set(listId, fieldInfo);
  return fieldInfo;
}

async function setTaskTier(taskId: string, listId: string, tier: string): Promise<void> {
  const fieldInfo = await getTierFieldInfo(listId);
  if (!fieldInfo) {
    throw new Error(`No "tier" custom field found for list ${listId}. Please add a dropdown custom field named "tier" with options: active, next, backlog`);
  }
  
  // For dropdown fields, we need to send the option ID, not the tier name
  const tierLower = tier.toLowerCase();
  const optionId = fieldInfo.options.get(tierLower);
  
  if (optionId) {
    // Dropdown field - send option ID
    await clickupApi.setCustomFieldValue(taskId, fieldInfo.fieldId, optionId);
  } else if (fieldInfo.options.size === 0) {
    // Text field - send tier name directly
    await clickupApi.setCustomFieldValue(taskId, fieldInfo.fieldId, tier);
  } else {
    // Dropdown field but tier option not found
    const availableOptions = Array.from(fieldInfo.options.keys()).join(", ");
    throw new Error(`Tier "${tier}" not found in dropdown options. Available: ${availableOptions}`);
  }
}

async function checkActionability(taskName: string, taskDescription?: string): Promise<{ actionable: boolean; reason: string }> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are evaluating if a task is "actionable" - meaning it has a clear, concrete next step that can be done in 20 minutes or less.

ACTIONABLE tasks:
- "Send Q4 invoice PDF to Memphis" ✓
- "Review and comment on Raleigh's proposal doc" ✓  
- "Schedule 15-min call with Orlando about timeline" ✓

NON-ACTIONABLE tasks:
- "Follow up" ✗ (vague - follow up how? about what?)
- "Check on project" ✗ (no clear action)
- "Memphis stuff" ✗ (too vague)
- "Think about strategy" ✗ (not a clear action)

Respond with JSON: { "actionable": true/false, "reason": "brief explanation" }`
        },
        {
          role: "user",
          content: `Task: "${taskName}"${taskDescription ? `\nDescription: "${taskDescription}"` : ""}`
        }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return {
      actionable: result.actionable ?? true,
      reason: result.reason || "Unknown",
    };
  } catch (error) {
    console.error("Error checking actionability:", error);
    return { actionable: true, reason: "Unable to check" };
  }
}

async function runPipelineAudit(shouldCheckActionability: boolean = true): Promise<PipelineAuditResult> {
  const clientLists = await getClientLists();
  const clients: ClientPipeline[] = [];
  const nonActionableTasks: { task: TaskWithContext; reason: string }[] = [];
  
  for (const { clientName, listId } of clientLists) {
    try {
      const tasks = await clickupApi.getTasks(listId);
      
      const pipeline: ClientPipeline = {
        clientName,
        listId,
        active: [],
        queued: [],
        backlog: [],
        done: [],
        issues: [],
      };
      
      for (const task of tasks) {
        const category = categorizeTaskByTier(task);
        const taskWithContext: TaskWithContext = {
          id: task.id,
          name: task.name,
          description: task.description,
          status: task.status?.status || "Unknown",
          listName: clientName,
          listId,
          dueDate: task.due_date ? new Date(parseInt(task.due_date)).toLocaleDateString() : undefined,
          priority: task.priority?.priority,
        };
        
        pipeline[category].push(taskWithContext);
        
        if (shouldCheckActionability && (category === "active" || category === "queued")) {
          const actionCheck = await checkActionability(task.name, task.description);
          if (!actionCheck.actionable) {
            nonActionableTasks.push({ task: taskWithContext, reason: actionCheck.reason });
          }
        }
      }
      
      if (pipeline.active.length === 0) {
        pipeline.issues.push("No active task (Today)");
      }
      if (pipeline.queued.length === 0) {
        pipeline.issues.push("No queued task (Next)");
      }
      if (pipeline.backlog.length === 0) {
        pipeline.issues.push("Empty backlog");
      }
      
      clients.push(pipeline);
      
      const existingClient = await storage.getClientMemory(clientName);
      if (!existingClient) {
        await storage.upsertClientMemory({
          clientName,
          tier: "active",
        });
      }
    } catch (error) {
      console.error(`Error auditing client ${clientName}:`, error);
    }
  }
  
  const clientsNeedingAttention = clients.filter(c => c.issues.length > 0);
  
  return {
    audited: true,
    date: new Date().toISOString().split('T')[0],
    clients,
    summary: {
      totalClients: clients.length,
      healthyClients: clients.length - clientsNeedingAttention.length,
      clientsNeedingAttention,
    },
    nonActionableTasks,
  };
}

async function getClientPipeline(clientName: string): Promise<ClientPipeline | null> {
  const clientLists = await getClientLists();
  const client = clientLists.find(c => 
    c.clientName.toLowerCase() === clientName.toLowerCase()
  );
  
  if (!client) {
    return null;
  }
  
  const tasks = await clickupApi.getTasks(client.listId);
  
  const pipeline: ClientPipeline = {
    clientName: client.clientName,
    listId: client.listId,
    active: [],
    queued: [],
    backlog: [],
    done: [],
    issues: [],
  };
  
  for (const task of tasks) {
    const category = categorizeTaskByTier(task);
    pipeline[category].push({
      id: task.id,
      name: task.name,
      description: task.description,
      status: task.status?.status || "Unknown",
      listName: client.clientName,
      listId: client.listId,
      dueDate: task.due_date ? new Date(parseInt(task.due_date)).toLocaleDateString() : undefined,
      priority: task.priority?.priority,
    });
  }
  
  if (pipeline.active.length === 0) pipeline.issues.push("No active task");
  if (pipeline.queued.length === 0) pipeline.issues.push("No queued task");
  if (pipeline.backlog.length === 0) pipeline.issues.push("Empty backlog");
  
  return pipeline;
}

async function getAllClientPipelines(): Promise<{
  clients: ClientPipeline[];
  summary: {
    totalActive: number;
    totalQueued: number;
    totalBacklog: number;
    staleClients: string[];
  };
}> {
  const clientLists = await getClientLists();
  const clients: ClientPipeline[] = [];
  
  let totalActive = 0;
  let totalQueued = 0;
  let totalBacklog = 0;
  
  for (const client of clientLists) {
    const pipeline = await getClientPipeline(client.clientName);
    if (pipeline) {
      clients.push(pipeline);
      totalActive += pipeline.active.length;
      totalQueued += pipeline.queued.length;
      totalBacklog += pipeline.backlog.length;
    }
  }
  
  // Get stale clients from memory
  const staleClients = await storage.getStaleClients(2);
  
  return {
    clients,
    summary: {
      totalActive,
      totalQueued,
      totalBacklog,
      staleClients: staleClients.map(c => c.clientName),
    },
  };
}

interface SuggestMoveArgs {
  time_available_minutes?: number;
  energy_level?: "high" | "medium" | "low";
  context?: string;
  prefer_client?: string;
}

async function suggestNextMove(args: SuggestMoveArgs): Promise<{
  recommendation: string;
  suggestedTask: TaskWithContext | null;
  reasoning: string;
  alternativeTasks: TaskWithContext[];
}> {
  // Get all client pipelines
  const { clients, summary } = await getAllClientPipelines();
  
  // Collect all available tasks (active first, then queued)
  const availableTasks: (TaskWithContext & { tier: string })[] = [];
  
  for (const client of clients) {
    for (const task of client.active) {
      availableTasks.push({ ...task, tier: "active" });
    }
    for (const task of client.queued) {
      availableTasks.push({ ...task, tier: "queued" });
    }
  }
  
  // Guard against empty task lists - return structured response instead of hallucinating
  if (availableTasks.length === 0) {
    const staleInfo = summary.staleClients.length > 0
      ? `You have stale clients (${summary.staleClients.join(", ")}) that need attention.`
      : "";
    
    return {
      recommendation: "No active or queued tasks found. Consider checking your backlog or creating new tasks.",
      suggestedTask: null,
      reasoning: `No tasks are currently in the Active or Queued tiers across your clients. ${staleInfo} You may need to promote tasks from your backlog or create new moves.`,
      alternativeTasks: [],
    };
  }
  
  // Get recent client activity from memory (includes learned patterns)
  const allClients = await storage.getAllClients();
  const clientActivity = allClients.reduce((acc: Record<string, { lastMove: Date | null; staleDays: number; sentiment: string | null; importance: string | null; avoidanceScore: number }>, c) => {
    acc[c.clientName] = {
      lastMove: c.lastMoveAt,
      staleDays: c.staleDays || 0,
      sentiment: c.sentiment,
      importance: c.importance,
      avoidanceScore: c.avoidanceScore || 0,
    };
    return acc;
  }, {} as Record<string, { lastMove: Date | null; staleDays: number; sentiment: string | null; importance: string | null; avoidanceScore: number }>);
  
  // Get avoided tasks from learning memory
  const avoidedTasks = await storage.getAvoidedTasks(14);
  const avoidedTaskIds = new Set(avoidedTasks.map(t => t.taskId));
  
  // Get productivity insights
  const productivityStats = await storage.getProductivityByHour();
  const currentHour = new Date().getHours();
  const currentHourStats = productivityStats.find(p => p.hour === currentHour);
  const isProductiveHour = currentHourStats && currentHourStats.completions > currentHourStats.deferrals;
  
  // Get learned patterns
  const patterns = await storage.getPatterns();
  const patternSummary = patterns.length > 0 
    ? patterns.slice(0, 5).map(p => `${p.patternKey}: confidence ${p.confidence}`).join(", ")
    : "No patterns learned yet";
  
  // Build context for AI
  const taskList = availableTasks.map((t, i) => {
    const clientInfo = clientActivity[t.listName.toLowerCase()];
    const isAvoided = avoidedTaskIds.has(t.id);
    const flags: string[] = [];
    
    if (isAvoided) flags.push("AVOIDED");
    if (clientInfo?.importance === "high") flags.push("HIGH-PRIORITY-CLIENT");
    if (clientInfo?.sentiment === "negative") flags.push("DIFFICULT-CLIENT");
    if (clientInfo?.avoidanceScore && clientInfo.avoidanceScore > 2) flags.push("CLIENT-OFTEN-DEFERRED");
    
    const flagStr = flags.length > 0 ? ` [${flags.join(", ")}]` : "";
    return `${i + 1}. [${t.tier.toUpperCase()}] ${t.listName}: "${t.name}"${t.priority ? ` (${t.priority})` : ""}${t.dueDate ? ` - due ${t.dueDate}` : ""}${flagStr}`;
  }).join("\n");
  
  const staleInfo = summary.staleClients.length > 0 
    ? `Stale clients (2+ days without moves): ${summary.staleClients.join(", ")}`
    : "No stale clients.";
  
  // Client insights summary
  const clientInsights = Object.entries(clientActivity)
    .filter(([_, info]) => info.importance === "high" || info.sentiment)
    .map(([name, info]) => {
      const parts = [];
      if (info.importance === "high") parts.push("HIGH PRIORITY");
      if (info.sentiment) parts.push(`sentiment: ${info.sentiment}`);
      return `${name}: ${parts.join(", ")}`;
    })
    .join("\n");
  
  const productivityHint = isProductiveHour 
    ? "This is historically a productive hour for you."
    : currentHourStats && (currentHourStats.completions + currentHourStats.deferrals > 2)
      ? "This is historically NOT a productive hour - consider easier tasks."
      : "";
  
  const prompt = `You are helping prioritize work for today. Here are all available tasks:

${taskList}

${staleInfo}
${clientInsights ? `\nClient insights:\n${clientInsights}` : ""}
${productivityHint ? `\nProductivity note: ${productivityHint}` : ""}

User context:
- Time available: ${args.time_available_minutes ? `${args.time_available_minutes} minutes` : "not specified"}
- Energy level: ${args.energy_level || "not specified"}
- Preferred client: ${args.prefer_client || "none"}
- Additional context: ${args.context || "none"}

Task flags explained:
- [AVOIDED]: User has deferred this task multiple times - only suggest if explicitly addressing avoidance
- [HIGH-PRIORITY-CLIENT]: VIP client, prioritize their work
- [DIFFICULT-CLIENT]: User has negative feelings about this client - be mindful when suggesting
- [CLIENT-OFTEN-DEFERRED]: Work for this client tends to get postponed

Core principles:
- Each task is a "move" (~20 minutes of focused work)
- One move per client per day is the goal
- Stale clients should be prioritized to maintain momentum
- Active tasks are already committed to today
- Queued tasks are ready to be pulled into active
- Respect user's learned patterns and preferences
- During low energy, suggest easier/quicker wins from positive clients
- Don't stack multiple difficult clients together

Based on this, recommend the BEST task to work on right now. Consider:
1. User's available time and energy
2. Stale clients that need attention
3. Task priority and due dates
4. Client sentiment and importance (high priority clients matter more)
5. Avoided tasks (don't suggest unless user is ready to tackle them)
6. Any context the user provided

Respond with JSON:
{
  "recommendedTaskIndex": <1-based index from the list above, or 0 if no good match>,
  "reasoning": "<brief explanation of why this task is the best choice, mentioning any patterns considered>",
  "alternativeIndices": [<up to 2 alternative task indices>]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a productivity assistant helping prioritize tasks based on context. Respond only with valid JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    const suggestedTask = result.recommendedTaskIndex > 0 && result.recommendedTaskIndex <= availableTasks.length
      ? availableTasks[result.recommendedTaskIndex - 1]
      : null;
    
    const alternativeTasks = (result.alternativeIndices || [])
      .filter((i: number) => i > 0 && i <= availableTasks.length)
      .map((i: number) => availableTasks[i - 1]);
    
    return {
      recommendation: suggestedTask 
        ? `Work on "${suggestedTask.name}" for ${suggestedTask.listName}`
        : "No suitable task found based on your context",
      suggestedTask,
      reasoning: result.reasoning || "No specific reasoning provided",
      alternativeTasks,
    };
  } catch (error) {
    console.error("Error suggesting next move:", error);
    
    // Fallback: return first active or queued task
    const fallbackTask = availableTasks[0] || null;
    return {
      recommendation: fallbackTask 
        ? `Work on "${fallbackTask.name}" for ${fallbackTask.listName}`
        : "No tasks available",
      suggestedTask: fallbackTask,
      reasoning: "AI suggestion unavailable, showing first available task",
      alternativeTasks: availableTasks.slice(1, 3),
    };
  }
}

export async function executePipelineTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "run_pipeline_audit": {
      const checkAction = args.check_actionability !== false;
      return runPipelineAudit(checkAction);
    }
    
    case "get_client_pipeline": {
      const pipeline = await getClientPipeline(args.client_name as string);
      if (!pipeline) {
        return { found: false, message: `No client list found for "${args.client_name}"` };
      }
      return { found: true, ...pipeline };
    }
    
    case "check_task_actionable": {
      return checkActionability(
        args.task_name as string, 
        args.task_description as string | undefined
      );
    }
    
    case "promote_task": {
      const target = args.target as "today" | "next";
      const newTier = target === "today" ? DEFAULT_TIER.active : DEFAULT_TIER.queued;
      
      // Get task first to find its list ID
      const task = await clickupApi.getTask(args.task_id as string);
      await setTaskTier(args.task_id as string, task.list.id, newTier);
      
      return {
        success: true,
        task: task.name,
        newTier,
        message: `Moved "${task.name}" to ${target === "today" ? "Today (Active)" : "Next (Queued)"}`,
      };
    }
    
    case "set_task_tier": {
      const newTier = args.tier as string;
      
      // Get task first to find its list ID
      const task = await clickupApi.getTask(args.task_id as string);
      await setTaskTier(args.task_id as string, task.list.id, newTier);
      
      return {
        success: true,
        task: task.name,
        newTier,
        message: `Updated "${task.name}" tier to "${newTier}"`,
      };
    }
    
    case "demote_task": {
      const target = args.target as "next" | "backlog";
      const newTier = target === "next" ? DEFAULT_TIER.queued : DEFAULT_TIER.backlog;
      
      // Get task first to find its list ID
      const task = await clickupApi.getTask(args.task_id as string);
      await setTaskTier(args.task_id as string, task.list.id, newTier);
      
      return {
        success: true,
        task: task.name,
        newTier,
        message: `Moved "${task.name}" to ${target === "next" ? "Next (Queued)" : "Backlog"}`,
      };
    }
    
    case "complete_task": {
      // Get task first to find its list ID, then set tier to done
      const task = await clickupApi.getTask(args.task_id as string);
      
      try {
        await setTaskTier(args.task_id as string, task.list.id, "done");
      } catch (e) {
        // If "done" tier doesn't exist, fall back to setting status
        await clickupApi.updateTask(args.task_id as string, { status: "complete" });
      }
      
      return {
        success: true,
        task: task.name,
        newTier: "done",
        message: `Marked "${task.name}" as complete`,
      };
    }
    
    case "get_all_client_pipelines": {
      return getAllClientPipelines();
    }
    
    case "suggest_next_move": {
      return suggestNextMove({
        time_available_minutes: args.time_available_minutes as number | undefined,
        energy_level: args.energy_level as "high" | "medium" | "low" | undefined,
        context: args.context as string | undefined,
        prefer_client: args.prefer_client as string | undefined,
      });
    }
    
    default:
      throw new Error(`Unknown pipeline tool: ${name}`);
  }
}
