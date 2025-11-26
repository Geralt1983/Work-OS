import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sparkles, User } from "lucide-react";
import { format } from "date-fns";

export interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  imageBase64?: string;
  taskCard?: {
    title: string;
    taskId: string;
    status: string;
    dueDate?: string;
  };
}

export default function ChatMessage({ role, content, timestamp, imageBase64, taskCard }: ChatMessageProps) {
  const isUser = role === "user";
  const displayContent = content.replace("[Image attached]\n", "");

  return (
    <div className={`flex gap-4 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <Avatar className="h-9 w-9 flex-shrink-0">
        <AvatarFallback className={isUser ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}>
          {isUser ? <User className="h-[18px] w-[18px]" /> : <Sparkles className="h-[18px] w-[18px]" />}
        </AvatarFallback>
      </Avatar>

      <div className={`flex flex-col gap-2.5 max-w-[65%] ${isUser ? "items-end" : "items-start"}`}>
        {imageBase64 && isUser && (
          <div className="rounded-xl overflow-hidden border max-w-xs">
            <img 
              src={`data:image/jpeg;base64,${imageBase64}`} 
              alt="Uploaded" 
              className="max-w-full max-h-48 object-contain"
              data-testid="message-image"
            />
          </div>
        )}
        <div
          className={`rounded-2xl px-5 py-3.5 ${
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-secondary border border-border/50"
          }`}
          data-testid={`message-${role}`}
        >
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{displayContent}</p>
        </div>

        {taskCard && !isUser && (
          <div
            className="w-full border border-border bg-card rounded-xl p-4 space-y-2.5"
            data-testid="task-card"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-[15px] flex-1 leading-snug">{taskCard.title}</p>
              <Badge variant="secondary" className="text-xs rounded-full" data-testid="task-status">
                {taskCard.status}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <code className="font-mono bg-muted/50 px-2 py-1 rounded-md" data-testid="task-id">
                {taskCard.taskId}
              </code>
              {taskCard.dueDate && <span>Due: {taskCard.dueDate}</span>}
            </div>
          </div>
        )}

        <span className={`text-xs text-muted-foreground px-1 ${isUser ? "text-right" : "text-left"}`}>
          {format(timestamp, "h:mm a")}
        </span>
      </div>
    </div>
  );
}
