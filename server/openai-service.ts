import OpenAI from "openai";
import { clickupTools, executeClickUpTool } from "./clickup-api";
import type { Message } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ChatCompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function processChat(
  messages: Message[],
  onToolCall?: (toolName: string) => void
): Promise<{ content: string; taskCard?: any }> {
  const openaiMessages: Array<OpenAI.ChatCompletionMessageParam> = [
    {
      role: "system",
      content: `You are a helpful AI assistant for managing ClickUp tasks through natural conversation.

You have access to various ClickUp tools to help users:
- View spaces, folders, and lists
- Get and search for tasks
- Create new tasks
- Update existing tasks (status, name, description, due date, priority)
- Delete tasks

When users ask about their tasks, use the available tools to help them. Be conversational and helpful.
When you successfully perform an action (like creating a task), provide clear confirmation with the task details.

If the user wants to create a task but doesn't specify a list, first use get_spaces to find available spaces, then help them choose where to create the task.

Always format task information clearly and include relevant details like status, due date, and priority when available.`,
    },
    ...messages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
  ];

  const openaiTools: OpenAI.ChatCompletionTool[] = clickupTools.map((tool) => ({
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
        const result = await executeClickUpTool(toolName, toolArgs);

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
    content: assistantMessage.content || "I processed your request.",
    taskCard,
  };
}
