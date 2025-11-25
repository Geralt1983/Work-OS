import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sparkles } from "lucide-react";

export default function TypingIndicator() {
  return (
    <div className="flex gap-4">
      <Avatar className="h-9 w-9 flex-shrink-0">
        <AvatarFallback className="bg-secondary text-secondary-foreground">
          <Sparkles className="h-[18px] w-[18px]" />
        </AvatarFallback>
      </Avatar>

      <div className="bg-secondary border border-border/50 rounded-2xl px-5 py-3.5" data-testid="indicator-typing">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}
