import { motion } from "framer-motion";
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

const springTransition = {
  type: "spring",
  stiffness: 400,
  damping: 30,
};

export default function ChatMessage({ role, content, timestamp, imagesBase64, taskCard }: ChatMessageProps) {
  const isUser = role === "user";
  const displayContent = content.replace(/\[Image(?:s)? attached\]\n?/g, "");

  return (
    <div className={`flex gap-4 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={springTransition}
      >
        <Avatar className={`h-9 w-9 flex-shrink-0 ${isUser ? 'shadow-glow-cyan' : 'shadow-glow-purple'}`}>
          <AvatarFallback className={`${isUser ? "bg-gradient-to-br from-cyan-500 to-blue-500" : "bg-gradient-to-br from-purple-500 to-pink-500"} text-white`}>
            {isUser ? <User className="h-[18px] w-[18px]" /> : <Sparkles className="h-[18px] w-[18px]" />}
          </AvatarFallback>
        </Avatar>
      </motion.div>

      <div className={`flex flex-col gap-2.5 max-w-[70%] ${isUser ? "items-end" : "items-start"}`}>
        {/* Attached Images */}
        {imagesBase64 && imagesBase64.length > 0 && isUser && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={springTransition}
            className="flex flex-wrap gap-2 justify-end"
          >
            {imagesBase64.map((img, index) => (
              <div key={index} className="rounded-2xl overflow-hidden border border-white/10 max-w-[150px] shadow-lg">
                <img 
                  src={`data:image/jpeg;base64,${img}`} 
                  alt={`Uploaded ${index + 1}`} 
                  className="max-w-full max-h-32 object-contain"
                  data-testid={`message-image-${index}`}
                />
              </div>
            ))}
          </motion.div>
        )}

        {/* Message Bubble */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={springTransition}
          className={`rounded-3xl px-5 py-3.5 ${
            isUser
              ? "bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/20 shadow-glow-cyan"
              : "bg-white/5 border border-white/10"
          }`}
          data-testid={`message-${role}`}
        >
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{displayContent}</p>
        </motion.div>

        {/* Task Card */}
        {taskCard && !isUser && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springTransition, delay: 0.1 }}
            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2.5 shadow-lg"
            data-testid="task-card"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-[15px] flex-1 leading-snug">{taskCard.title}</p>
              <Badge variant="secondary" className="text-xs rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30" data-testid="task-status">
                {taskCard.status}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <code className="font-mono bg-white/5 px-2 py-1 rounded-lg border border-white/10" data-testid="task-id">
                {taskCard.taskId}
              </code>
              {taskCard.dueDate && <span className="text-cyan-400/70">Due: {taskCard.dueDate}</span>}
            </div>
          </motion.div>
        )}

        {/* Timestamp */}
        <span className={`text-xs px-1 text-muted-foreground/60`}>
          {format(timestamp, "h:mm a")}
        </span>
      </div>
    </div>
  );
}
