import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Moon, Sun, BarChart3, ListTodo } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "wouter";

// Magneto's helmet icon - a fun triage button
function MagnetoIcon({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      className={className}
      aria-label="Triage"
    >
      {/* Helmet shape */}
      <path d="M12 2C7 2 3 6.5 3 11v2c0 1.5.5 3 1.5 4.2L6 19v2c0 .5.5 1 1 1h10c.5 0 1-.5 1-1v-2l1.5-1.8c1-1.2 1.5-2.7 1.5-4.2v-2c0-4.5-4-9-9-9z" />
      {/* Face opening */}
      <path d="M8 12c0-2.2 1.8-4 4-4s4 1.8 4 4v3c0 .5-.5 1-1 1H9c-.5 0-1-.5-1-1v-3z" fill="var(--background, white)" />
      {/* Eye slits */}
      <rect x="9" y="11" width="2" height="1.5" rx="0.5" />
      <rect x="13" y="11" width="2" height="1.5" rx="0.5" />
    </svg>
  );
}

export interface ChatHeaderProps {
  onClearChat: () => void;
  onTriageClick?: () => void;
  isConnected?: boolean;
}

export default function ChatHeader({ onClearChat, onTriageClick, isConnected = true }: ChatHeaderProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", newTheme);
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur-lg px-6 py-4" data-testid="header-chat">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight" data-testid="text-app-title">
              Work OS
            </h1>
            <p className="text-sm text-muted-foreground">Move clients forward, daily</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/moves">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full"
              data-testid="button-moves"
            >
              <ListTodo className="h-4 w-4 mr-2" />
              Moves
            </Button>
          </Link>
          <Link href="/metrics">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full"
              data-testid="button-metrics"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Metrics
            </Button>
          </Link>
          {onTriageClick && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onTriageClick}
              className="rounded-full sm:hidden"
              data-testid="button-triage-mobile"
              title="Run Triage"
            >
              <MagnetoIcon className="h-[18px] w-[18px]" />
            </Button>
          )}
          {onTriageClick && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onTriageClick}
              className="rounded-full hidden sm:flex"
              data-testid="button-triage"
              title="Run Triage"
            >
              <MagnetoIcon className="h-4 w-4 mr-2" />
              Triage
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full"
            data-testid="button-theme-toggle"
          >
            {theme === "light" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearChat}
            className="rounded-full"
            data-testid="button-clear-chat"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </div>
      </div>
    </header>
  );
}
