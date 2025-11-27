import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { MessageSquare, LayoutGrid, BarChart3, ClipboardCheck } from "lucide-react";

interface NavItem {
  path: string;
  icon: typeof MessageSquare;
  label: string;
  color: string;
}

const navItems: NavItem[] = [
  { path: "/", icon: MessageSquare, label: "Chat", color: "text-purple-400" },
  { path: "/moves", icon: LayoutGrid, label: "Moves", color: "text-cyan-400" },
  { path: "/metrics", icon: BarChart3, label: "Metrics", color: "text-emerald-400" },
];

interface MobileBottomNavProps {
  onTriageClick?: () => void;
}

export default function MobileBottomNav({ onTriageClick }: MobileBottomNavProps) {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-2" data-testid="mobile-bottom-nav">
      <div className="flex items-center justify-around gap-2 px-6 py-3 rounded-2xl bg-[#13131f]/90 backdrop-blur-xl border border-white/[0.08] shadow-lg">
        {navItems.map((item) => {
          const isActive = location === item.path;
          const Icon = item.icon;

          return (
            <Link key={item.path} href={item.path}>
              <motion.div
                className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl cursor-pointer"
                whileTap={{ scale: 0.95 }}
                data-testid={`mobile-nav-${item.label.toLowerCase()}`}
              >
                <motion.div
                  className={`p-2 rounded-xl transition-colors ${
                    isActive 
                      ? "bg-white/10" 
                      : "bg-transparent"
                  }`}
                  animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <Icon className={`w-5 h-5 ${isActive ? item.color : "text-muted-foreground"}`} />
                </motion.div>
                <span className={`text-[10px] font-medium ${isActive ? "text-white" : "text-muted-foreground"}`}>
                  {item.label}
                </span>
              </motion.div>
            </Link>
          );
        })}

        {onTriageClick && (
          <motion.button
            onClick={onTriageClick}
            className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl cursor-pointer"
            whileTap={{ scale: 0.95 }}
            data-testid="mobile-nav-triage"
          >
            <div className="p-2 rounded-xl bg-transparent">
              <ClipboardCheck className="w-5 h-5 text-muted-foreground" />
            </div>
            <span className="text-[10px] font-medium text-muted-foreground">Triage</span>
          </motion.button>
        )}
      </div>
    </nav>
  );
}
