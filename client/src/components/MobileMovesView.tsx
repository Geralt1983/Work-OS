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
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Move, Client, MoveStatus, DrainType } from "@shared/schema";
import { EFFORT_LEVELS, DRAIN_TYPES, DRAIN_TYPE_LABELS, normalizeDrainType } from "@shared/schema";
import { 
  ChevronUp, ChevronDown, Check, Trash2, Edit2, 
  Zap, Brain, Mail, FileText, Lightbulb, AlertCircle, Clock, Archive
} from "lucide-react";
import { format } from "date-fns";
import { ArcCard } from "@/components/ArcCard";
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

  const completeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/moves/${move.id}/complete`);
    },
    onSuccess: () => {
      playSfx("complete");
      queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
      toast({ title: "Move completed", description: move.title });
      onUpdate();
    },
  });

  const getGlow = (): "purple" | "cyan" | "orange" | "pink" | "none" => {
    if (move.status === 'active') return 'purple';
    if (normalizedDrainType === 'deep') return 'cyan';
    if (normalizedDrainType === 'admin') return 'orange';
    if (normalizedDrainType === 'creative') return 'pink';
    return 'none';
  };

  return (
    <ArcCard 
      glowColor={getGlow()}
      onClick={onSelect}
      className={isStale ? "border-orange-500/30" : ""}
      data-testid={`mobile-card-move-${move.id}`}
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

          <h4 className="font-semibold text-base leading-snug text-white/90" data-testid={`mobile-text-move-title-${move.id}`}>
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
          <Button
            size="icon"
            variant="ghost"
            className="h-10 w-10 shrink-0 rounded-full bg-white/5 text-slate-400 hover:bg-emerald-500 hover:text-white"
            onClick={(e) => { 
              e.stopPropagation(); 
              completeMutation.mutate(); 
            }}
            disabled={completeMutation.isPending}
            data-testid={`mobile-button-complete-${move.id}`}
          >
            <Check className="h-5 w-5" />
          </Button>
        )}
      </div>
    </ArcCard>
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
              <span className="flex items-center gap-1 text-[10px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                <AlertCircle className="h-3 w-3" />
                {daysOld}d
              </span>
            )}
            {isAging && !isStale && (
              <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                <Clock className="h-3 w-3" />
                {daysOld}d
              </span>
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
            <Badge variant="secondary" className="bg-white/5 border border-white/10 text-white/80">
              {STATUS_LABELS[move.status as MoveStatus].label}
            </Badge>
            {effortLevel && (
              <Badge variant="secondary" className="bg-white/5 border border-white/10 text-white/80">
                {effortLevel.label}
              </Badge>
            )}
            {normalizedDrainType && (
              <Badge variant="secondary" className="bg-white/5 border border-white/10 text-white/80">
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
                className="h-12 bg-white/5 border-white/10 text-white hover:bg-white/10"
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
                className="h-12 bg-white/5 border-white/10 text-white hover:bg-white/10"
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
                className="h-12 bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
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
              className="h-12 bg-white/5 border-white/10 text-white hover:bg-white/10"
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
            variant="destructive"
            className="bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:bg-rose-500/30"
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

  const getTabCount = (status: string) => {
    switch (status) {
      case "active": return activeMoves.length;
      case "queued": return queuedMoves.length;
      case "backlog": return backlogMoves.length;
      default: return 0;
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
          title={showBacklog ? "Hide backlog" : "Show backlog"}
        >
          <Archive className="h-4 w-4" />
        </Button>
        <Button 
          size="sm" 
          onClick={onCreateMove}
          className="bg-gradient-to-r from-purple-600 to-pink-600 border-0 shadow-glow-purple text-white"
          data-testid="mobile-button-create-move"
        >
          New
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="px-4">
          <TabsList className={`grid w-full ${showBacklog ? 'grid-cols-3' : 'grid-cols-2'} bg-black/40 border border-white/5 rounded-xl h-11 p-1`} data-testid="mobile-tabs">
            <TabsTrigger 
              value="active" 
              className="rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white text-muted-foreground"
              data-testid="mobile-tab-active"
            >
              Active
              <Badge variant="secondary" className="ml-1.5 bg-white/10 text-white/90 hover:bg-white/10 text-[10px] px-1.5 h-4">
                {getTabCount("active")}
              </Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="queued" 
              className="rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white text-muted-foreground"
              data-testid="mobile-tab-queued"
            >
              Queued
              <Badge variant="secondary" className="ml-1.5 bg-white/10 text-white/90 hover:bg-white/10 text-[10px] px-1.5 h-4">
                {getTabCount("queued")}
              </Badge>
            </TabsTrigger>
            {showBacklog && (
              <TabsTrigger 
                value="backlog" 
                className="rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white text-muted-foreground"
                data-testid="mobile-tab-backlog"
              >
                Backlog
              </TabsTrigger>
            )}
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
            {renderMoveList(backlogMoves)}
          </TabsContent>
        )}
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
