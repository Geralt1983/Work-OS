import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ArcCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  glowColor?: "purple" | "cyan" | "pink" | "orange" | "emerald" | "none";
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

export function ArcCard({ children, className, glowColor = "none", onClick, ...props }: ArcCardProps) {
  const glowStyles = {
    purple: "hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.3)] hover:border-purple-500/50",
    cyan: "hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.3)] hover:border-cyan-500/50",
    pink: "hover:shadow-[0_0_30px_-5px_rgba(236,72,153,0.3)] hover:border-pink-500/50",
    orange: "hover:shadow-[0_0_30px_-5px_rgba(249,115,22,0.3)] hover:border-orange-500/50",
    emerald: "hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)] hover:border-emerald-500/50",
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
        "relative rounded-3xl bg-[#13131f]/70 backdrop-blur-xl",
        "border border-white/[0.08]",
        "transition-all duration-300 cursor-pointer overflow-hidden",
        glowStyles[glowColor],
        className
      )}
      {...props}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />
      
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
}
