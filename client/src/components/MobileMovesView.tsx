import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Move, Client, MoveStatus, DrainType } from "@shared/schema";
import { EFFORT_LEVELS, DRAIN_TYPE_LABELS, normalizeDrainType } from "@shared/schema";
import { 
  ChevronUp, ChevronDown, Check, Trash2, Edit2, 
  Zap, Brain, Mail, FileText, Lightbulb, AlertCircle, Clock, Archive
} from "lucide-react";
import { format } from "date-fns";
import { ArcCard } from "@/components/ArcCard";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { playSfx } from "@/lib/sounds";

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

function getDaysOld(createdAt: Date | string | null): number {
  if (!createdAt) return 0;
  const created = new Date(createdAt);
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

interface MobileMoveCardProps {
  move: Move;
  clients: Client[];
  onSelect: () => void;
  onUpdate: () => void;
}

function MobileMoveCard({ move, clients, onSelect, onUpdate }: MobileMoveCardProps) {
  const { toast } = useToast();
  const client = clients.find(c => c.id === move.clientId);
  const effortLevel = EFFORT_LEVELS.find(e => e.value === move.effortEstimate);
  const normalizedDrainType = normalizeDrainType(move.drainType);
  const DrainIcon = normalizedDrainType ? DRAIN_ICONS[normalizedDrainType] : null;
  
  const daysOld = getDaysOld(move.createdAt);
  const isAging = daysOld >= 7 && move.status === "backlog";
  const isStale = daysOld >= 10 && move.status === "backlog";

  const x = useMotionValue(0);
  const opacityRight = useTransform(x, [50, 100], [0, 1]);
  const opacityLeft = useTransform(x, [-50, -100], [0, 1]);
  const scale = useTransform(x, [-100, 0, 100], [0.95, 1, 0.95]);
  const bgRight = useTransform(x, [0, 100], ["rgba(16, 185, 129, 0)", "rgba(16, 185, 129, 0.2)"]);
  const bgLeft = useTransform(x, [0, -100], ["rgba(249, 115, 22, 0)", "rgba(249, 115, 22, 0.2)"]);

  // Generic Undo Mutation - restores to previous status
  const undoMutation = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      await apiRequest("PATCH", `/api/moves/${move.id}`, { status });
    },
    onSuccess: () => {
      playSfx("click");
      queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
      toast({ title: "Undone", description: "Move restored to previous status." });
      onUpdate();
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/moves/${move.id}/complete`);
    },
    onSuccess: () => {
      playSfx("complete");
      queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
      
      // Toast with UNDO action
      toast({ 
        title: "Move completed", 
        description: move.title,
        action: (
          <ToastAction 
            altText="Undo" 
            onClick={() => undoMutation.mutate({ status: move.status })}
            className="border-white/20 hover:bg-white/10"
          >
            Undo
          </ToastAction>
        ),
      });
      
      onUpdate();
    },
  });

  const backlogMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/moves/${move.id}/demote`);
    },
    onSuccess: () => {
      playSfx("delete");
      queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
      
      // Toast with UNDO action
      toast({ 
        title: "Sent to Backlog", 
        description: move.title,
        action: (
          <ToastAction 
            altText="Undo" 
            onClick={() => undoMutation.mutate({ status: move.status })}
            className="border-white/20 hover:bg-white/10"
          >
            Undo
          </ToastAction>
        ),
      });
      
      onUpdate();
    },
  });

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 100;
    if (info.offset.x > threshold && move.status !== "done") {
      completeMutation.mutate();
    } else if (info.offset.x < -threshold && move.status !== "backlog") {
      backlogMutation.mutate();
    }
  };

  const getGlow = (): "purple" | "cyan" | "orange" | "pink" | "none" => {
    // Only Active tasks get glow - it indicates "focus" status
    if (move.status !== 'active') return 'none';
    
    // For Active tasks, glow color matches drain type
    if (normalizedDrainType === 'deep') return 'cyan';
    if (normalizedDrainType === 'admin') return 'orange';
    if (normalizedDrainType === 'creative') return 'pink';
    return 'purple'; // Default purple for Active tasks without drain type
  };

  return (
    <div className="relative group touch-pan-y" data-testid={`mobile-card-move-${move.id}`}>
      <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
        <motion.div 
          style={{ opacity: opacityRight, background: bgRight }} 
          className="absolute inset-0 flex items-center justify-start pl-6"
        >
          <div className="flex items-center gap-2 text-emerald-400 font-bold tracking-wider uppercase text-sm">
            <Check className="w-6 h-6" strokeWidth={3} />
            Complete
          </div>
        </motion.div>
        
        <motion.div 
          style={{ opacity: opacityLeft, background: bgLeft }} 
          className="absolute inset-0 flex items-center justify-end pr-6"
        >
          <div className="flex items-center gap-2 text-orange-400 font-bold tracking-wider uppercase text-sm">
            Later
            <Archive className="w-6 h-6" strokeWidth={3} />
          </div>
        </motion.div>
      </div>

      <motion.div
        style={{ x, scale }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        onDragEnd={handleDragEnd}
        className="relative z-10"
      >
        <ArcCard 
          glowColor={getGlow()}
          onClick={onSelect}
          className={isStale ? "border-orange-500/30" : ""}
        >
          <div className="p-4 flex items-start gap-3">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                {client && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 bg-white/10 px-2 py-0.5 rounded-full border border-white/10">
                    {client.name}
                  </span>
                )}
                {isStale && (
                  <span className="flex items-center gap-1 text-[10px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                    <AlertCircle className="w-3 h-3" /> {daysOld}d
                  </span>
                )}
                {isAging && !isStale && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    <Clock className="w-3 h-3" /> {daysOld}d
                  </span>
                )}
              </div>

              <h4 className="font-semibold text-base leading-snug text-white/95" data-testid={`mobile-text-move-title-${move.id}`}>
                {move.title}
              </h4>
              
              <div className="flex items-center gap-3 pt-1">
                {effortLevel && (
                  <span className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                    <div className={`w-1.5 h-1.5 rounded-full ${move.effortEstimate && move.effortEstimate > 2 ? 'bg-orange-400' : 'bg-emerald-400'}`} />
                    {effortLevel.label}
                  </span>
                )}
                {DrainIcon && (
                  <DrainIcon className="w-3.5 h-3.5 text-slate-500" />
                )}
              </div>
            </div>
            
            {move.status !== "done" && (
              <div className="h-full flex items-center justify-center pl-2">
                <ChevronUp className="w-4 h-4 text-white/20 -rotate-90" />
              </div>
            )}
          </div>
        </ArcCard>
      </motion.div>
    </div>
  );
}

function CompactMobileBacklogCard({ move, clients, onSelect, onUpdate }: MobileMoveCardProps) {
  const { toast } = useToast();
  const client = clients.find(c => c.id === move.clientId);
  const normalizedDrainType = normalizeDrainType(move.drainType);
  const DrainIcon = normalizedDrainType ? DRAIN_ICONS[normalizedDrainType] : null;
  const daysOld = getDaysOld(move.createdAt);
  const isStale = daysOld >= 10;

  const promoteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/moves/${move.id}/promote`, { target: "queued" });
    },
    onSuccess: () => {
      playSfx("click");
      queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
      toast({ title: "Moved to Queue", description: move.title });
      onUpdate();
    },
  });

  return (
    <div 
      onClick={onSelect}
      className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 active:bg-white/[0.08] transition-all"
      data-testid={`compact-mobile-card-move-${move.id}`}
    >
      {client && (
        <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold bg-white/5 text-muted-foreground/60">
          {client.name.slice(0, 6)}
        </span>
      )}
      
      <span className="flex-1 text-sm text-white/70 truncate">
        {move.title}
      </span>
      
      {isStale && (
        <span className="shrink-0 flex items-center gap-0.5 text-[9px] font-bold text-rose-400">
          <AlertCircle className="w-2.5 h-2.5" /> {daysOld}d
        </span>
      )}
      
      {DrainIcon && (
        <DrainIcon className="shrink-0 w-3 h-3 text-muted-foreground/40" />
      )}
      
      <Button
        size="icon"
        variant="ghost"
        className="shrink-0 h-7 w-7 rounded-lg text-muted-foreground hover:bg-blue-500/20 hover:text-blue-400"
        onClick={(e) => { e.stopPropagation(); promoteMutation.mutate(); }}
        disabled={promoteMutation.isPending}
        data-testid={`button-promote-compact-${move.id}`}
      >
        <ChevronUp className="w-4 h-4" />
      </Button>
    </div>
  );
}

interface MobileDetailDrawerProps {
  move: Move | null;
  clients: Client[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
  onEdit: () => void;
}

function MobileDetailDrawer({ move, clients, open, onOpenChange, onUpdate, onEdit }: MobileDetailDrawerProps) {
  const { toast } = useToast();

  const promoteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/moves/${move?.id}/promote`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
      onUpdate();
    },
  });

  const demoteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/moves/${move?.id}/demote`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
      onUpdate();
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/moves/${move?.id}/complete`);
    },
    onSuccess: () => {
      playSfx("complete");
      queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
      toast({ title: "Move completed", description: move?.title });
      onOpenChange(false);
      onUpdate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/moves/${move?.id}`);
    },
    onSuccess: () => {
      playSfx("delete");
      queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
      toast({ title: "Move deleted" });
      onOpenChange(false);
      onUpdate();
    },
  });

  if (!move) return null;

  const client = clients.find(c => c.id === move.clientId);
  const daysOld = getDaysOld(move.createdAt);
  const isAging = daysOld >= 7 && move.status === "backlog";
  const isStale = daysOld >= 10 && move.status === "backlog";
  const canPromote = move.status !== "active" && move.status !== "done";
  const canDemote = move.status !== "backlog" && move.status !== "done";
  const effortLevel = EFFORT_LEVELS.find(e => e.value === move.effortEstimate);
  const normalizedDrainType = normalizeDrainType(move.drainType);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-[#141420] border-white/10 text-white" data-testid="mobile-drawer-move-detail">
        <DrawerHeader className="text-left">
          <DrawerTitle className="flex items-center gap-2 text-white" data-testid="mobile-drawer-title">
            {move.title}
            {isStale && (
              <Badge variant="destructive" className="text-xs gap-1">
                <AlertCircle className="h-3 w-3" /> {daysOld}d
              </Badge>
            )}
            {isAging && !isStale && (
              <Badge variant="outline" className="text-xs gap-1 text-yellow-400 border-yellow-400/50">
                <Clock className="h-3 w-3" /> {daysOld}d
              </Badge>
            )}
          </DrawerTitle>
          <DrawerDescription className="text-slate-400">
            {client ? client.name : "No client"} • {STATUS_LABELS[move.status as MoveStatus].label}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-4">
          {move.description && (
            <p className="text-sm text-slate-300 whitespace-pre-wrap">
              {move.description}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className={STATUS_LABELS[move.status as MoveStatus].color}>
              {STATUS_LABELS[move.status as MoveStatus].label}
            </Badge>
            {effortLevel && (
              <Badge variant="secondary" className="bg-white/10 text-slate-300 hover:bg-white/20">
                {effortLevel.label}
              </Badge>
            )}
            {normalizedDrainType && (
              <Badge variant="secondary" className="bg-white/10 text-slate-300 hover:bg-white/20">
                {DRAIN_TYPE_LABELS[normalizedDrainType]?.label}
              </Badge>
            )}
          </div>

          {move.createdAt && (
            <p className="text-xs text-slate-500">
              Created: {format(new Date(move.createdAt), "MMM d, yyyy")}
            </p>
          )}

          <Separator className="bg-white/10" />

          <div className="grid grid-cols-2 gap-2">
            {canPromote && (
              <Button
                variant="outline"
                className="h-12 bg-transparent border-white/10 hover:bg-white/5 text-white"
                onClick={() => promoteMutation.mutate()}
                disabled={promoteMutation.isPending}
                data-testid="mobile-button-promote"
              >
                <ChevronUp className="h-4 w-4 mr-2" />
                Promote
              </Button>
            )}
            {canDemote && (
              <Button
                variant="outline"
                className="h-12 bg-transparent border-white/10 hover:bg-white/5 text-white"
                onClick={() => demoteMutation.mutate()}
                disabled={demoteMutation.isPending}
                data-testid="mobile-button-demote"
              >
                <ChevronDown className="h-4 w-4 mr-2" />
                Demote
              </Button>
            )}
            {move.status !== "done" && (
              <Button
                variant="outline"
                className="h-12 text-green-400 border-green-500/30 hover:bg-green-500/10"
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                data-testid="mobile-button-complete-drawer"
              >
                <Check className="h-4 w-4 mr-2" />
                Complete
              </Button>
            )}
            <Button
              variant="outline"
              className="h-12 bg-transparent border-white/10 hover:bg-white/5 text-white"
              onClick={onEdit}
              data-testid="mobile-button-edit"
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>

        <DrawerFooter className="pt-0">
          <Button
            variant="ghost"
            className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            data-testid="mobile-button-delete"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Move
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

interface MobileMovesViewProps {
  moves: Move[];
  clients: Client[];
  showBacklog: boolean;
  onToggleBacklog: (show: boolean) => void;
  onUpdate: () => void;
  onCreateMove: () => void;
  onEditMove: (move: Move) => void;
}

export default function MobileMovesView({ 
  moves, 
  clients, 
  showBacklog,
  onToggleBacklog,
  onUpdate,
  onCreateMove,
  onEditMove
}: MobileMovesViewProps) {
  const [activeTab, setActiveTab] = useState<string>("active");
  const [selectedMove, setSelectedMove] = useState<Move | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [clientFilter, setClientFilter] = useState<string>("all");

  const filteredMoves = moves.filter(m => {
    if (clientFilter !== "all" && m.clientId?.toString() !== clientFilter) return false;
    return true;
  });

  const activeMoves = filteredMoves.filter(m => m.status === "active");
  const queuedMoves = filteredMoves.filter(m => m.status === "queued");
  const backlogMoves = filteredMoves.filter(m => m.status === "backlog");
  const historyMoves = filteredMoves
    .filter(m => m.status === "done")
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());

  const handleSelectMove = (move: Move) => {
    playSfx("click");
    setSelectedMove(move);
    setDrawerOpen(true);
  };

  const handleEdit = () => {
    setDrawerOpen(false);
    if (selectedMove) {
      onEditMove(selectedMove);
    }
  };

  const renderMoveList = (moves: Move[]) => (
    <ScrollArea className="h-[calc(100vh-220px)]">
      <div className="p-4 pb-20">
        {moves.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground/50">
            No moves in this status
          </div>
        ) : (
          moves.map(move => (
            <div key={move.id} className="mb-3">
              <MobileMoveCard
                move={move}
                clients={clients}
                onSelect={() => handleSelectMove(move)}
                onUpdate={onUpdate}
              />
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );

  const renderBacklogList = (moves: Move[]) => (
    <ScrollArea className="h-[calc(100vh-220px)]">
      <div className="p-4 pb-20">
        {moves.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground/50">
            No moves in backlog
          </div>
        ) : (
          <div className="space-y-1.5">
            {moves.map(move => (
              <CompactMobileBacklogCard
                key={move.id}
                move={move}
                clients={clients}
                onSelect={() => handleSelectMove(move)}
                onUpdate={onUpdate}
              />
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );

  const renderHistoryList = (moves: Move[], clients: Client[]) => {
    const grouped: Record<string, Move[]> = {};
    moves.forEach(m => {
      const date = new Date(m.completedAt!).toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(m);
    });

    return (
      <ScrollArea className="h-[calc(100vh-220px)]">
        <div className="p-4 pb-20">
          {moves.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground/50">
              <Check className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>No completed moves yet</p>
            </div>
          ) : (
            Object.entries(grouped).map(([date, dayMoves]) => (
              <div key={date} className="mb-6">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 px-1">
                  {date} ({dayMoves.length})
                </h4>
                <div className="space-y-2">
                  {dayMoves.map(move => {
                    const client = clients.find(c => c.id === move.clientId);
                    const effortLevel = EFFORT_LEVELS.find(e => e.value === move.effortEstimate);
                    return (
                      <div 
                        key={move.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5"
                        data-testid={`mobile-history-move-${move.id}`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                            <Check className="h-3 w-3" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium text-slate-400 line-through decoration-slate-600 block truncate">
                              {move.title}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              {client && (
                                <span className="text-[10px] text-muted-foreground">{client.name}</span>
                              )}
                              {effortLevel && (
                                <span className="text-[10px] text-muted-foreground/60">
                                  {effortLevel.label}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs text-slate-600 shrink-0 ml-2">
                          {new Date(move.completedAt!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    );
  };

  return (
    <div className="flex flex-col h-full bg-transparent" data-testid="mobile-moves-view">
      <div className="px-4 py-3 flex items-center gap-2">
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="flex-1 bg-white/5 border-white/10 text-white focus:ring-purple-500/50" data-testid="mobile-select-client-filter">
            <SelectValue placeholder="All Clients" />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1b26] border-white/10 text-white">
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map(client => (
              <SelectItem key={client.id} value={client.id.toString()}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button 
          size="icon"
          variant="ghost"
          onClick={() => onToggleBacklog(!showBacklog)}
          className={`shrink-0 ${showBacklog ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-muted-foreground'}`}
          data-testid="mobile-button-toggle-backlog"
        >
          <Archive className="h-4 w-4" />
        </Button>
        <Button 
          size="sm" 
          onClick={onCreateMove}
          className="bg-gradient-to-r from-purple-600 to-pink-600 border-0 shadow-glow-purple"
          data-testid="mobile-button-create-move"
        >
          New
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="px-4">
          <TabsList className={`grid w-full ${showBacklog ? 'grid-cols-4' : 'grid-cols-3'} bg-black/40 border border-white/5 rounded-xl h-11 p-1`} data-testid="mobile-tabs">
            <TabsTrigger 
              value="active" 
              className="rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white text-muted-foreground text-xs"
              data-testid="mobile-tab-active"
            >
              Active
              <Badge variant="secondary" className="ml-1 bg-white/10 text-white/90 hover:bg-white/10 text-[10px] px-1 h-4">
                {activeMoves.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="queued" 
              className="rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white text-muted-foreground text-xs"
              data-testid="mobile-tab-queued"
            >
              Queued
              <Badge variant="secondary" className="ml-1 bg-white/10 text-white/90 hover:bg-white/10 text-[10px] px-1 h-4">
                {queuedMoves.length}
              </Badge>
            </TabsTrigger>
            {showBacklog && (
              <TabsTrigger 
                value="backlog" 
                className="rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white text-muted-foreground text-xs"
                data-testid="mobile-tab-backlog"
              >
                Backlog
              </TabsTrigger>
            )}
            <TabsTrigger 
              value="history" 
              className="rounded-lg data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 text-muted-foreground text-xs"
              data-testid="mobile-tab-history"
            >
              <Check className="h-3 w-3 mr-1" />
              Done
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="active" className="flex-1 mt-2">
          {renderMoveList(activeMoves)}
        </TabsContent>
        <TabsContent value="queued" className="flex-1 mt-2">
          {renderMoveList(queuedMoves)}
        </TabsContent>
        {showBacklog && (
          <TabsContent value="backlog" className="flex-1 mt-2">
            {renderBacklogList(backlogMoves)}
          </TabsContent>
        )}
        <TabsContent value="history" className="flex-1 mt-2">
          {renderHistoryList(historyMoves, clients)}
        </TabsContent>
      </Tabs>

      <MobileDetailDrawer
        move={selectedMove}
        clients={clients}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onUpdate={onUpdate}
        onEdit={handleEdit}
      />
    </div>
  );
}
