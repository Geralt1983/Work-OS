import { Button } from "@/components/ui/button";
import { Trash2, BarChart3, ListTodo } from "lucide-react";
import { Link } from "wouter";

// Magneto helmet icon - cyberpunk triage button
function MagnetoIcon({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      className={className}
      aria-label="Triage"
    >
      {/* Helmet base */}
      <path 
        d="M12 2C7 2 3 6.5 3 11v2c0 1.5.5 3 1.5 4.2L6 19v2c0 .5.5 1 1 1h10c.5 0 1-.5 1-1v-2l1.5-1.8c1-1.2 1.5-2.7 1.5-4.2v-2c0-4.5-4-9-9-9z" 
        fill="#dc2626"
      />
      {/* Helmet shine */}
      <path 
        d="M6 8c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5" 
        fill="none" 
        stroke="#ef4444" 
        strokeWidth="1.5"
      />
      {/* Face opening */}
      <path 
        d="M8 12c0-2.2 1.8-4 4-4s4 1.8 4 4v3c0 .5-.5 1-1 1H9c-.5 0-1-.5-1-1v-3z" 
        fill="#0a0a14" 
      />
      {/* Eye slits */}
      <rect x="9" y="11" width="2" height="1.5" rx="0.5" fill="#dc2626" />
      <rect x="13" y="11" width="2" height="1.5" rx="0.5" fill="#dc2626" />
    </svg>
  );
}

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
              className="rounded-full h-9 w-9 sm:w-auto sm:px-3 hover:bg-red-500/10 hover:border-red-500/30 border border-transparent transition-all group"
              data-testid="button-triage"
              title="Run Triage"
            >
              <MagnetoIcon className="h-[20px] w-[20px] sm:mr-2 group-hover:drop-shadow-[0_0_8px_rgba(220,38,38,0.6)] transition-all" />
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
