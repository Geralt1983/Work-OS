import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ArcCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: "purple" | "cyan" | "pink" | "orange" | "none";
  onClick?: (e: React.MouseEvent) => void;
}

export function ArcCard({ children, className, glowColor = "none", onClick }: ArcCardProps) {
  const glowStyles = {
    purple: "hover:shadow-glow-purple hover:border-purple-500/30",
    cyan: "hover:shadow-glow-cyan hover:border-cyan-500/30",
    pink: "hover:shadow-glow-pink hover:border-pink-500/30",
    orange: "hover:shadow-glow-yellow hover:border-yellow-500/30",
    none: "hover:border-white/20",
  };

  return (
    <motion.div
      layout
      onClick={onClick}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "relative rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10",
        "transition-all duration-300 cursor-pointer group",
        "after:absolute after:inset-0 after:rounded-3xl after:ring-1 after:ring-inset after:ring-white/10 after:pointer-events-none",
        glowStyles[glowColor],
        className
      )}
    >
      {children}
    </motion.div>
  );
}
