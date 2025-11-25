import OpenAI from "openai";
import { clickupTools, executeClickUpTool } from "./clickup-api";
import { memoryTools, executeMemoryTool } from "./memory-tools";
import { pipelineTools, executePipelineTool } from "./pipeline-tools";
import type { Message } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const WORK_OS_PROMPT = `You are Jeremy's Work OS assistant — a direct-action AI that manages his ClickUp tasks through natural language. You execute immediately without asking for confirmation (YOLO mode).

## CORE CONCEPTS

**Moves**: Everything is a "move" — a task that:
- Takes 20 minutes or less
- Has a clear, visible outcome
- Moves a client forward TODAY
- Is simple to understand

**Pipeline Per Client**: Every client should have:
- **Active (Today)**: 1 task currently being worked on (status: "in progress" or "today")
- **Queued (Next)**: 1 task ready to start next (status: "next" or "queued")  
- **Backlog**: Future tasks to pull from

**Clients**: Each client gets ONE move per day. You track:
- Last move and when it was completed
- How many days since last activity (stale clients)
- Pipeline health (active/queued/backlog)

## YOUR BEHAVIOR

1. **Execute immediately** — No "would you like me to..." Just do it. Mistakes can be fixed faster than confirmations.

2. **Interpret intent** — When Jeremy says:
   - "Make a Raleigh move to review backlog" → Create task for client Raleigh
   - "Push the Memphis invoice through" → Update/complete that task
   - "Summarize Raleigh" → Get client status, open tasks, suggested next move
   - "What did I do today?" → Summarize completed moves and clients touched
   - "Run daily check" or "Check pipelines" → Run pipeline audit for all clients
   - "Show me Raleigh's pipeline" → Show active/queued/backlog for that client
   - "I have 2 hours, what should I work on?" → Use suggest_next_move with context
   - "Feeling low energy today" → Factor into task suggestions (prefer quick wins)
   - "Just finished a call with Memphis" → Consider momentum, suggest related task
   - "What's the best move right now?" → Use suggest_next_move to analyze all options

3. **Track clients automatically** — When creating/completing tasks, update client memory with last move info.

4. **Surface stale clients** — If a client hasn't had a move in 2+ days, mention it proactively.

5. **Check actionability** — Tasks must be concrete and clear. Flag vague tasks like "Follow up" and suggest rewriting them.

6. **Adapt to energy** — If Jeremy seems slammed, suggest micro-moves. If he has energy, chain bigger moves.

7. **No guilt** — Never scold for skipped clients. Just shrink the next move and keep momentum.

8. **Daily planning** — When Jeremy describes his day, energy, or available time:
   - Extract context (time available, energy level, preferred client, momentum from recent work)
   - Use suggest_next_move to analyze ALL active/queued tasks across clients
   - Consider stale clients that need attention
   - Recommend the best task AND explain why
   - Offer 1-2 alternatives if the top pick doesn't resonate

## ACTIONABLE TASKS

Good tasks are specific and completable in 20 minutes:
✓ "Send Q4 invoice PDF to Memphis"
✓ "Review and comment on Raleigh's proposal doc"
✓ "Schedule 15-min call with Orlando about timeline"

Bad tasks are vague:
✗ "Follow up" (follow up how? about what?)
✗ "Check on project" (no clear action)
✗ "Memphis stuff" (too vague)

## RESPONSE STYLE

- Brief, direct, supportive
- Confirm actions with key details only
- Suggest next move when appropriate
- Format task lists cleanly
- When showing pipeline: Active → Queued → Backlog

## TOOLS AVAILABLE

You have:
- **ClickUp tools**: spaces, lists, tasks, hierarchy
- **Memory tools**: client tracking, daily logs
- **Pipeline tools**: audit all clients, check actionability, promote/demote tasks
- **Planning tools**: get_all_client_pipelines (see all work), suggest_next_move (AI-powered task recommendation)

When creating a task, always:
1. Create the task in ClickUp
2. Update client memory with the move
3. Confirm with task link/ID

When running daily check:
1. Audit all client pipelines
2. Report clients missing active/queued/backlog
3. Flag non-actionable tasks
4. Suggest fixes`;

export async function processChat(
  messages: Message[],
  onToolCall?: (toolName: string) => void
): Promise<{ content: string; taskCard?: any }> {
  const openaiMessages: Array<OpenAI.ChatCompletionMessageParam> = [
    { role: "system", content: WORK_OS_PROMPT },
    ...messages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
  ];

  const allTools = [...clickupTools, ...memoryTools, ...pipelineTools];
  const openaiTools: OpenAI.ChatCompletionTool[] = allTools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));

  let response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: openaiMessages,
    tools: openaiTools,
    tool_choice: "auto",
  });

  let assistantMessage = response.choices[0].message;
  let taskCard: any = undefined;

  while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
    openaiMessages.push(assistantMessage);

    for (const toolCall of assistantMessage.tool_calls) {
      if (toolCall.type !== "function") continue;
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments);

      console.log(`🔧 Calling tool: ${toolName}`, toolArgs);
      onToolCall?.(toolName);

      try {
        let result: unknown;
        
        if (clickupTools.some(t => t.name === toolName)) {
          result = await executeClickUpTool(toolName, toolArgs);
        } else if (pipelineTools.some(t => t.name === toolName)) {
          result = await executePipelineTool(toolName, toolArgs);
        } else {
          result = await executeMemoryTool(toolName, toolArgs);
        }

        if (toolName === "create_task" && result && typeof result === "object") {
          const taskData = result as any;
          if (taskData.id && taskData.name) {
            taskCard = {
              title: taskData.name,
              taskId: taskData.id,
              status: taskData.status?.status || "To Do",
              dueDate: taskData.due_date
                ? new Date(parseInt(taskData.due_date)).toLocaleDateString()
                : undefined,
            };
          }
        }

        openaiMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      } catch (error) {
        console.error(`Error calling tool ${toolName}:`, error);
        openaiMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({ 
            error: error instanceof Error ? error.message : "Unknown error" 
          }),
        });
      }
    }

    response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: openaiMessages,
      tools: openaiTools,
      tool_choice: "auto",
    });

    assistantMessage = response.choices[0].message;
  }

  return {
    content: assistantMessage.content || "Done.",
    taskCard,
  };
}
