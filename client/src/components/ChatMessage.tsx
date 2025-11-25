import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sparkles, User } from "lucide-react";
import { format } from "date-fns";

export interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  taskCard?: {
    title: string;
    taskId: string;
    status: string;
    dueDate?: string;
  };
}

export default function ChatMessage({ role, content, timestamp, taskCard }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback className={isUser ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}>
          {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div className={`flex flex-col gap-2 max-w-[70%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-md px-4 py-3 ${
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-card border border-card-border"
          }`}
          data-testid={`message-${role}`}
        >
          <p className="text-base whitespace-pre-wrap break-words">{content}</p>
        </div>

        {taskCard && !isUser && (
          <div
            className="w-full border border-primary/20 bg-accent/50 rounded-md p-3 space-y-2"
            data-testid="task-card"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-sm flex-1">{taskCard.title}</p>
              <Badge variant="secondary" className="text-xs" data-testid="task-status">
                {taskCard.status}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <code className="font-mono bg-muted px-1.5 py-0.5 rounded" data-testid="task-id">
                {taskCard.taskId}
              </code>
              {taskCard.dueDate && <span>Due: {taskCard.dueDate}</span>}
            </div>
          </div>
        )}

        <span className={`text-xs text-muted-foreground ${isUser ? "text-right" : "text-left"}`}>
          {format(timestamp, "h:mm a")}
        </span>
      </div>
    </div>
  );
}
