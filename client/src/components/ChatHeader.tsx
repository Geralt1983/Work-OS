import { Button } from "@/components/ui/button";
import { Trash2, BarChart3, ListTodo } from "lucide-react";
import { Link } from "wouter";
import magnetoIcon from "@assets/Screenshot_20251126_222748_Gallery_1764214095163.jpg";

export interface ChatHeaderProps {
  onClearChat: () => void;
  onTriageClick?: () => void;
  isConnected?: boolean;
}

export default function ChatHeader({ onClearChat, onTriageClick, isConnected = true }: ChatHeaderProps) {
  return (
    <header className="glass-strong border-b border-purple-500/20 px-3 sm:px-6 py-3 sm:py-4 relative" data-testid="header-chat">
      {/* Bottom glow line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
      
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div>
            <h1 className="text-lg sm:text-xl font-display font-semibold tracking-wider text-gradient-purple whitespace-nowrap" data-testid="text-app-title">
              Work OS
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Move clients forward, daily</p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Status indicator */}
          <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-cyan-400 pulse-cyan' : 'bg-rose-500'}`} />
          
          {/* Nav links */}
          <Link href="/moves">
            <Button
              variant="ghost"
              className="rounded-full h-9 w-9 sm:w-auto sm:px-3 hover:bg-purple-500/10 hover:border-purple-500/30 border border-transparent transition-all"
              data-testid="button-moves"
              title="Moves"
            >
              <ListTodo className="h-[18px] w-[18px] sm:mr-2 text-purple-400" />
              <span className="hidden sm:inline">Moves</span>
            </Button>
          </Link>
          <Link href="/metrics">
            <Button
              variant="ghost"
              className="rounded-full h-9 w-9 sm:w-auto sm:px-3 hover:bg-purple-500/10 hover:border-purple-500/30 border border-transparent transition-all"
              data-testid="button-metrics"
              title="Metrics"
            >
              <BarChart3 className="h-[18px] w-[18px] sm:mr-2 text-cyan-400" />
              <span className="hidden sm:inline">Metrics</span>
            </Button>
          </Link>
          
          {/* Triage button - Magneto! */}
          {onTriageClick && (
            <Button
              variant="ghost"
              onClick={onTriageClick}
              className="rounded-full h-9 w-9 sm:w-auto sm:px-3 hover:bg-red-500/10 hover:border-red-500/30 border border-transparent transition-all group p-1"
              data-testid="button-triage"
              title="Run Triage"
            >
              <img 
                src={magnetoIcon} 
                alt="Triage" 
                className="min-w-[24px] min-h-[24px] w-6 h-6 sm:mr-2 rounded object-cover object-center group-hover:drop-shadow-[0_0_8px_rgba(220,38,38,0.6)] transition-all shrink-0" 
              />
              <span className="hidden sm:inline text-red-400">Triage</span>
            </Button>
          )}
          
          {/* Clear */}
          <Button
            variant="ghost"
            onClick={onClearChat}
            className="rounded-full h-9 w-9 sm:w-auto sm:px-3 hover:bg-rose-500/10 hover:border-rose-500/30 border border-transparent transition-all"
            data-testid="button-clear-chat"
            title="Clear chat"
          >
            <Trash2 className="h-[18px] w-[18px] sm:mr-2 text-muted-foreground" />
            <span className="hidden sm:inline">Clear</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
