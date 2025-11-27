import { motion } from "framer-motion";
import { Sparkles, MessageSquare, ListTodo, Zap, Calendar } from "lucide-react";

export interface EmptyStateProps {
  onExampleClick?: (example: string) => void;
}

const suggestions = [
  { text: "What should I work on next?", icon: Zap },
  { text: "Show me stale clients", icon: Calendar },
  { text: "Run triage", icon: ListTodo },
  { text: "Summarize today", icon: MessageSquare },
];

const springTransition = {
  type: "spring",
  stiffness: 400,
  damping: 30,
};

export default function EmptyState({ onExampleClick }: EmptyStateProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springTransition, delay: 0.1 }}
        className="text-center max-w-md"
      >
        {/* Animated Logo */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ ...springTransition, delay: 0.2 }}
          className="relative mx-auto mb-6 w-20 h-20"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500 via-pink-500 to-cyan-500 opacity-20 blur-xl"
          />
          <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-glow-purple">
            <Sparkles className="w-9 h-9 text-white" />
          </div>
        </motion.div>

        {/* Title */}
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springTransition, delay: 0.3 }}
          className="text-2xl sm:text-3xl font-bold text-gradient-purple mb-3"
          data-testid="text-welcome-title"
        >
          Your Work OS
        </motion.h2>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springTransition, delay: 0.4 }}
          className="text-muted-foreground text-sm sm:text-base mb-8"
        >
          One move per client, every day. Just tell me what to do and I'll execute immediately.
        </motion.p>

        {/* Suggestions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springTransition, delay: 0.5 }}
          className="space-y-2"
        >
          <p className="text-sm text-muted-foreground/60 mb-3">Try asking:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {suggestions.map((suggestion, index) => {
              const Icon = suggestion.icon;
              return (
                <motion.button
                  key={suggestion.text}
                  onClick={() => onExampleClick?.(suggestion.text)}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ ...springTransition, delay: 0.6 + index * 0.1 }}
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/30 text-sm transition-colors shadow-lg hover:shadow-glow-purple"
                  data-testid={`card-example-${index}`}
                >
                  <Icon className="w-4 h-4 text-purple-400" />
                  <span>{suggestion.text}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
