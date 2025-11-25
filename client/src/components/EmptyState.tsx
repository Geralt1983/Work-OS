import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export interface EmptyStateProps {
  onExampleClick?: (example: string) => void;
}

const examplePrompts = [
  "Create a task to review the marketing materials",
  "Show me my tasks due this week",
  "Update the status of TASK-123 to In Progress",
  "What tasks are assigned to me?",
];

export default function EmptyState({ onExampleClick }: EmptyStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-8 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-primary/10 p-5">
            <Sparkles className="h-10 w-10 text-primary" />
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-3xl font-semibold tracking-tight" data-testid="text-welcome-title">
            Welcome to ClickUp Assistant
          </h2>
          <p className="text-[15px] text-muted-foreground leading-relaxed max-w-lg mx-auto">
            Tell me what you'd like to do with your tasks, and I'll help you manage them naturally.
          </p>
        </div>

        <div className="space-y-4 pt-4">
          <p className="text-sm font-medium text-muted-foreground">Try asking:</p>
          <div className="grid gap-3">
            {examplePrompts.map((prompt, index) => (
              <Card
                key={index}
                className="p-4 hover-elevate active-elevate-2 cursor-pointer transition-all rounded-xl"
                onClick={() => onExampleClick?.(prompt)}
                data-testid={`card-example-${index}`}
              >
                <p className="text-[15px] text-left leading-relaxed">{prompt}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
