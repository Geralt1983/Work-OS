import OpenAI from "openai";
import { storage, getLocalDateString } from "./storage";
import { normalizeDrainType } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface MoveWithContext {
  id: number;
  title: string;
  description?: string | null;
  status: string;
  clientName: string;
  clientId: number | null;
  effortEstimate: number | null;
  drainType?: string | null;
  createdAt: Date;
}

interface ClientPipeline {
  clientName: string;
  clientId: number;
  active: MoveWithContext[];
  queued: MoveWithContext[];
  backlog: MoveWithContext[];
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
  nonActionableMoves: { move: MoveWithContext; reason: string }[];
}

export const pipelineTools = [
  {
    name: "run_pipeline_audit",
    description: "Run daily pipeline audit. Checks every client has: 1 active move (Today), 1 queued move (Next), and backlog items. Also checks moves are actionable.",
    parameters: { 
      type: "object", 
      properties: {
        check_actionability: { 
          type: "boolean", 
          description: "Whether to use AI to check if moves are actionable (default true)" 
        }
      }
    },
  },
  {
    name: "get_client_pipeline",
    description: "Get the current pipeline status for a specific client (active/queued/backlog moves)",
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
    description: "Check if a specific move is actionable (has clear, concrete next step)",
    parameters: {
      type: "object",
      properties: {
        task_name: { type: "string", description: "The move title" },
        task_description: { type: "string", description: "The move description" },
      },
      required: ["task_name"],
    },
  },
  {
    name: "promote_move",
    description: "Move a move from backlog to queued (Next) or from queued to active (Today)",
    parameters: {
      type: "object",
      properties: {
        move_id: { type: "number", description: "The move ID" },
        target: { type: "string", enum: ["active", "queued"], description: "Where to move it" },
      },
      required: ["move_id", "target"],
    },
  },
  {
    name: "demote_move",
    description: "Move a move backwards in the pipeline (active to queued, or queued to backlog)",
    parameters: {
      type: "object",
      properties: {
        move_id: { type: "number", description: "The move ID" },
        target: { type: "string", enum: ["queued", "backlog"], description: "Where to move it" },
      },
      required: ["move_id", "target"],
    },
  },
  {
    name: "complete_move",
    description: "Mark a move as complete/done. Auto-promotes next moves to fill pipeline gaps.",
    parameters: {
      type: "object",
      properties: {
        move_id: { type: "number", description: "The move ID" },
      },
      required: ["move_id"],
    },
  },
  {
    name: "create_move",
    description: "Create a new move for a client. Moves are 20-minute tasks that advance client work. ALWAYS infer and set drain_type based on the task content - analyze whether it's focus work (deep), communication (comms), administrative (admin), strategic thinking (creative), or a quick win (easy).",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Move title - should be actionable and specific" },
        client_name: { type: "string", description: "Client name (optional - can be internal work)" },
        description: { type: "string", description: "Optional description with more details" },
        status: { type: "string", enum: ["active", "queued", "backlog"], description: "Initial status (default: backlog)" },
        effort_estimate: { type: "number", enum: [1, 2, 3, 4], description: "Effort level: 1=quick, 2=standard 20min, 3=chunky, 4=draining" },
        drain_type: { type: "string", enum: ["deep", "comms", "admin", "creative", "easy"], description: "Type of work - ALWAYS infer from task: deep=research/building/coding/analysis, comms=meetings/emails/calls/messages, admin=invoices/scheduling/updates/paperwork, creative=proposals/design/strategy/planning, easy=routine/quick-wins/simple-updates" },
      },
      required: ["title"],
    },
  },
  {
    name: "get_all_client_pipelines",
    description: "Get pipeline status for ALL clients at once. Returns active/queued/backlog moves for every client. Useful for daily planning and seeing all available work.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "suggest_next_move",
    description: "Suggest the best move to work on based on user's current context. Takes into account time available, energy level, client priorities, and recent activity.",
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
          description: "Any additional context from the user (e.g., 'just finished a call with Raleigh', 'need a quick win')" 
        },
        prefer_client: {
          type: "string",
          description: "If the user wants to focus on a specific client, specify the name"
        },
      },
    },
  },
];

async function getClientsWithPipelines(): Promise<ClientPipeline[]> {
  const clients = await storage.getAllClientsEntity();
  const pipelines: ClientPipeline[] = [];
  
  for (const client of clients) {
    if (client.isActive === 0) continue;
    
    const moves = await storage.getMovesByClient(client.id);
    
    const pipeline: ClientPipeline = {
      clientName: client.name,
      clientId: client.id,
      active: [],
      queued: [],
      backlog: [],
      issues: [],
    };
    
    for (const move of moves) {
      const moveWithContext: MoveWithContext = {
        id: move.id,
        title: move.title,
        description: move.description,
        status: move.status,
        clientName: client.name,
        clientId: move.clientId,
        effortEstimate: move.effortEstimate,
        drainType: move.drainType,
        createdAt: move.createdAt,
      };
      
      if (move.status === "active") {
        pipeline.active.push(moveWithContext);
      } else if (move.status === "queued") {
        pipeline.queued.push(moveWithContext);
      } else if (move.status === "backlog") {
        pipeline.backlog.push(moveWithContext);
      }
    }
    
    if (pipeline.active.length === 0) {
      pipeline.issues.push("No active move (Today)");
    }
    if (pipeline.queued.length === 0) {
      pipeline.issues.push("No queued move (Next)");
    }
    if (pipeline.backlog.length === 0) {
      pipeline.issues.push("Empty backlog");
    }
    
    pipelines.push(pipeline);
  }
  
  return pipelines;
}

async function checkActionability(moveName: string, moveDescription?: string): Promise<{ actionable: boolean; reason: string }> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are evaluating if a move is "actionable" - meaning it has a clear, concrete next step that can be done in 20 minutes or less.

ACTIONABLE moves:
- "Send Q4 invoice PDF to Memphis" ✓
- "Review and comment on Raleigh's proposal doc" ✓  
- "Schedule 15-min call with Orlando about timeline" ✓

NON-ACTIONABLE moves:
- "Follow up" ✗ (vague - follow up how? about what?)
- "Check on project" ✗ (no clear action)
- "Memphis stuff" ✗ (too vague)
- "Think about strategy" ✗ (not a clear action)

Respond with JSON: { "actionable": true/false, "reason": "brief explanation" }`
        },
        {
          role: "user",
          content: `Move: "${moveName}"${moveDescription ? `\nDescription: "${moveDescription}"` : ""}`
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
  const pipelines = await getClientsWithPipelines();
  const nonActionableMoves: { move: MoveWithContext; reason: string }[] = [];
  
  if (shouldCheckActionability) {
    for (const pipeline of pipelines) {
      for (const move of [...pipeline.active, ...pipeline.queued]) {
        const actionCheck = await checkActionability(move.title, move.description || undefined);
        if (!actionCheck.actionable) {
          nonActionableMoves.push({ move, reason: actionCheck.reason });
        }
      }
    }
  }
  
  const clientsNeedingAttention = pipelines.filter(c => c.issues.length > 0);
  
  return {
    audited: true,
    date: getLocalDateString(),
    clients: pipelines,
    summary: {
      totalClients: pipelines.length,
      healthyClients: pipelines.length - clientsNeedingAttention.length,
      clientsNeedingAttention,
    },
    nonActionableMoves,
  };
}

async function getClientPipeline(clientName: string): Promise<ClientPipeline | null> {
  const clients = await storage.getAllClientsEntity();
  const client = clients.find((c: { name: string }) => 
    c.name.toLowerCase() === clientName.toLowerCase()
  );
  
  if (!client) {
    return null;
  }
  
  const moves = await storage.getMovesByClient(client.id);
  
  const pipeline: ClientPipeline = {
    clientName: client.name,
    clientId: client.id,
    active: [],
    queued: [],
    backlog: [],
    issues: [],
  };
  
  for (const move of moves) {
    const moveWithContext: MoveWithContext = {
      id: move.id,
      title: move.title,
      description: move.description,
      status: move.status,
      clientName: client.name,
      clientId: move.clientId,
      effortEstimate: move.effortEstimate,
      drainType: move.drainType,
      createdAt: move.createdAt,
    };
    
    if (move.status === "active") {
      pipeline.active.push(moveWithContext);
    } else if (move.status === "queued") {
      pipeline.queued.push(moveWithContext);
    } else if (move.status === "backlog") {
      pipeline.backlog.push(moveWithContext);
    }
  }
  
  if (pipeline.active.length === 0) pipeline.issues.push("No active move");
  if (pipeline.queued.length === 0) pipeline.issues.push("No queued move");
  if (pipeline.backlog.length === 0) pipeline.issues.push("Empty backlog");
  
  return pipeline;
}

async function getAllClientPipelines(): Promise<{
  clients: ClientPipeline[];
  summary: {
    totalActive: number;
    totalQueued: number;
    totalBacklog: number;
  };
}> {
  const pipelines = await getClientsWithPipelines();
  
  let totalActive = 0;
  let totalQueued = 0;
  let totalBacklog = 0;
  
  for (const pipeline of pipelines) {
    totalActive += pipeline.active.length;
    totalQueued += pipeline.queued.length;
    totalBacklog += pipeline.backlog.length;
  }
  
  return {
    clients: pipelines,
    summary: {
      totalActive,
      totalQueued,
      totalBacklog,
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
  suggestedMove: MoveWithContext | null;
  reasoning: string;
  alternativeMoves: MoveWithContext[];
}> {
  const { clients, summary } = await getAllClientPipelines();
  
  const availableMoves: (MoveWithContext & { tier: string })[] = [];
  
  for (const client of clients) {
    for (const move of client.active) {
      availableMoves.push({ ...move, tier: "active" });
    }
    for (const move of client.queued) {
      availableMoves.push({ ...move, tier: "queued" });
    }
    for (const move of client.backlog.slice(0, 2)) {
      availableMoves.push({ ...move, tier: "backlog" });
    }
  }
  
  if (availableMoves.length === 0) {
    return {
      recommendation: "No active or queued moves found. Consider creating new moves or promoting from backlog.",
      suggestedMove: null,
      reasoning: "No moves are currently in the Active or Queued status. Create new moves to get started.",
      alternativeMoves: [],
    };
  }
  
  const moveList = availableMoves.map((m, i) => {
    const effortLabel = m.effortEstimate === 1 ? "quick" : m.effortEstimate === 2 ? "standard" : m.effortEstimate === 3 ? "chunky" : "draining";
    const normalizedDrain = normalizeDrainType(m.drainType);
    const drainLabel = normalizedDrain ? ` [${normalizedDrain}]` : "";
    return `${i + 1}. [${m.tier.toUpperCase()}] ${m.clientName}: "${m.title}" (effort: ${effortLabel}${drainLabel})`;
  }).join("\n");
  
  const prompt = `You are helping prioritize work for today. Here are all available moves:

${moveList}

User context:
- Time available: ${args.time_available_minutes ? `${args.time_available_minutes} minutes` : "not specified"}
- Energy level: ${args.energy_level || "not specified"}
- Preferred client: ${args.prefer_client || "none"}
- Additional context: ${args.context || "none"}

Work type categories:
- deep: Focus-intensive work (research, building, complex problems) - needs high energy and uninterrupted time
- comms: Communication work (meetings, emails, calls) - can be done at medium energy
- admin: Administrative tasks (invoices, scheduling, updates) - good for low energy or fragmented time
- creative: Strategic thinking (proposals, design) - needs medium-high energy
- easy: Quick wins (routine tasks) - perfect for low energy or between meetings

Based on this context, recommend the BEST move to work on right now.

Rules:
1. Active moves should generally be prioritized over queued
2. Match effort level to energy and time available
3. Match work type to current energy (deep work needs high energy, admin/easy work is fine for low energy)
4. If client preference is given, prioritize that client's moves
5. Consider context (e.g., "between meetings" suggests quick admin/easy tasks, not deep work)

Respond with JSON:
{
  "recommended_index": <1-based index of best move>,
  "reasoning": "<brief explanation of why this is the best choice>",
  "alternative_indices": [<1-based indices of 1-2 backup options>]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    const suggestedMove = availableMoves[result.recommended_index - 1] || null;
    const alternativeMoves = (result.alternative_indices || [])
      .map((i: number) => availableMoves[i - 1])
      .filter(Boolean);

    return {
      recommendation: suggestedMove ? `Work on: ${suggestedMove.title} (${suggestedMove.clientName})` : "No recommendation available",
      suggestedMove,
      reasoning: result.reasoning || "Based on current context",
      alternativeMoves,
    };
  } catch (error) {
    console.error("Error suggesting move:", error);
    const firstMove = availableMoves[0];
    return {
      recommendation: firstMove ? `Work on: ${firstMove.title}` : "No moves available",
      suggestedMove: firstMove || null,
      reasoning: "Default suggestion (AI analysis failed)",
      alternativeMoves: availableMoves.slice(1, 3),
    };
  }
}

export async function executePipelineTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "run_pipeline_audit": {
      const shouldCheck = args.check_actionability !== false;
      return runPipelineAudit(shouldCheck);
    }
    
    case "get_client_pipeline": {
      const clientName = args.client_name as string;
      const pipeline = await getClientPipeline(clientName);
      if (!pipeline) {
        return { error: `Client "${clientName}" not found` };
      }
      return pipeline;
    }
    
    case "check_task_actionable": {
      return checkActionability(
        args.task_name as string,
        args.task_description as string | undefined
      );
    }
    
    case "promote_move": {
      const moveId = args.move_id as number;
      const target = args.target as "active" | "queued";
      
      const move = await storage.getMove(moveId);
      if (!move) {
        return { error: `Move ${moveId} not found` };
      }
      
      await storage.updateMove(moveId, { status: target });
      return { 
        success: true, 
        message: `Promoted "${move.title}" to ${target}`,
        move: { ...move, status: target }
      };
    }
    
    case "demote_move": {
      const moveId = args.move_id as number;
      const target = args.target as "queued" | "backlog";
      
      const move = await storage.getMove(moveId);
      if (!move) {
        return { error: `Move ${moveId} not found` };
      }
      
      await storage.updateMove(moveId, { status: target });
      return { 
        success: true, 
        message: `Demoted "${move.title}" to ${target}`,
        move: { ...move, status: target }
      };
    }
    
    case "complete_move": {
      const moveId = args.move_id as number;
      
      const move = await storage.getMove(moveId);
      if (!move) {
        return { error: `Move ${moveId} not found` };
      }
      
      await storage.completeMove(moveId);
      
      let clientName = "Unknown";
      if (move.clientId) {
        const client = await storage.getClient(move.clientId);
        if (client) {
          clientName = client.name;
        }
      }
      
      const today = getLocalDateString();
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
        clientName,
        moveId: moveId.toString(),
        description: move.title,
        at: new Date().toISOString(),
      });
      
      if (!clientsTouched.includes(clientName)) {
        clientsTouched.push(clientName);
      }
      
      await storage.updateDailyLog(today, { completedMoves, clientsTouched });
      
      return { 
        success: true, 
        message: `Completed "${move.title}"`,
        move: { ...move, status: "done" }
      };
    }
    
    case "create_move": {
      const title = args.title as string;
      const clientName = args.client_name as string | undefined;
      const description = args.description as string | undefined;
      const status = (args.status as string) || "backlog";
      const effortEstimate = (args.effort_estimate as number) || 2;
      const drainType = args.drain_type as string | undefined;
      
      let clientId: number | null = null;
      
      if (clientName) {
        const clients = await storage.getAllClientsEntity();
        let client = clients.find((c: { name: string }) => c.name.toLowerCase() === clientName.toLowerCase());
        
        if (!client) {
          client = await storage.createClient({
            name: clientName,
            type: "client",
          });
        }
        
        clientId = client.id;
      }
      
      const move = await storage.createMove({
        title,
        description: description || null,
        clientId,
        status,
        effortEstimate,
        drainType: drainType || null,
      });
      
      return {
        success: true,
        message: `Created move "${title}"${clientName ? ` for ${clientName}` : ""}`,
        move,
      };
    }
    
    case "get_all_client_pipelines": {
      return getAllClientPipelines();
    }
    
    case "suggest_next_move": {
      return suggestNextMove(args as SuggestMoveArgs);
    }
    
    default:
      throw new Error(`Unknown pipeline tool: ${name}`);
  }
}
