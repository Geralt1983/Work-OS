import OpenAI from "openai";
import { clickupApi } from "./clickup-api";
import { storage } from "./storage";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Status mappings - customize these to match your ClickUp workspace
export const PIPELINE_STATUSES = {
  active: ["in progress", "today", "active", "doing"],
  queued: ["next", "queued", "ready", "to do"],
  backlog: ["backlog", "ideas", "later", "someday"],
  done: ["complete", "done", "closed"],
} as const;

// Default status to set when promoting tasks
export const DEFAULT_STATUS = {
  active: "in progress",
  queued: "next",
  backlog: "backlog",
} as const;

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
    name: "set_task_status",
    description: "Set a task's status to any value. Use this to move tasks through pipeline stages or mark them done.",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "The task ID" },
        status: { type: "string", description: "The new status (e.g., 'in progress', 'next', 'backlog', 'complete')" },
      },
      required: ["task_id", "status"],
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

function categorizeTask(task: any): "active" | "queued" | "backlog" | "done" {
  const status = task.status?.status?.toLowerCase() || "";
  
  if (PIPELINE_STATUSES.active.some(s => status.includes(s))) {
    return "active";
  }
  if (PIPELINE_STATUSES.queued.some(s => status.includes(s))) {
    return "queued";
  }
  if (PIPELINE_STATUSES.done.some(s => status.includes(s))) {
    return "done";
  }
  return "backlog";
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
        const category = categorizeTask(task);
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
    const category = categorizeTask(task);
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
      const newStatus = target === "today" ? DEFAULT_STATUS.active : DEFAULT_STATUS.queued;
      
      const result = await clickupApi.updateTask(args.task_id as string, {
        status: newStatus,
      });
      
      return {
        success: true,
        task: result.name,
        newStatus,
        message: `Moved "${result.name}" to ${target === "today" ? "Today (Active)" : "Next (Queued)"}`,
      };
    }
    
    case "set_task_status": {
      const newStatus = args.status as string;
      
      const result = await clickupApi.updateTask(args.task_id as string, {
        status: newStatus,
      });
      
      return {
        success: true,
        task: result.name,
        newStatus,
        message: `Updated "${result.name}" status to "${newStatus}"`,
      };
    }
    
    case "demote_task": {
      const target = args.target as "next" | "backlog";
      const newStatus = target === "next" ? DEFAULT_STATUS.queued : DEFAULT_STATUS.backlog;
      
      const result = await clickupApi.updateTask(args.task_id as string, {
        status: newStatus,
      });
      
      return {
        success: true,
        task: result.name,
        newStatus,
        message: `Moved "${result.name}" to ${target === "next" ? "Next (Queued)" : "Backlog"}`,
      };
    }
    
    case "complete_task": {
      const result = await clickupApi.updateTask(args.task_id as string, {
        status: "complete",
      });
      
      return {
        success: true,
        task: result.name,
        newStatus: "complete",
        message: `Marked "${result.name}" as complete`,
      };
    }
    
    default:
      throw new Error(`Unknown pipeline tool: ${name}`);
  }
}
