import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sparkles } from "lucide-react";

export default function TypingIndicator() {
  return (
    <div className="flex gap-4">
      <Avatar className="h-9 w-9 flex-shrink-0 ring-2 ring-purple-500/30">
        <AvatarFallback className="bg-purple-600/80 text-white">
          <Sparkles className="h-[18px] w-[18px]" />
        </AvatarFallback>
      </Avatar>

      <div className="glass border border-purple-500/40 rounded-2xl px-5 py-3.5" data-testid="indicator-typing">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce glow-cyan" style={{ animationDelay: "0ms" }} />
          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce glow-cyan" style={{ animationDelay: "150ms" }} />
          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce glow-cyan" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}
