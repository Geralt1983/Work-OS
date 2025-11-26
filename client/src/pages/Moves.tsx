import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Move, Client, MoveStatus, DrainType } from "@shared/schema";
import { EFFORT_LEVELS, DRAIN_TYPES, normalizeDrainType } from "@shared/schema";
import { MessageSquare, BarChart3, Plus, ChevronUp, ChevronDown, Check, Trash2, Sun, Moon, Zap, Brain, Mail, FileText, Lightbulb } from "lucide-react";
import MoveForm from "@/components/MoveForm";

const STATUS_LABELS: Record<MoveStatus, { label: string; color: string }> = {
  active: { label: "Active", color: "bg-green-500/10 text-green-600 dark:text-green-400" },
  queued: { label: "Queued", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  backlog: { label: "Backlog", color: "bg-gray-500/10 text-gray-600 dark:text-gray-400" },
  done: { label: "Done", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
};

const DRAIN_ICONS: Record<DrainType, typeof Brain> = {
  deep: Brain,
  comms: Mail,
  admin: FileText,
  creative: Lightbulb,
  easy: Zap,
};

function MoveCard({ move, clients, onUpdate }: { move: Move; clients: Client[]; onUpdate: () => void }) {
  const { toast } = useToast();
  const client = clients.find(c => c.id === move.clientId);
  const effortLevel = EFFORT_LEVELS.find(e => e.value === move.effortEstimate);
  const normalizedDrainType = normalizeDrainType(move.drainType);
  const DrainIcon = normalizedDrainType ? DRAIN_ICONS[normalizedDrainType] : null;

  const promoteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/moves/${move.id}/promote`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
      onUpdate();
    },
  });

  const demoteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/moves/${move.id}/demote`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
      onUpdate();
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/moves/${move.id}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
      toast({ title: "Move completed", description: move.title });
      onUpdate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/moves/${move.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
      toast({ title: "Move deleted" });
      onUpdate();
    },
  });

  const canPromote = move.status !== "active" && move.status !== "done";
  const canDemote = move.status !== "backlog" && move.status !== "done";

  return (
    <Card className="group hover-elevate" data-testid={`card-move-${move.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm leading-tight truncate" data-testid={`text-move-title-${move.id}`}>
              {move.title}
            </h4>
            {client && (
              <Badge variant="outline" className="mt-2 text-xs" data-testid={`badge-client-${move.id}`}>
                {client.name}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {canPromote && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => promoteMutation.mutate()}
                disabled={promoteMutation.isPending}
                data-testid={`button-promote-${move.id}`}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
            )}
            {canDemote && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => demoteMutation.mutate()}
                disabled={demoteMutation.isPending}
                data-testid={`button-demote-${move.id}`}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            )}
            {move.status !== "done" && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-green-600"
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                data-testid={`button-complete-${move.id}`}
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid={`button-delete-${move.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-2 mt-3">
          {effortLevel && (
            <Badge variant="secondary" className="text-xs" data-testid={`badge-effort-${move.id}`}>
              {effortLevel.label}
            </Badge>
          )}
          {DrainIcon && (
            <DrainIcon className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusColumn({ 
  status, 
  moves, 
  clients,
  onUpdate 
}: { 
  status: MoveStatus; 
  moves: Move[]; 
  clients: Client[];
  onUpdate: () => void;
}) {
  const statusInfo = STATUS_LABELS[status];
  const columnMoves = moves.filter(m => m.status === status);

  return (
    <div className="flex-1 min-w-[280px] max-w-[350px]" data-testid={`column-${status}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{statusInfo.label}</h3>
          <Badge variant="secondary" className="text-xs">
            {columnMoves.length}
          </Badge>
        </div>
      </div>
      
      <ScrollArea className="h-[calc(100vh-220px)]">
        <div className="space-y-3 pr-4">
          {columnMoves.map(move => (
            <MoveCard 
              key={move.id} 
              move={move} 
              clients={clients}
              onUpdate={onUpdate}
            />
          ))}
          {columnMoves.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No moves
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => 
    document.documentElement.classList.contains("dark")
  );

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    document.documentElement.classList.toggle("dark", newTheme);
    localStorage.setItem("theme", newTheme ? "dark" : "light");
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      data-testid="button-theme-toggle"
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}

export default function Moves() {
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: moves = [], isLoading: movesLoading, refetch: refetchMoves } = useQuery<Move[]>({
    queryKey: ["/api/moves"],
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const filteredMoves = clientFilter === "all" 
    ? moves 
    : moves.filter(m => m.clientId?.toString() === clientFilter);

  const handleMoveCreated = () => {
    setCreateDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
    toast({ title: "Move created" });
  };

  if (movesLoading || clientsLoading) {
    return (
      <div className="h-screen flex flex-col bg-background" data-testid="page-moves">
        <header className="h-16 border-b flex items-center justify-between px-6">
          <Skeleton className="h-6 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-9" />
          </div>
        </header>
        <div className="flex-1 p-6">
          <div className="flex gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex-1 min-w-[280px]">
                <Skeleton className="h-6 w-20 mb-4" />
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background" data-testid="page-moves">
      <header className="h-16 border-b flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold tracking-tight">Moves</h1>
          <nav className="flex items-center gap-1">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="link-chat">
                <MessageSquare className="h-4 w-4 mr-2" />
                Chat
              </Button>
            </Link>
            <Link href="/metrics">
              <Button variant="ghost" size="sm" data-testid="link-metrics">
                <BarChart3 className="h-4 w-4 mr-2" />
                Metrics
              </Button>
            </Link>
          </nav>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-client-filter">
              <SelectValue placeholder="All Clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map(client => (
                <SelectItem key={client.id} value={client.id.toString()}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-create-move">
                <Plus className="h-4 w-4 mr-2" />
                New Move
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Move</DialogTitle>
              </DialogHeader>
              <MoveForm clients={clients} onSuccess={handleMoveCreated} />
            </DialogContent>
          </Dialog>
          
          <ThemeToggle />
        </div>
      </header>

      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-6 min-w-max">
          <StatusColumn 
            status="active" 
            moves={filteredMoves} 
            clients={clients}
            onUpdate={() => refetchMoves()}
          />
          <StatusColumn 
            status="queued" 
            moves={filteredMoves} 
            clients={clients}
            onUpdate={() => refetchMoves()}
          />
          <StatusColumn 
            status="backlog" 
            moves={filteredMoves} 
            clients={clients}
            onUpdate={() => refetchMoves()}
          />
        </div>
      </div>
    </div>
  );
}
