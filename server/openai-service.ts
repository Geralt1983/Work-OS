import OpenAI from "openai";
import { mcpClient } from "./mcp-client";
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
  const tools = await mcpClient.listTools();
  
  const openaiMessages: ChatCompletionMessage[] = [
    {
      role: "system",
      content: `You are a helpful AI assistant for managing ClickUp tasks through natural conversation. 
      
You have access to various ClickUp tools to help users:
- Create, update, and delete tasks
- Manage task dependencies
- Add tags and comments
- Set due dates and priorities
- View task information

When users ask about their tasks, use the available tools to help them. Be conversational and helpful.
When you successfully perform an action (like creating a task), provide clear confirmation with the task details.

Available tools: ${tools.map((t) => t.name).join(", ")}`,
    },
    ...messages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
  ];

  const openaiTools = tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description || "",
      parameters: tool.inputSchema || { type: "object", properties: {} },
    },
  }));

  let response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: openaiMessages,
    tools: openaiTools.length > 0 ? openaiTools : undefined,
    tool_choice: "auto",
  });

  let assistantMessage = response.choices[0].message;
  let taskCard: any = undefined;

  while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
    const toolCalls = assistantMessage.tool_calls;

    openaiMessages.push({
      role: "assistant",
      content: assistantMessage.content || "",
    });

    for (const toolCall of toolCalls) {
      if (toolCall.type !== "function") continue;
      
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments);

      console.log(`🔧 Calling tool: ${toolName}`, toolArgs);
      onToolCall?.(toolName);

      try {
        const result = await mcpClient.callTool(toolName, toolArgs);
        
        if (toolName.includes("create_task") && Array.isArray(result.content) && result.content[0]) {
          const firstContent = result.content[0];
          if ('text' in firstContent && firstContent.text) {
            try {
              const taskData = JSON.parse(firstContent.text);
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
            } catch (e) {
              console.error("Failed to parse task data:", e);
            }
          }
        }

        openaiMessages.push({
          role: "user",
          content: `Tool ${toolName} result: ${JSON.stringify(result.content)}`,
        });
      } catch (error) {
        console.error(`Error calling tool ${toolName}:`, error);
        openaiMessages.push({
          role: "user",
          content: `Tool ${toolName} failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }

    response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: openaiMessages,
      tools: openaiTools.length > 0 ? openaiTools : undefined,
      tool_choice: "auto",
    });

    assistantMessage = response.choices[0].message;
  }

  return {
    content: assistantMessage.content || "I processed your request.",
    taskCard,
  };
}
