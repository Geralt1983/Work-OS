import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DropResult } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Move, Client, MoveStatus } from "@shared/schema";
import { MessageSquare, BarChart3, ClipboardCheck } from "lucide-react";
import { Link } from "wouter";
import MoveForm from "@/components/MoveForm";
import MoveDetailSheet from "@/components/MoveDetailSheet";
import MobileMovesView from "@/components/MobileMovesView";
import { DesktopMovesView } from "@/components/DesktopMovesView";
import { TriageDialog } from "@/components/TriageDialog";

type ViewMode = "board" | "list" | "history";
type SortField = "title" | "client" | "status" | "effort" | "drain" | "created";
type SortDirection = "asc" | "desc";

export default function Moves() {
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
    return (saved === "list" || saved === "board" || saved === "history") ? saved : "board";
  });
  const [sortField, setSortField] = useState<SortField>("status");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedMove, setSelectedMove] = useState<Move | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    localStorage.setItem("moves-show-backlog", String(showBacklog));
    if (!showBacklog && statusFilter === "backlog") {
      setStatusFilter("all");
    }
  }, [showBacklog, statusFilter]);

  useEffect(() => {
    localStorage.setItem("moves-view-mode", viewMode);
  }, [viewMode]);

  const { data: activeMoves = [], isLoading: activeMovesLoading } = useQuery<Move[]>({
    queryKey: ["/api/moves", { excludeCompleted: true }],
    queryFn: () => fetch("/api/moves?excludeCompleted=true").then(res => res.json()),
  });

  const { data: completedMoves = [], isLoading: completedMovesLoading } = useQuery<Move[]>({
    queryKey: ["/api/moves", { status: "done" }],
    queryFn: () => fetch("/api/moves?status=done").then(res => res.json()),
    enabled: viewMode === "history",
  });

  const moves = viewMode === "history" ? completedMoves : activeMoves;
  const movesLoading = viewMode === "history" ? completedMovesLoading : activeMovesLoading;

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
      <>
        <div className="h-screen flex md:hidden flex-col bg-[#030309]" data-testid="page-moves-loading">
          <header className="h-14 glass-strong border-b border-purple-500/20 flex items-center justify-between px-4">
            <Skeleton className="h-6 w-24 bg-white/10" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-8 bg-white/10" />
              <Skeleton className="h-8 w-8 bg-white/10" />
            </div>
          </header>
          <div className="flex-1 p-4 space-y-3">
            <Skeleton className="h-12 w-full bg-white/10" />
            <Skeleton className="h-24 w-full bg-white/10" />
            <Skeleton className="h-24 w-full bg-white/10" />
          </div>
        </div>
        <div className="h-screen hidden md:flex gradient-bg" data-testid="page-moves-loading">
          <div className="w-20 glass-strong" />
          <div className="flex-1 p-6">
            <div className="flex gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex-1 min-w-[280px]">
                  <Skeleton className="h-6 w-20 mb-4 bg-white/10" />
                  <div className="space-y-3">
                    <Skeleton className="h-24 w-full bg-white/10" />
                    <Skeleton className="h-24 w-full bg-white/10" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="h-screen flex md:hidden flex-col bg-[#030309] text-foreground" data-testid="page-moves">
        <header className="h-14 glass-strong border-b border-purple-500/20 flex items-center justify-between px-4 shrink-0 relative z-50">
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
          <h1 className="text-lg font-semibold tracking-wider text-gradient-purple">Moves</h1>
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
          </div>
        </header>
        
        <div className="flex-1 overflow-hidden relative z-0">
          <MobileMovesView
            moves={moves}
            clients={clients}
            showBacklog={showBacklog}
            onToggleBacklog={setShowBacklog}
            onUpdate={() => queryClient.invalidateQueries({ queryKey: ["/api/moves"] })}
            onCreateMove={() => setCreateDialogOpen(true)}
            onEditMove={handleEditMove}
          />
        </div>
      </div>

      <DesktopMovesView
        moves={moves}
        clients={clients}
        showBacklog={showBacklog}
        setShowBacklog={setShowBacklog}
        clientFilter={clientFilter}
        setClientFilter={setClientFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        drainFilter={drainFilter}
        setDrainFilter={setDrainFilter}
        viewMode={viewMode}
        setViewMode={setViewMode}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        backlogCount={backlogCount}
        onUpdate={() => queryClient.invalidateQueries({ queryKey: ["/api/moves"] })}
        onCreateMove={() => setCreateDialogOpen(true)}
        onSelectMove={handleSelectMove}
        onDragEnd={handleDragEnd}
        onTriageClick={() => setTriageDialogOpen(true)}
      />

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="bg-[#141420] border-white/10 text-white sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-white">Create Move</DialogTitle>
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
          queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
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
    </>
  );
}
