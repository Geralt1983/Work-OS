import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ArcCardProps {
  children: React.ReactNode;
  glowColor?: "purple" | "cyan" | "pink" | "orange" | "emerald" | "none";
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  "data-testid"?: string;
}

export function ArcCard({ children, className, glowColor = "none", onClick, "data-testid": testId }: ArcCardProps) {
  const glowStyles = {
    purple: "hover:shadow-glow-purple hover:border-purple-500/40 group-hover:shadow-glow-purple",
    cyan: "hover:shadow-glow-cyan hover:border-cyan-500/40 group-hover:shadow-glow-cyan",
    pink: "hover:shadow-glow-pink hover:border-pink-500/40 group-hover:shadow-glow-pink",
    orange: "hover:shadow-glow-yellow hover:border-yellow-500/40 group-hover:shadow-glow-yellow",
    emerald: "hover:shadow-glow-emerald hover:border-emerald-500/40 group-hover:shadow-glow-emerald",
    none: "hover:border-white/20",
  };

  return (
    <motion.div
      layout
      onClick={onClick}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      data-testid={testId}
      className={cn(
        "relative rounded-3xl bg-[#141420]/80 backdrop-blur-xl border border-white/5",
        "transition-all duration-300 cursor-pointer overflow-hidden",
        "after:absolute after:inset-0 after:rounded-3xl after:ring-1 after:ring-inset after:ring-white/10 after:pointer-events-none",
        glowStyles[glowColor],
        className
      )}
    >
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-noise mix-blend-overlay" />
      
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
}
