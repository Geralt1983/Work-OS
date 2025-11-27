import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Move, Client, MoveStatus, DrainType } from "@shared/schema";
import { EFFORT_LEVELS, DRAIN_TYPES, normalizeDrainType } from "@shared/schema";
import { 
  Plus, Check, Brain, Mail, FileText, Lightbulb, Zap, 
  AlertCircle, Clock, LayoutGrid, List
} from "lucide-react";
import MoveForm from "@/components/MoveForm";
import MoveDetailSheet from "@/components/MoveDetailSheet";
import MobileMovesView from "@/components/MobileMovesView";
import { TriageDialog } from "@/components/TriageDialog";
import GlassSidebar from "@/components/GlassSidebar";
import IslandLayout from "@/components/IslandLayout";
import { ArcCard } from "@/components/ArcCard";

type ViewMode = "board" | "list";
type SortField = "title" | "client" | "status" | "effort" | "drain" | "created";
type SortDirection = "asc" | "desc";

const DRAIN_ICONS: Record<DrainType, any> = {
  deep: Brain,
  comms: Mail,
  admin: FileText,
  creative: Lightbulb,
  easy: Zap,
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
  const isStale = daysOld >= 10 && move.status === "backlog";

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

  const getGlow = () => {
    if (move.status === 'active') return 'purple';
    if (move.drainType === 'deep') return 'cyan';
    if (move.drainType === 'admin') return 'orange';
    if (move.drainType === 'creative') return 'pink';
    return 'none';
  };

  return (
    <div className="py-3 px-1">
      <ArcCard 
        glowColor={getGlow()} 
        onClick={onSelect}
        className={isDragging ? "ring-2 ring-purple-500 shadow-2xl z-50 rotate-2 scale-105" : ""}
      >
        <div className="p-5 flex flex-col gap-4">
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                {client && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold bg-white/5 border border-white/10 text-muted-foreground/80">
                    {client.name}
                  </span>
                )}
                {isStale && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                    <AlertCircle className="w-3 h-3" /> {daysOld}d
                  </span>
                )}
              </div>

              <h4 className="font-semibold text-[15px] leading-snug text-white/90">
                {move.title}
              </h4>
            </div>

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full border border-white/10 bg-white/5 text-muted-foreground hover:bg-emerald-500 hover:text-white hover:border-emerald-400 transition-all duration-300"
              onClick={(e) => { e.stopPropagation(); completeMutation.mutate(); }}
            >
              <Check className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-white/5">
            <div className="flex items-center gap-3">
              {effortLevel && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <div className={`w-2 h-2 rounded-full ${(move.effortEstimate || 0) > 2 ? 'bg-orange-400 shadow-glow-yellow' : 'bg-emerald-400 shadow-glow-emerald'}`} />
                  {effortLevel.label}
                </div>
              )}
            </div>

            {DrainIcon && (
              <div className={`p-1.5 rounded-lg bg-white/5 ${move.drainType === 'deep' ? 'text-cyan-400' : 'text-muted-foreground'}`} title={move.drainType || ''}>
                <DrainIcon className="w-4 h-4" />
              </div>
            )}
          </div>
        </div>
      </ArcCard>
    </div>
  );
}

function StatusColumn({ status, moves, clients, onUpdate, onSelectMove }: any) {
  const labels: Record<string, string> = { active: "Today", queued: "Up Next", backlog: "Backlog" };
  const columnMoves = moves.filter((m: Move) => m.status === status);

  return (
    <div className="flex-1 min-w-[300px] max-w-[380px] flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="font-bold text-lg text-white/80 tracking-tight">{labels[status]}</h3>
        <span className="px-2.5 py-0.5 rounded-full bg-white/5 text-xs font-medium text-muted-foreground border border-white/10">
          {columnMoves.length}
        </span>
      </div>

      <div className="flex-1 rounded-[2rem] border border-white/5 bg-black/20 p-2 overflow-hidden">
        <Droppable droppableId={status}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`h-full overflow-y-auto pr-2 custom-scrollbar transition-colors duration-300 ${
                snapshot.isDraggingOver ? "bg-white/[0.02]" : ""
              }`}
            >
              {columnMoves.map((move: Move, index: number) => (
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
              {columnMoves.length === 0 && (
                <div className="h-32 flex items-center justify-center border-2 border-dashed border-white/5 rounded-3xl m-2">
                  <p className="text-sm text-muted-foreground/40 font-medium">Empty</p>
                </div>
              )}
            </div>
          )}
        </Droppable>
      </div>
    </div>
  );
}

export default function Moves() {
  const isMobile = useIsMobile();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [triageDialogOpen, setTriageDialogOpen] = useState(false);
  const [showBacklog, setShowBacklog] = useState(() => localStorage.getItem("moves-show-backlog") === "true");
  const [selectedMove, setSelectedMove] = useState<Move | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  useEffect(() => { localStorage.setItem("moves-show-backlog", String(showBacklog)); }, [showBacklog]);

  const { data: moves = [], refetch: refetchMoves } = useQuery<Move[]>({ queryKey: ["/api/moves"] });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const reorderMutation = useMutation({
    mutationFn: async ({ moveId, newStatus, newIndex }: any) => {
      await apiRequest("PATCH", `/api/moves/${moveId}`, { status: newStatus, sortOrder: newIndex });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/moves"] }),
  });

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    reorderMutation.mutate({
      moveId: parseInt(draggableId),
      newStatus: destination.droppableId as MoveStatus,
      newIndex: destination.index
    });
  };

  if (isMobile) {
    return (
      <MobileMovesView 
        moves={moves} clients={clients} showBacklog={showBacklog} 
        onToggleBacklog={setShowBacklog} onUpdate={refetchMoves} 
        onCreateMove={() => setCreateDialogOpen(true)} 
        onEditMove={(m) => { setSelectedMove(m); setDetailSheetOpen(true); }} 
      />
    );
  }

  return (
    <div className="h-screen flex bg-[#0f0f1a] text-foreground font-sans">
      <GlassSidebar onTriageClick={() => setTriageDialogOpen(true)} />

      <IslandLayout>
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between px-8 py-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-white">Moves</h2>
              <p className="text-muted-foreground text-sm mt-1">One move per client, every day.</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                <Switch id="show-backlog" checked={showBacklog} onCheckedChange={setShowBacklog} />
                <Label htmlFor="show-backlog" className="text-xs font-medium cursor-pointer text-muted-foreground">
                  Backlog
                </Label>
              </div>

              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-full h-10 px-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium shadow-glow-purple border-0 transition-all hover:scale-105 active:scale-95">
                    <Plus className="w-4 h-4 mr-2" /> New Move
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] bg-[#1a1a2e] border-white/10">
                  <DialogHeader>
                    <DialogTitle>Create Move</DialogTitle>
                  </DialogHeader>
                  <MoveForm clients={clients} onSuccess={() => { setCreateDialogOpen(false); refetchMoves(); }} />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="flex-1 overflow-hidden px-6 pb-6">
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="h-full flex gap-6 overflow-x-auto pb-4">
                <StatusColumn status="active" moves={moves} clients={clients} onUpdate={refetchMoves} onSelectMove={(m: Move) => { setSelectedMove(m); setDetailSheetOpen(true); }} />
                <StatusColumn status="queued" moves={moves} clients={clients} onUpdate={refetchMoves} onSelectMove={(m: Move) => { setSelectedMove(m); setDetailSheetOpen(true); }} />
                {showBacklog && (
                  <StatusColumn status="backlog" moves={moves} clients={clients} onUpdate={refetchMoves} onSelectMove={(m: Move) => { setSelectedMove(m); setDetailSheetOpen(true); }} />
                )}
              </div>
            </DragDropContext>
          </div>
        </div>
      </IslandLayout>

      <MoveDetailSheet
        move={selectedMove}
        clients={clients}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onUpdate={refetchMoves}
      />

      <TriageDialog open={triageDialogOpen} onOpenChange={setTriageDialogOpen} />
    </div>
  );
}