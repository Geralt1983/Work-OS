import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sparkles, User } from "lucide-react";
import { format } from "date-fns";

export interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  imagesBase64?: string[];
  taskCard?: {
    title: string;
    taskId: string;
    status: string;
    dueDate?: string;
  };
}

export default function ChatMessage({ role, content, timestamp, imagesBase64, taskCard }: ChatMessageProps) {
  const isUser = role === "user";
  const displayContent = content.replace(/\[Image(?:s)? attached\]\n?/g, "");

  return (
    <div className={`flex gap-4 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <Avatar className={`h-9 w-9 flex-shrink-0 ${isUser ? '' : 'ring-2 ring-purple-500/30'}`}>
        <AvatarFallback className={isUser ? "bg-cyan-600 text-white" : "bg-purple-600/80 text-white"}>
          {isUser ? <User className="h-[18px] w-[18px]" /> : <Sparkles className="h-[18px] w-[18px]" />}
        </AvatarFallback>
      </Avatar>

      <div className={`flex flex-col gap-2.5 max-w-[65%] ${isUser ? "items-end" : "items-start"}`}>
        {imagesBase64 && imagesBase64.length > 0 && isUser && (
          <div className="flex flex-wrap gap-2 justify-end">
            {imagesBase64.map((img, index) => (
              <div key={index} className="rounded-xl overflow-hidden border border-cyan-500/30 max-w-[150px]">
                <img 
                  src={`data:image/jpeg;base64,${img}`} 
                  alt={`Uploaded ${index + 1}`} 
                  className="max-w-full max-h-32 object-contain"
                  data-testid={`message-image-${index}`}
                />
              </div>
            ))}
          </div>
        )}
        <div
          className={`glass rounded-2xl px-5 py-3.5 ${
            isUser
              ? "border-cyan-500/40 border"
              : "border-purple-500/40 border"
          }`}
          data-testid={`message-${role}`}
        >
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{displayContent}</p>
        </div>

        {taskCard && !isUser && (
          <div
            className="w-full glass border border-cyan-500/30 rounded-xl p-4 space-y-2.5"
            data-testid="task-card"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-[15px] flex-1 leading-snug text-cyan-100">{taskCard.title}</p>
              <Badge variant="secondary" className="text-xs rounded-full bg-purple-600/30 text-purple-200 border border-purple-500/30" data-testid="task-status">
                {taskCard.status}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <code className="font-mono bg-background/50 px-2 py-1 rounded-md border border-purple-500/20" data-testid="task-id">
                {taskCard.taskId}
              </code>
              {taskCard.dueDate && <span className="text-cyan-400/70">Due: {taskCard.dueDate}</span>}
            </div>
          </div>
        )}

        <span className={`text-xs px-1 ${isUser ? "text-right text-cyan-400/70" : "text-left text-purple-400/70"}`}>
          {format(timestamp, "h:mm a")}
        </span>
      </div>
    </div>
  );
}
