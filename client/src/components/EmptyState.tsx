import { Sparkles } from "lucide-react";

export interface EmptyStateProps {
  onExampleClick?: (example: string) => void;
}

const examplePrompts = [
  "What should I work on next?",
  "Run triage",
  "I have 30 minutes and low energy",
  "Who needs attention?",
];

export default function EmptyState({ onExampleClick }: EmptyStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8 min-h-full">
      <div className="max-w-2xl w-full space-y-8 text-center">
        {/* Glowing Logo with Geometric Frame */}
        <div className="flex justify-center">
          <div className="relative">
            {/* Outer rotating ring */}
            <div className="absolute inset-0 rounded-full animate-[spin_10s_linear_infinite]">
              <div className="w-full h-full rounded-full border-2 border-dashed border-purple-500/30" />
            </div>
            
            {/* Diamond decorations */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 border-2 border-cyan-500/50" />
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 border-2 border-cyan-500/50" />
            <div className="absolute top-1/2 -left-6 -translate-y-1/2 w-4 h-4 rotate-45 border-2 border-purple-500/50" />
            <div className="absolute top-1/2 -right-6 -translate-y-1/2 w-4 h-4 rotate-45 border-2 border-purple-500/50" />
            
            {/* Main glow circle */}
            <div className="relative hex-frame rounded-full bg-gradient-to-br from-purple-600/20 to-cyan-600/20 p-8 border border-purple-500/40">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-600/10 to-cyan-600/10 animate-pulse" />
              <Sparkles className="h-12 w-12 text-cyan-400 relative z-10" />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-3xl font-display font-semibold tracking-wider text-gradient-purple" data-testid="text-welcome-title">
            Your Work OS
          </h2>
          <p className="text-[15px] text-muted-foreground leading-relaxed max-w-lg mx-auto">
            One move per client, every day. Just tell me what to do and I'll execute immediately.
          </p>
        </div>

        <div className="space-y-4 pt-4">
          <p className="text-sm font-medium text-cyan-400/80">Try asking:</p>
          <div className="grid gap-3">
            {examplePrompts.map((prompt, index) => (
              <button
                key={index}
                className="suggestion-pill p-4 rounded-xl cursor-pointer text-left"
                onClick={() => onExampleClick?.(prompt)}
                data-testid={`card-example-${index}`}
              >
                <p className="text-[15px] leading-relaxed text-foreground/90">{prompt}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
