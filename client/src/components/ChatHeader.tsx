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
    <header className="border-b bg-background/95 backdrop-blur-lg px-6 py-4" data-testid="header-chat">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight" data-testid="text-app-title">
              ClickUp Assistant
            </h1>
            <p className="text-sm text-muted-foreground">Manage tasks naturally</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
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
