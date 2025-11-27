import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Move, Client, MoveStatus, DrainType } from "@shared/schema";
import { EFFORT_LEVELS, DRAIN_TYPES, normalizeDrainType } from "@shared/schema";
import { 
  MessageSquare, BarChart3, Plus, ChevronUp, ChevronDown, Check, Trash2, 
  Sun, Moon, Zap, Brain, Mail, FileText, Lightbulb, AlertCircle, Clock,
  LayoutGrid, List, Eye, EyeOff, ArrowUpDown, ArrowUp, ArrowDown, GripVertical,
  ClipboardCheck
} from "lucide-react";
import MoveForm from "@/components/MoveForm";
import MoveDetailSheet from "@/components/MoveDetailSheet";
import MobileMovesView from "@/components/MobileMovesView";
import { TriageDialog } from "@/components/TriageDialog";

type ViewMode = "board" | "list";
type SortField = "title" | "client" | "status" | "effort" | "drain" | "created";
type SortDirection = "asc" | "desc";

const STATUS_LABELS: Record<MoveStatus, { label: string; color: string }> = {
  active: { label: "Active", color: "bg-green-500/10 text-green-600 dark:text-green-400" },
  queued: { label: "Queued", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  backlog: { label: "Backlog", color: "bg-gray-500/10 text-gray-600 dark:text-gray-400" },
  done: { label: "Done", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
};

const STATUS_ORDER: MoveStatus[] = ["active", "queued", "backlog", "done"];

const DRAIN_ICONS: Record<DrainType, typeof Brain> = {
  deep: Brain,
  comms: Mail,
  admin: FileText,
  creative: Lightbulb,
  easy: Zap,
};

const DRAIN_LABELS: Record<DrainType, string> = {
  deep: "Deep",
  comms: "Comms",
  admin: "Admin",
  creative: "Creative",
  easy: "Easy",
};

function getDaysOld(createdAt: Date | string | null): number {
  if (!createdAt) return 0;
  const created = new Date(createdAt);
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

function MoveCard({ 
  move, 
  clients, 
  onUpdate,
  onSelect,
  isDragging
}: { 
  move: Move; 
  clients: Client[]; 
  onUpdate: () => void;
  onSelect: () => void;
  isDragging?: boolean;
}) {
  const { toast } = useToast();
  const client = clients.find(c => c.id === move.clientId);
  const effortLevel = EFFORT_LEVELS.find(e => e.value === move.effortEstimate);
  const normalizedDrainType = normalizeDrainType(move.drainType);
  const DrainIcon = normalizedDrainType ? DRAIN_ICONS[normalizedDrainType] : null;
  
  const daysOld = getDaysOld(move.createdAt);
  const isAging = daysOld >= 7 && move.status === "backlog";
  const isStale = daysOld >= 10 && move.status === "backlog";

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

  const canPromote = move.status !== "active" && move.status !== "done";
  const canDemote = move.status !== "backlog" && move.status !== "done";

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    onSelect();
  };

  return (
    <Card 
      className={`group cursor-pointer hover-elevate transition-shadow ${
        isDragging ? "shadow-lg ring-2 ring-primary/50" : ""
      } ${isStale ? "border-orange-400 dark:border-orange-600" : isAging ? "border-yellow-400 dark:border-yellow-600" : ""}`}
      onClick={handleCardClick}
      data-testid={`card-move-${move.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-sm leading-tight truncate flex-1" data-testid={`text-move-title-${move.id}`}>
                {move.title}
              </h4>
              {isStale && (
                <Badge variant="destructive" className="text-xs gap-1 shrink-0" data-testid={`badge-stale-${move.id}`}>
                  <AlertCircle className="h-3 w-3" />
                  {daysOld}d
                </Badge>
              )}
              {isAging && !isStale && (
                <Badge variant="outline" className="text-xs gap-1 shrink-0 text-yellow-600 border-yellow-400" data-testid={`badge-aging-${move.id}`}>
                  <Clock className="h-3 w-3" />
                  {daysOld}d
                </Badge>
              )}
            </div>
            {client && (
              <Badge variant="outline" className="mt-2 text-xs" data-testid={`badge-client-${move.id}`}>
                {client.name}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {canPromote && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={(e) => { e.stopPropagation(); promoteMutation.mutate(); }}
                disabled={promoteMutation.isPending}
                data-testid={`button-promote-${move.id}`}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
            )}
            {canDemote && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={(e) => { e.stopPropagation(); demoteMutation.mutate(); }}
                disabled={demoteMutation.isPending}
                data-testid={`button-demote-${move.id}`}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            )}
            {move.status !== "done" && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-green-600"
                onClick={(e) => { e.stopPropagation(); completeMutation.mutate(); }}
                disabled={completeMutation.isPending}
                data-testid={`button-complete-${move.id}`}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
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
  onUpdate,
  onSelectMove
}: { 
  status: MoveStatus; 
  moves: Move[]; 
  clients: Client[];
  onUpdate: () => void;
  onSelectMove: (move: Move) => void;
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
      
      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`min-h-[200px] rounded-lg transition-colors ${
              snapshot.isDraggingOver ? "bg-muted/50" : ""
            }`}
          >
            <ScrollArea className="h-[calc(100vh-260px)]">
              <div className="space-y-3 pr-4">
                {columnMoves.map((move, index) => (
                  <Draggable key={move.id} draggableId={move.id.toString()} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                      >
                        <MoveCard 
                          move={move} 
                          clients={clients}
                          onUpdate={onUpdate}
                          onSelect={() => onSelectMove(move)}
                          isDragging={snapshot.isDragging}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
                {columnMoves.length === 0 && !snapshot.isDraggingOver && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No moves
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </Droppable>
    </div>
  );
}

function MoveListRow({ 
  move, 
  clients, 
  onUpdate,
  onSelect
}: { 
  move: Move; 
  clients: Client[]; 
  onUpdate: () => void;
  onSelect: () => void;
}) {
  const { toast } = useToast();
  const client = clients.find(c => c.id === move.clientId);
  const effortLevel = EFFORT_LEVELS.find(e => e.value === move.effortEstimate);
  const normalizedDrainType = normalizeDrainType(move.drainType);
  const DrainIcon = normalizedDrainType ? DRAIN_ICONS[normalizedDrainType] : null;
  const statusInfo = STATUS_LABELS[move.status as MoveStatus];
  
  const daysOld = getDaysOld(move.createdAt);
  const isAging = daysOld >= 7 && move.status === "backlog";
  const isStale = daysOld >= 10 && move.status === "backlog";

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

  const handleRowClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    onSelect();
  };

  return (
    <TableRow 
      className={`group cursor-pointer ${isStale ? "bg-orange-500/5" : isAging ? "bg-yellow-500/5" : ""}`}
      onClick={handleRowClick}
      data-testid={`row-move-${move.id}`}
    >
      <TableCell className="font-medium max-w-[300px]">
        <div className="flex items-center gap-2">
          <span className="truncate" data-testid={`text-row-title-${move.id}`}>{move.title}</span>
          {isStale && (
            <Badge variant="destructive" className="text-xs gap-1 shrink-0">
              <AlertCircle className="h-3 w-3" />
              {daysOld}d
            </Badge>
          )}
          {isAging && !isStale && (
            <Badge variant="outline" className="text-xs gap-1 shrink-0 text-yellow-600 border-yellow-400">
              <Clock className="h-3 w-3" />
              {daysOld}d
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        {client ? (
          <Badge variant="outline" className="text-xs">
            {client.name}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>
      <TableCell>
        <Badge className={`text-xs ${statusInfo.color}`}>
          {statusInfo.label}
        </Badge>
      </TableCell>
      <TableCell>
        {effortLevel ? (
          <Badge variant="secondary" className="text-xs">
            {effortLevel.label}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>
      <TableCell>
        {DrainIcon ? (
          <div className="flex items-center gap-1.5">
            <DrainIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm">{DRAIN_LABELS[normalizedDrainType!]}</span>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-0.5">
          {canPromote && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={(e) => { e.stopPropagation(); promoteMutation.mutate(); }}
              disabled={promoteMutation.isPending}
              data-testid={`button-row-promote-${move.id}`}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          )}
          {canDemote && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={(e) => { e.stopPropagation(); demoteMutation.mutate(); }}
              disabled={demoteMutation.isPending}
              data-testid={`button-row-demote-${move.id}`}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          )}
          {move.status !== "done" && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-green-600"
              onClick={(e) => { e.stopPropagation(); completeMutation.mutate(); }}
              disabled={completeMutation.isPending}
              data-testid={`button-row-complete-${move.id}`}
            >
              <Check className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive"
            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(); }}
            disabled={deleteMutation.isPending}
            data-testid={`button-row-delete-${move.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function ListView({ 
  moves, 
  clients, 
  onUpdate,
  onSelectMove,
  sortField,
  sortDirection,
  onSort
}: { 
  moves: Move[]; 
  clients: Client[]; 
  onUpdate: () => void;
  onSelectMove: (move: Move) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}) {
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 text-muted-foreground" />;
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3.5 w-3.5 ml-1" /> 
      : <ArrowDown className="h-3.5 w-3.5 ml-1" />;
  };

  const sortedMoves = [...moves].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case "title":
        comparison = a.title.localeCompare(b.title);
        break;
      case "client":
        const clientA = clients.find(c => c.id === a.clientId)?.name || "";
        const clientB = clients.find(c => c.id === b.clientId)?.name || "";
        comparison = clientA.localeCompare(clientB);
        break;
      case "status":
        comparison = STATUS_ORDER.indexOf(a.status as MoveStatus) - STATUS_ORDER.indexOf(b.status as MoveStatus);
        break;
      case "effort":
        comparison = (a.effortEstimate || 0) - (b.effortEstimate || 0);
        break;
      case "drain":
        const drainA = normalizeDrainType(a.drainType) || "";
        const drainB = normalizeDrainType(b.drainType) || "";
        comparison = drainA.localeCompare(drainB);
        break;
      case "created":
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        comparison = dateA - dateB;
        break;
    }
    
    return sortDirection === "asc" ? comparison : -comparison;
  });

  return (
    <div className="rounded-md border" data-testid="list-view">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onSort("title")}
              data-testid="sort-title"
            >
              <div className="flex items-center">
                Title
                <SortIcon field="title" />
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onSort("client")}
              data-testid="sort-client"
            >
              <div className="flex items-center">
                Client
                <SortIcon field="client" />
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onSort("status")}
              data-testid="sort-status"
            >
              <div className="flex items-center">
                Status
                <SortIcon field="status" />
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onSort("effort")}
              data-testid="sort-effort"
            >
              <div className="flex items-center">
                Effort
                <SortIcon field="effort" />
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onSort("drain")}
              data-testid="sort-drain"
            >
              <div className="flex items-center">
                Type
                <SortIcon field="drain" />
              </div>
            </TableHead>
            <TableHead className="w-[140px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedMoves.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                No moves found
              </TableCell>
            </TableRow>
          ) : (
            sortedMoves.map(move => (
              <MoveListRow 
                key={move.id} 
                move={move} 
                clients={clients} 
                onUpdate={onUpdate}
                onSelect={() => onSelectMove(move)}
              />
            ))
          )}
        </TableBody>
      </Table>
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
  const isMobile = useIsMobile();
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [drainFilter, setDrainFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [triageDialogOpen, setTriageDialogOpen] = useState(false);
  const [showBacklog, setShowBacklog] = useState(() => {
    const saved = localStorage.getItem("moves-show-backlog");
    return saved !== null ? saved === "true" : false;
  });
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("moves-view-mode");
    return (saved === "list" || saved === "board") ? saved : "board";
  });
  const [sortField, setSortField] = useState<SortField>("status");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedMove, setSelectedMove] = useState<Move | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    localStorage.setItem("moves-show-backlog", String(showBacklog));
  }, [showBacklog]);

  useEffect(() => {
    localStorage.setItem("moves-view-mode", viewMode);
  }, [viewMode]);

  const { data: moves = [], isLoading: movesLoading, refetch: refetchMoves } = useQuery<Move[]>({
    queryKey: ["/api/moves"],
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ moveId, newStatus, newIndex }: { moveId: number; newStatus: MoveStatus; newIndex: number }) => {
      await apiRequest("PATCH", `/api/moves/${moveId}`, { 
        status: newStatus,
        sortOrder: newIndex
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
    },
  });

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const moveId = parseInt(draggableId);
    const newStatus = destination.droppableId as MoveStatus;
    
    reorderMutation.mutate({
      moveId,
      newStatus,
      newIndex: destination.index
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleSelectMove = (move: Move) => {
    setSelectedMove(move);
    setDetailSheetOpen(true);
  };

  const filteredMoves = moves.filter(m => {
    if (!showBacklog && m.status === "backlog") return false;
    if (clientFilter !== "all" && m.clientId?.toString() !== clientFilter) return false;
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    if (drainFilter !== "all") {
      const normalized = normalizeDrainType(m.drainType);
      if (normalized !== drainFilter) return false;
    }
    return true;
  });

  const backlogCount = moves.filter(m => m.status === "backlog").length;

  const handleMoveCreated = () => {
    setCreateDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
    toast({ title: "Move created" });
  };

  const handleEditMove = (move: Move) => {
    setSelectedMove(move);
    setDetailSheetOpen(true);
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
          {isMobile ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
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
          )}
        </div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="h-screen flex flex-col space-bg" data-testid="page-moves">
        <header className="h-14 glass-strong border-b border-purple-500/20 flex items-center justify-between px-4 shrink-0 relative">
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
          <h1 className="text-lg font-display font-semibold tracking-wider text-gradient-purple">Moves</h1>
          <div className="flex items-center gap-1">
            <Link href="/">
              <Button variant="ghost" size="icon" className="hover:bg-purple-500/10" data-testid="mobile-link-chat">
                <MessageSquare className="h-5 w-5 text-purple-400" />
              </Button>
            </Link>
            <Link href="/metrics">
              <Button variant="ghost" size="icon" className="hover:bg-cyan-500/10" data-testid="mobile-link-metrics">
                <BarChart3 className="h-5 w-5 text-cyan-400" />
              </Button>
            </Link>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setTriageDialogOpen(true)}
              className="hover:bg-rose-500/10"
              data-testid="mobile-button-triage"
            >
              <ClipboardCheck className="h-5 w-5 text-rose-400" />
            </Button>
            <ThemeToggle />
          </div>
        </header>
        
        <MobileMovesView
          moves={moves}
          clients={clients}
          showBacklog={showBacklog}
          onToggleBacklog={setShowBacklog}
          onUpdate={() => refetchMoves()}
          onCreateMove={() => setCreateDialogOpen(true)}
          onEditMove={handleEditMove}
        />

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Move</DialogTitle>
            </DialogHeader>
            <MoveForm clients={clients} onSuccess={handleMoveCreated} />
          </DialogContent>
        </Dialog>

        <MoveDetailSheet
          move={selectedMove}
          clients={clients}
          open={detailSheetOpen}
          onOpenChange={setDetailSheetOpen}
          onUpdate={() => {
            refetchMoves();
            if (selectedMove) {
              const updatedMove = moves.find(m => m.id === selectedMove.id);
              if (updatedMove) setSelectedMove(updatedMove);
            }
          }}
        />

        <TriageDialog 
          open={triageDialogOpen} 
          onOpenChange={setTriageDialogOpen} 
        />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col space-bg" data-testid="page-moves">
      <header className="h-16 glass-strong border-b border-purple-500/20 flex items-center justify-between px-6 shrink-0 relative">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-display font-semibold tracking-wider text-gradient-purple">Moves</h1>
          <nav className="flex items-center gap-1">
            <Link href="/">
              <Button variant="ghost" size="sm" className="hover:bg-purple-500/10" data-testid="link-chat">
                <MessageSquare className="h-4 w-4 mr-2 text-purple-400" />
                Chat
              </Button>
            </Link>
            <Link href="/metrics">
              <Button variant="ghost" size="sm" className="hover:bg-cyan-500/10" data-testid="link-metrics">
                <BarChart3 className="h-4 w-4 mr-2 text-cyan-400" />
                Metrics
              </Button>
            </Link>
          </nav>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 border rounded-md p-1" data-testid="view-toggle">
            <Button
              size="icon"
              variant={viewMode === "board" ? "secondary" : "ghost"}
              className="h-7 w-7"
              onClick={() => setViewMode("board")}
              data-testid="button-view-board"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={viewMode === "list" ? "secondary" : "ghost"}
              className="h-7 w-7"
              onClick={() => setViewMode("list")}
              data-testid="button-view-list"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          
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
          
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => setTriageDialogOpen(true)}
            data-testid="button-run-triage"
          >
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Triage
          </Button>
          
          <ThemeToggle />
        </div>
      </header>

      <div className="border-b px-6 py-3 flex items-center gap-4 flex-wrap" data-testid="filter-bar">
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-client-filter">
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

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            {showBacklog && <SelectItem value="backlog">Backlog</SelectItem>}
          </SelectContent>
        </Select>

        <Select value={drainFilter} onValueChange={setDrainFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-drain-filter">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {DRAIN_TYPES.map(drain => (
              <SelectItem key={drain} value={drain}>
                {DRAIN_LABELS[drain]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 ml-auto">
          <Switch
            id="show-backlog"
            checked={showBacklog}
            onCheckedChange={setShowBacklog}
            data-testid="switch-show-backlog"
          />
          <Label htmlFor="show-backlog" className="text-sm text-muted-foreground cursor-pointer">
            Show Backlog
            {backlogCount > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {backlogCount}
              </Badge>
            )}
          </Label>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {viewMode === "board" ? (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-6 min-w-max">
              <StatusColumn 
                status="active" 
                moves={filteredMoves} 
                clients={clients}
                onUpdate={() => refetchMoves()}
                onSelectMove={handleSelectMove}
              />
              <StatusColumn 
                status="queued" 
                moves={filteredMoves} 
                clients={clients}
                onUpdate={() => refetchMoves()}
                onSelectMove={handleSelectMove}
              />
              {showBacklog && (
                <StatusColumn 
                  status="backlog" 
                  moves={filteredMoves} 
                  clients={clients}
                  onUpdate={() => refetchMoves()}
                  onSelectMove={handleSelectMove}
                />
              )}
            </div>
          </DragDropContext>
        ) : (
          <ListView 
            moves={filteredMoves} 
            clients={clients} 
            onUpdate={() => refetchMoves()}
            onSelectMove={handleSelectMove}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        )}
      </div>

      <MoveDetailSheet
        move={selectedMove}
        clients={clients}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onUpdate={() => {
          refetchMoves();
          if (selectedMove) {
            const updatedMove = moves.find(m => m.id === selectedMove.id);
            if (updatedMove) setSelectedMove(updatedMove);
          }
        }}
      />

      <TriageDialog 
        open={triageDialogOpen} 
        onOpenChange={setTriageDialogOpen} 
      />
    </div>
  );
}
