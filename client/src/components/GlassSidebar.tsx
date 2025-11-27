import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { 
  MessageSquare, 
  ListTodo, 
  BarChart3, 
  ChevronLeft, 
  ChevronRight,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import magnetoIcon from "@assets/Screenshot_20251126_222748_Gallery_1764214095163.jpg";

interface GlassSidebarProps {
  onTriageClick?: () => void;
}

const navItems = [
  { path: "/", icon: MessageSquare, label: "Chat", color: "text-purple-400" },
  { path: "/moves", icon: ListTodo, label: "Moves", color: "text-cyan-400" },
  { path: "/metrics", icon: BarChart3, label: "Metrics", color: "text-pink-400" },
];

export default function GlassSidebar({ onTriageClick }: GlassSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [location] = useLocation();

  const sidebarVariants = {
    expanded: { width: 240 },
    collapsed: { width: 72 },
  };

  const springTransition = {
    type: "spring",
    stiffness: 300,
    damping: 30,
  };

  return (
    <motion.aside
      initial="expanded"
      animate={collapsed ? "collapsed" : "expanded"}
      variants={sidebarVariants}
      transition={springTransition}
      className="h-full glass-sidebar sidebar-edge-glow flex flex-col py-4 relative z-20"
      data-testid="sidebar"
    >
      {/* Logo/Brand */}
      <div className="px-4 mb-6">
        <motion.div 
          className="flex items-center gap-3"
          layout
          transition={springTransition}
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-glow-purple shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <h1 className="text-lg font-bold text-gradient-purple whitespace-nowrap">
                  Work OS
                </h1>
                <p className="text-xs text-muted-foreground whitespace-nowrap">
                  Move clients forward
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location === item.path;
          const Icon = item.icon;
          
          return (
            <Link key={item.path} href={item.path}>
              <motion.div
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer
                  transition-colors duration-200
                  ${isActive 
                    ? "bg-white/10 shadow-lg" 
                    : "hover:bg-white/5"
                  }
                `}
                whileHover={{ scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.98 }}
                transition={springTransition}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? item.color : "text-muted-foreground"}`} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.15 }}
                      className={`text-sm font-medium whitespace-nowrap ${isActive ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 w-1 h-6 bg-gradient-to-b from-purple-500 to-cyan-500 rounded-r-full"
                    transition={springTransition}
                  />
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Triage Button */}
      {onTriageClick && (
        <div className="px-3 mb-4">
          <motion.button
            onClick={onTriageClick}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
              bg-gradient-to-r from-rose-500/20 to-orange-500/20
              hover:from-rose-500/30 hover:to-orange-500/30
              border border-rose-500/30
              transition-all duration-200
            `}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={springTransition}
            data-testid="sidebar-triage"
          >
            <img 
              src={magnetoIcon} 
              alt="Triage" 
              className="w-6 h-6 rounded object-cover shrink-0"
            />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                  className="text-sm font-medium text-rose-400 whitespace-nowrap"
                >
                  Run Triage
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      )}

      {/* Collapse Toggle */}
      <div className="px-3 mt-auto">
        <motion.button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl hover:bg-white/5 transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}
          transition={springTransition}
          data-testid="sidebar-toggle"
        >
          <motion.div
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={springTransition}
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </motion.div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs text-muted-foreground"
              >
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </motion.aside>
  );
}
