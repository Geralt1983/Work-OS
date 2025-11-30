import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  LayoutGrid, 
  MessageSquare, 
  BarChart3, 
  Plus, 
  ClipboardCheck, 
  Sun, 
  Moon,
} from "lucide-react";
import { playSfx } from "@/lib/sounds";
import MoveForm from "@/components/MoveForm";
import { TriageDialog } from "@/components/TriageDialog";
import { useQuery } from "@tanstack/react-query";
import type { Client } from "@shared/schema";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [triageOpen, setTriageOpen] = useState(false);
  const [, setLocation] = useLocation();
  
  const { data: clients = [] } = useQuery<Client[]>({ 
    queryKey: ["/api/clients"],
    enabled: createOpen 
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
        playSfx("click");
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    playSfx("click");
    command();
  };

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", !isDark);
    localStorage.setItem("theme", !isDark ? "dark" : "light");
  };

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <div className="glass-strong border-0">
          <CommandInput 
            placeholder="Type a command or search..." 
            className="text-base"
            data-testid="input-command-palette"
          />
          <CommandList className="custom-scrollbar">
            <CommandEmpty>No results found.</CommandEmpty>
            
            <CommandGroup heading="Navigation">
              <CommandItem 
                onSelect={() => runCommand(() => setLocation("/"))}
                data-testid="command-go-chat"
              >
                <MessageSquare className="mr-2 h-4 w-4 text-purple-400" />
                <span>Go to Chat</span>
              </CommandItem>
              <CommandItem 
                onSelect={() => runCommand(() => setLocation("/moves"))}
                data-testid="command-go-moves"
              >
                <LayoutGrid className="mr-2 h-4 w-4 text-cyan-400" />
                <span>Go to Moves Board</span>
              </CommandItem>
              <CommandItem 
                onSelect={() => runCommand(() => setLocation("/metrics"))}
                data-testid="command-go-metrics"
              >
                <BarChart3 className="mr-2 h-4 w-4 text-pink-400" />
                <span>Go to Metrics</span>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator className="bg-white/10" />

            <CommandGroup heading="Actions">
              <CommandItem 
                onSelect={() => runCommand(() => setCreateOpen(true))}
                data-testid="command-create-move"
              >
                <Plus className="mr-2 h-4 w-4 text-emerald-400" />
                <span>Create New Move</span>
                <span className="ml-auto text-xs text-muted-foreground/50 font-mono">C</span>
              </CommandItem>
              <CommandItem 
                onSelect={() => runCommand(() => setTriageOpen(true))}
                data-testid="command-run-triage"
              >
                <ClipboardCheck className="mr-2 h-4 w-4 text-orange-400" />
                <span>Run Triage</span>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator className="bg-white/10" />

            <CommandGroup heading="System">
              <CommandItem 
                onSelect={() => runCommand(toggleTheme)}
                data-testid="command-toggle-theme"
              >
                <Sun className="mr-2 h-4 w-4" />
                <span>Toggle Theme</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </div>
      </CommandDialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-[#141420] border-white/10 text-white sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-white">Create Move</DialogTitle>
          </DialogHeader>
          <MoveForm 
            clients={clients} 
            onSuccess={() => { 
              setCreateOpen(false); 
            }} 
          />
        </DialogContent>
      </Dialog>

      <TriageDialog open={triageOpen} onOpenChange={setTriageOpen} />
    </>
  );
}
