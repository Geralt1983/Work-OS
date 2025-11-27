import { Button } from "@/components/ui/button";
import { Trash2, BarChart3, ListTodo } from "lucide-react";
import { Link } from "wouter";

// Magneto helmet icon - based on the classic X-Men design
function MagnetoIcon({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      className={className}
      aria-label="Triage"
    >
      {/* Main helmet - crimson red */}
      <path 
        d="M12 1L10 3C8.5 3 6 5 5 8L4 11V15L5 18L7 21H17L19 18L20 15V11L19 8C18 5 15.5 3 14 3L12 1Z" 
        fill="#b91c1c"
      />
      {/* Crown point/crest at top */}
      <path 
        d="M12 1L10.5 4L12 2.5L13.5 4L12 1Z" 
        fill="#dc2626"
      />
      {/* Left purple side guard */}
      <path 
        d="M5 8L4 11V15L5 18L7 17V10L5 8Z" 
        fill="#7c3aed"
      />
      {/* Right purple side guard */}
      <path 
        d="M19 8L20 11V15L19 18L17 17V10L19 8Z" 
        fill="#7c3aed"
      />
      {/* Face opening - dark void */}
      <path 
        d="M8 10C8 9 9.5 7 12 7C14.5 7 16 9 16 10V16C16 17 15 18 14 18H10C9 18 8 17 8 16V10Z" 
        fill="#0a0a14"
      />
      {/* Left eye - glowing cyan */}
      <ellipse cx="9.5" cy="12" rx="1" ry="0.6" fill="#22d3d3">
        <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite" />
      </ellipse>
      {/* Right eye - glowing cyan */}
      <ellipse cx="14.5" cy="12" rx="1" ry="0.6" fill="#22d3d3">
        <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite" />
      </ellipse>
      {/* Purple accent line down center forehead */}
      <path 
        d="M12 4L12 7" 
        stroke="#a855f7" 
        strokeWidth="1"
        strokeLinecap="round"
      />
      {/* Helmet shine highlight */}
      <path 
        d="M8 5C9 4 10.5 3.5 12 3.5C13.5 3.5 15 4 16 5" 
        stroke="#ef4444" 
        strokeWidth="0.5"
        fill="none"
        opacity="0.6"
      />
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
