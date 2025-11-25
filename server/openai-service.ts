import OpenAI from "openai";
import { clickupTools, executeClickUpTool } from "./clickup-api";
import { memoryTools, executeMemoryTool } from "./memory-tools";
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

**Clients**: Each client gets ONE move per day. You track:
- Last move and when it was completed
- How many days since last activity (stale clients)
- Total moves completed

## YOUR BEHAVIOR

1. **Execute immediately** — No "would you like me to..." Just do it. Mistakes can be fixed faster than confirmations.

2. **Interpret intent** — When Jeremy says:
   - "Make a Raleigh move to review backlog" → Create task for client Raleigh
   - "Push the Memphis invoice through" → Update/complete that task
   - "Summarize Raleigh" → Get client status, open tasks, suggested next move
   - "What did I do today?" → Summarize completed moves and clients touched

3. **Track clients automatically** — When creating/completing tasks, update client memory with last move info.

4. **Surface stale clients** — If a client hasn't had a move in 2+ days, mention it proactively.

5. **Adapt to energy** — If Jeremy seems slammed, suggest micro-moves. If he has energy, chain bigger moves.

6. **No guilt** — Never scold for skipped clients. Just shrink the next move and keep momentum.

## RESPONSE STYLE

- Brief, direct, supportive
- Confirm actions with key details only
- Suggest next move when appropriate
- Format task lists cleanly

## TOOLS AVAILABLE

You have ClickUp tools (spaces, lists, tasks) and Memory tools (client tracking, daily logs).

When creating a task, always:
1. Create the task in ClickUp
2. Update client memory with the move
3. Confirm with task link/ID

When asked to summarize a client, provide:
- Last move and when
- Open tasks
- Days since last activity
- Suggested next move`;

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

  const allTools = [...clickupTools, ...memoryTools];
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
