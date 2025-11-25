import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Moon, Sun } from "lucide-react";
import { useState, useEffect } from "react";

export interface ChatHeaderProps {
  onClearChat: () => void;
  isConnected?: boolean;
}

export default function ChatHeader({ onClearChat, isConnected = true }: ChatHeaderProps) {
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
    <header className="border-b bg-background px-4 py-3" data-testid="header-chat">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-semibold" data-testid="text-app-title">
              ClickUp Assistant
            </h1>
            <p className="text-sm text-muted-foreground">Manage tasks naturally</p>
          </div>
          <Badge
            variant={isConnected ? "default" : "destructive"}
            className="text-xs"
            data-testid="badge-connection-status"
          >
            <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            data-testid="button-theme-toggle"
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearChat}
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
