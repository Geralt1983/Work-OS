import { motion } from "framer-motion";

interface IslandLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export default function IslandLayout({ children, className = "" }: IslandLayoutProps) {
  return (
    <div className="flex-1 p-3 sm:p-4 lg:p-6 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 30,
        }}
        className={`h-full island overflow-hidden ${className}`}
        data-testid="island-container"
      >
        {children}
      </motion.div>
    </div>
  );
}

interface IslandHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function IslandHeader({ title, subtitle, children }: IslandHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 sm:px-6 py-4 border-b border-white/5">
      <div>
        <h1 className="text-xl font-bold text-gradient-purple" data-testid="island-title">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2">
          {children}
        </div>
      )}
    </div>
  );
}

interface IslandContentProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function IslandContent({ children, className = "", noPadding = false }: IslandContentProps) {
  return (
    <div className={`flex-1 overflow-auto ${noPadding ? "" : "p-4 sm:p-6"} ${className}`}>
      {children}
    </div>
  );
}
