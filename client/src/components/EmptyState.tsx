import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export interface EmptyStateProps {
  onExampleClick?: (example: string) => void;
}

const examplePrompts = [
  "What should I work on next?",
  "Run triage",
  "I have 30 minutes and low energy",
  "Who's missing an active or queued task?",
  "Who needs attention?",
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
            Your Work OS
          </h2>
          <p className="text-[15px] text-muted-foreground leading-relaxed max-w-lg mx-auto">
            One move per client, every day. Just tell me what to do and I'll execute immediately.
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
