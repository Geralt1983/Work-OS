import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
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
      queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
      toast({ title: "Move completed", description: move.title });
      onUpdate();
    },
  });

  return (
    <Card 
      className={`active:scale-[0.98] transition-transform touch-manipulation ${
        isStale ? "border-orange-400 dark:border-orange-600" : 
        isAging ? "border-yellow-400 dark:border-yellow-600" : ""
      }`}
      onClick={onSelect}
      data-testid={`mobile-card-move-${move.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-base leading-tight truncate" data-testid={`mobile-text-move-title-${move.id}`}>
                {move.title}
              </h4>
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
            
            <div className="flex items-center gap-2 flex-wrap">
              {client && (
                <Badge variant="outline" className="text-xs">
                  {client.name}
                </Badge>
              )}
              {effortLevel && (
                <Badge variant="secondary" className="text-xs">
                  {effortLevel.label}
                </Badge>
              )}
              {DrainIcon && (
                <DrainIcon className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
          </div>
          
          {move.status !== "done" && (
            <Button
              size="icon"
              variant="ghost"
              className="h-10 w-10 shrink-0 text-green-600"
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
      </CardContent>
    </Card>
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
      <DrawerContent data-testid="mobile-drawer-move-detail">
        <DrawerHeader className="text-left">
          <DrawerTitle className="flex items-center gap-2" data-testid="mobile-drawer-title">
            {move.title}
            {isStale && (
              <Badge variant="destructive" className="text-xs gap-1">
                <AlertCircle className="h-3 w-3" />
                {daysOld}d
              </Badge>
            )}
            {isAging && !isStale && (
              <Badge variant="outline" className="text-xs gap-1 text-yellow-600 border-yellow-400">
                <Clock className="h-3 w-3" />
                {daysOld}d
              </Badge>
            )}
          </DrawerTitle>
          <DrawerDescription>
            {client ? client.name : "No client"} • {STATUS_LABELS[move.status as MoveStatus].label}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-4">
          {move.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {move.description}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className={STATUS_LABELS[move.status as MoveStatus].color}>
              {STATUS_LABELS[move.status as MoveStatus].label}
            </Badge>
            {effortLevel && (
              <Badge variant="secondary">
                {effortLevel.label}
              </Badge>
            )}
            {normalizedDrainType && (
              <Badge variant="secondary">
                {DRAIN_TYPE_LABELS[normalizedDrainType]?.label}
              </Badge>
            )}
          </div>

          {move.createdAt && (
            <p className="text-xs text-muted-foreground">
              Created: {format(new Date(move.createdAt), "MMM d, yyyy")}
            </p>
          )}

          <Separator />

          <div className="grid grid-cols-2 gap-2">
            {canPromote && (
              <Button
                variant="outline"
                className="h-12"
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
                className="h-12"
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
                className="h-12 text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-950"
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
              className="h-12"
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
      <div className="space-y-3 p-4">
        {moves.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No moves in this status
          </div>
        ) : (
          moves.map(move => (
            <MobileMoveCard
              key={move.id}
              move={move}
              clients={clients}
              onSelect={() => handleSelectMove(move)}
              onUpdate={onUpdate}
            />
          ))
        )}
      </div>
    </ScrollArea>
  );

  return (
    <div className="flex flex-col h-full" data-testid="mobile-moves-view">
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="flex-1" data-testid="mobile-select-client-filter">
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
        <Button 
          size="icon"
          variant={showBacklog ? "secondary" : "ghost"}
          onClick={() => onToggleBacklog(!showBacklog)}
          data-testid="mobile-button-toggle-backlog"
          title={showBacklog ? "Hide backlog" : "Show backlog"}
        >
          <Archive className="h-4 w-4" />
        </Button>
        <Button 
          size="sm" 
          onClick={onCreateMove}
          data-testid="mobile-button-create-move"
        >
          New
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className={`grid w-full ${showBacklog ? 'grid-cols-3' : 'grid-cols-2'} rounded-none border-b h-12`} data-testid="mobile-tabs">
          <TabsTrigger 
            value="active" 
            className="data-[state=active]:bg-green-500/10 data-[state=active]:text-green-600 rounded-none h-full"
            data-testid="mobile-tab-active"
          >
            Active
            <Badge variant="secondary" className="ml-2 text-xs">
              {getTabCount("active")}
            </Badge>
          </TabsTrigger>
          <TabsTrigger 
            value="queued" 
            className="data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-600 rounded-none h-full"
            data-testid="mobile-tab-queued"
          >
            Queued
            <Badge variant="secondary" className="ml-2 text-xs">
              {getTabCount("queued")}
            </Badge>
          </TabsTrigger>
          {showBacklog && (
            <TabsTrigger 
              value="backlog" 
              className="data-[state=active]:bg-gray-500/10 data-[state=active]:text-gray-600 rounded-none h-full"
              data-testid="mobile-tab-backlog"
            >
              Backlog
              <Badge variant="secondary" className="ml-2 text-xs">
                {getTabCount("backlog")}
              </Badge>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="active" className="flex-1 mt-0">
          {renderMoveList(activeMoves)}
        </TabsContent>
        <TabsContent value="queued" className="flex-1 mt-0">
          {renderMoveList(queuedMoves)}
        </TabsContent>
        {showBacklog && (
          <TabsContent value="backlog" className="flex-1 mt-0">
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
