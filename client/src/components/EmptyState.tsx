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
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-primary/10 p-4">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-semibold" data-testid="text-welcome-title">
            Welcome to ClickUp Assistant
          </h2>
          <p className="text-muted-foreground">
            Tell me what you'd like to do with your tasks, and I'll help you manage them naturally.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Try asking:</p>
          <div className="grid gap-2">
            {examplePrompts.map((prompt, index) => (
              <Card
                key={index}
                className="p-3 hover-elevate active-elevate-2 cursor-pointer transition-all"
                onClick={() => onExampleClick?.(prompt)}
                data-testid={`card-example-${index}`}
              >
                <p className="text-sm text-left">{prompt}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
