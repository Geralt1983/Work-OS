import { motion } from "framer-motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sparkles } from "lucide-react";

const springTransition = {
  type: "spring",
  stiffness: 400,
  damping: 30,
};

export default function TypingIndicator() {
  return (
    <div className="flex gap-4">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={springTransition}
      >
        <Avatar className="h-9 w-9 flex-shrink-0 shadow-glow-purple">
          <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
            <Sparkles className="h-[18px] w-[18px]" />
          </AvatarFallback>
        </Avatar>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={springTransition}
        className="bg-white/5 border border-white/10 rounded-3xl px-5 py-3.5" 
        data-testid="indicator-typing"
      >
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full"
              animate={{
                y: [0, -6, 0],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.15,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
