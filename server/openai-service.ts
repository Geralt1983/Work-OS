import OpenAI from "openai";
import { memoryTools, executeMemoryTool } from "./memory-tools";
import { pipelineTools, executePipelineTool } from "./pipeline-tools";
import { LEARNING_TOOL_DEFINITIONS, executeLearningTool } from "./learning-tools";
import { backlogToolDefinitions, executeBacklogTool } from "./backlog-tools";
import { storage } from "./storage";
import type { Message } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const WORK_OS_PROMPT = String.raw`You are Jeremy's **Chief of Staff & Productivity Architect**. You are not a passive chatbot; you are a proactive engine for getting things done.

## 🧠 IDENTITY: THE EXECUTIVE ASSISTANT + EXPERT
1.  **You have "Sudo Access"**: You have read/write access to the database. NEVER say "I will update that." ALWAYS say "I have updated that" (and ensure you actually called the tool).
2.  **Action Over Conversation**: If Jeremy says "I'm doing Evan," do not reply "Great choice!" Reply "Moved Evan to Active. Timer started."
3.  **Productivity Expert**: You don't just list tasks; you manage **energy**.
    - If Jeremy picks a "Draining" task at 9 AM (High Energy), CHALLENGE HIM: "Warning: You're burning peak energy on admin. Do the Creative task first?"
    - If Jeremy is exhausted, force "Quick Wins" to rebuild momentum.

## ⚡ CRITICAL RULES (THE "HAND ON KEYBOARD" PROTOCOL)
**IF** the user implies a state change (Starting, Finishing, Moving, Deferring), **YOU MUST EXECUTE THE TOOL IMMEDIATELY**.

* User: "I'll do Evan." -> **Tool:** ` + "`update_move(status: 'active')`" + String.raw`
* User: "Done with that." -> **Tool:** ` + "`complete_move()`" + String.raw`
* User: "Actually, push that to tomorrow." -> **Tool:** ` + "`update_move(status: 'queued')`" + String.raw` or ` + "`record_signal(deferred)`" + String.raw`

**DO NOT HALLUCINATE UPDATES.** If you didn't call the tool, the database didn't change.

## 🌊 CORE CONCEPTS
**The Pipeline (Strict 1-1-Backlog)**
* **Active**: The ONE thing happening *right now*.
* **Queued**: The ONE thing happening *next*.
* **Backlog**: Everything else.
* *Rule:* If you promote a task to Active, the current Active task MUST be demoted to Queued or Completed. **Keep the pipe clear.**

**Internal Work (The exception)**
* 'Revenue' and 'General Admin' are ongoing buckets. They don't get "Stale" warnings, but they DO count towards "Earned Minutes."

## 🧠 LEARNING & MEMORY (BE SMART)
You track *psychological* patterns, not just data.
* **Avoidance Detection**: If Jeremy defers 'Memphis' 3 times, call it out: "You're avoiding Memphis. Is the task too big? Should we break it down?"
* **Flow State Tracking**: If he completes a 'Deep' task in 20m, remember: "Jeremy crushes Deep work in the morning."

## 🎯 RESPONSE STYLE
* **Brevity**: Be concise. Bullet points. No fluff.
* **Categorized**: Clearly separate "Actions Taken" from "Questions."
* **Direct**: Don't suggest; recommend. "Do X next."

## DAILY PLANNING ALGORITHM
When Jeremy asks "What should I do?":
1.  **Scan Energy**: Ask/Infer energy level.
2.  **Check Stale**: Is any client > 2 days silent? (Prioritize them).
3.  **Check Momentum**: If momentum is low, suggest an 'Easy' drain_type. If high, suggest 'Deep'.
4.  **Present 1 Option**: "Best Move: [Task Name] for [Client]. Why: It's high impact and fits your energy."

## TOOLS & EXECUTION
* **create_move**: ALWAYS rewrite titles to be actionable (Verb + Noun). "Call Justin" -> "Phone call with Justin re: Q3 Taxes".
* **complete_move**: The dopamine hit. Use it liberally.
* **run_triage**: Use when the board looks messy.

**Metric Targets:**
* Daily Goal: 180 Minutes (Earned).
* Pacing: 9 Moves / Day.

Ready. Await commands.`;

export async function processChat(
  messages: Message[],
  imageUrl?: string,
  imagesBase64?: string[]
): Promise<{ content: string; taskCard?: any }> {
  const openaiMessages: Array<OpenAI.ChatCompletionMessageParam> = [
    { role: "system", content: WORK_OS_PROMPT },
  ];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const isLastMessage = i === messages.length - 1;
    const hasImages = imageUrl || (imagesBase64 && imagesBase64.length > 0);
    
    if (msg.role === "user" && isLastMessage && hasImages) {
      const contentParts: OpenAI.ChatCompletionContentPart[] = [];
      
      if (imageUrl) {
        contentParts.push({
          type: "image_url",
          image_url: { url: imageUrl }
        });
      } else if (imagesBase64 && imagesBase64.length > 0) {
        for (const base64 of imagesBase64) {
          contentParts.push({
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${base64}` }
          });
        }
      }
      
      const textContent = msg.content.replace(/\[Image(?:s)? attached\]\n?/g, "");
      contentParts.push({
        type: "text",
        text: textContent
      });
      
      openaiMessages.push({
        role: "user",
        content: contentParts
      });
    } else {
      openaiMessages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }
  }

  const legacyTools = [...memoryTools, ...pipelineTools];
  const legacyOpenaiTools: OpenAI.ChatCompletionTool[] = legacyTools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
  
  const openaiTools = [...legacyOpenaiTools, ...LEARNING_TOOL_DEFINITIONS, ...backlogToolDefinitions];

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

      try {
        let result: unknown;
        
        const learningToolNames = LEARNING_TOOL_DEFINITIONS.map(t => 
          t.type === 'function' ? t.function.name : ''
        );
        const backlogToolNames = backlogToolDefinitions.map(t => 
          t.type === 'function' ? t.function.name : ''
        );
        
        if (pipelineTools.some(t => t.name === toolName)) {
          result = await executePipelineTool(toolName, toolArgs);
        } else if (learningToolNames.includes(toolName)) {
          result = await executeLearningTool(toolName, toolArgs);
        } else if (backlogToolNames.includes(toolName)) {
          result = await executeBacklogTool(toolName, toolArgs);
        } else {
          result = await executeMemoryTool(toolName, toolArgs);
        }

        if (toolName === "create_move" && result && typeof result === "object") {
          const moveData = result as any;
          if (moveData.move?.id && moveData.move?.title) {
            taskCard = {
              title: moveData.move.title,
              taskId: moveData.move.id.toString(),
              status: moveData.move.status || "backlog",
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

export async function generateMorningBriefing(sessionId: string): Promise<string> {
  const demoted = await storage.demoteStaleActiveMoves();
  
  const health = await storage.getBacklogHealth();
  const todayMetrics = await storage.getTodayMetrics();
  
  const prompt = `
    You are Work OS. It is morning. Generate a brief, punchy morning briefing.
    
    Context:
    - You just auto-demoted these tasks from 'Active' to 'Queued' because they weren't finished yesterday: ${JSON.stringify(demoted)}
    - Backlog Health: ${JSON.stringify(health.slice(0, 3))} (showing top 3 clients)
    - Today's Target: ${todayMetrics.targetMinutes} minutes.
    
    Task:
    1. Greeting (Good morning).
    2. If tasks were demoted, mention "I moved X stale tasks back to queue to clear your board."
    3. Suggest 1 high-impact move to start the day based on the backlog health or a random client.
    4. Keep it under 3 sentences. Make it motivating.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "system", content: prompt }],
  });

  const content = response.choices[0].message.content || "Good morning. Ready to move clients forward?";

  await storage.createMessage({
    sessionId,
    role: "assistant",
    content,
  });

  return content;
}
