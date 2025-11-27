import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Target, TrendingUp, Users, AlertCircle, CheckCircle2, Brain, MessageCircle, MessageSquare, FileText, Lightbulb, Zap, Archive, Star, Minus, AlertTriangle, ThumbsUp, ThumbsDown, Loader2, BarChart3, LayoutGrid, ClipboardCheck, List } from "lucide-react";
import { DRAIN_TYPE_LABELS, type DrainType } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import GlassSidebar from "@/components/GlassSidebar";
import IslandLayout from "@/components/IslandLayout";
import { TriageDialog } from "@/components/TriageDialog";
import { ArcCard } from "@/components/ArcCard";
import { useIsMobile } from "@/hooks/use-mobile";

interface TodayMetrics {
  date: string;
  movesCompleted: number;
  estimatedMinutes: number;
  targetMinutes: number;
  pacingPercent: number;
  clientsTouched: string[];
  backlogMoves: number;
  nonBacklogMoves: number;
}

interface WeeklyMetrics {
  days: Array<{
    date: string;
    movesCompleted: number;
    estimatedMinutes: number;
    pacingPercent: number;
  }>;
  averageMovesPerDay: number;
  totalMoves: number;
  totalMinutes: number;
}

interface ClientMetric {
  clientName: string;
  totalMoves: number;
  lastMoveAt: string | null;
  daysSinceLastMove: number;
  sentiment: string;
  importance: string;
  tier: string;
}

interface DrainTypeMetric {
  drainType: string;
  count: number;
  minutes: number;
  percentage: number;
}

interface BacklogHealthMetric {
  clientName: string;
  oldestDays: number;
  agingCount: number;
  totalCount: number;
  avgDays: number;
}

interface AvoidedTask {
  taskId: string;
  taskName: string;
  clientName: string;
  count: number;
}

interface ProductivityHour {
  hour: number;
  completions: number;
  deferrals: number;
}

const DRAIN_ICONS: Record<string, typeof Brain> = {
  deep: Brain,
  comms: MessageCircle,
  admin: FileText,
  creative: Lightbulb,
  easy: Zap,
};

const DRAIN_COLORS: Record<string, string> = {
  deep: "bg-blue-500",
  comms: "bg-green-500",
  admin: "bg-orange-500",
  creative: "bg-purple-500",
  easy: "bg-yellow-500",
  unset: "bg-gray-400",
};

function formatMinutesToHours(minutes: number): string {
  const hours = (minutes / 60).toFixed(1);
  return `${hours}h`;
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function Metrics() {
  const [triageOpen, setTriageOpen] = useState(false);
  const isMobile = useIsMobile();

  const { data: todayMetrics, isLoading: loadingToday } = useQuery<TodayMetrics>({
    queryKey: ["/api/metrics/today"],
  });

  const { data: weeklyMetrics, isLoading: loadingWeekly } = useQuery<WeeklyMetrics>({
    queryKey: ["/api/metrics/weekly"],
  });

  const { data: clientMetrics, isLoading: loadingClients } = useQuery<ClientMetric[]>({
    queryKey: ["/api/metrics/clients"],
  });

  const { data: drainMetrics, isLoading: loadingDrain } = useQuery<DrainTypeMetric[]>({
    queryKey: ["/api/metrics/drain-types"],
  });

  const { data: backlogHealth, isLoading: loadingBacklog } = useQuery<BacklogHealthMetric[]>({
    queryKey: ["/api/metrics/backlog-health"],
  });

  const { data: avoidedTasks, isLoading: loadingAvoided } = useQuery<AvoidedTask[]>({
    queryKey: ["/api/metrics/avoided-tasks"],
  });

  const { data: productivityData, isLoading: loadingProductivity } = useQuery<ProductivityHour[]>({
    queryKey: ["/api/metrics/productivity"],
  });

  const { toast } = useToast();

  const updateSentiment = useMutation({
    mutationFn: async ({ clientName, sentiment }: { clientName: string; sentiment: string }) => {
      return apiRequest("PATCH", `/api/client-memory/${encodeURIComponent(clientName)}/sentiment`, { sentiment });
    },
    onSuccess: (_, { clientName }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/metrics/clients"] });
      toast({ title: "Updated", description: `${clientName} sentiment saved` });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to update sentiment", variant: "destructive" });
    },
  });

  const updateImportance = useMutation({
    mutationFn: async ({ clientName, importance }: { clientName: string; importance: string }) => {
      return apiRequest("PATCH", `/api/client-memory/${encodeURIComponent(clientName)}/importance`, { importance });
    },
    onSuccess: (_, { clientName }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/metrics/clients"] });
      toast({ title: "Updated", description: `${clientName} priority saved` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update importance", variant: "destructive" });
    },
  });

  // Calculate weekly pacing (Target: 15 hours = 900 minutes)
  const weeklyTargetMinutes = 900;
  const weeklyPacing = weeklyMetrics ? Math.min(Math.round((weeklyMetrics.totalMinutes / weeklyTargetMinutes) * 100), 100) : 0;
  const weeklyHours = weeklyMetrics ? (weeklyMetrics.totalMinutes / 60).toFixed(1) : "0.0";

  if (isMobile) {
    return (
      <div className="h-screen flex flex-col bg-[#030309] text-foreground font-sans overflow-hidden" data-testid="page-metrics">
        <header className="h-14 glass-strong border-b border-purple-500/20 flex items-center justify-between px-4 shrink-0 z-50">
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
          <h1 className="text-lg font-display font-semibold tracking-wider text-gradient-purple">Metrics</h1>
          <div className="flex items-center gap-1">
            <Link href="/">
              <Button variant="ghost" size="icon" className="hover:bg-purple-500/10 text-muted-foreground">
                <MessageSquare className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/moves">
              <Button variant="ghost" size="icon" className="hover:bg-purple-500/10 text-muted-foreground">
                <List className="h-5 w-5" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" className="hover:bg-cyan-500/10 text-cyan-400">
              <BarChart3 className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Today's Pacing - Mobile */}
            <ArcCard glowColor="purple" data-testid="card-today-pacing">
              <div className="p-4">
                <div className="flex flex-row items-center justify-between gap-2 pb-3">
                  <div className="text-base font-semibold flex items-center gap-2 text-white">
                    <Target className="h-4 w-4 text-purple-400" />
                    Today
                  </div>
                  {loadingToday ? (
                    <Skeleton className="h-6 w-16 bg-white/10" />
                  ) : (
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 hover:bg-purple-500/30">
                      {todayMetrics?.pacingPercent || 0}%
                    </Badge>
                  )}
                </div>
                {loadingToday ? (
                  <Skeleton className="h-4 w-full bg-white/10" />
                ) : todayMetrics ? (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm mb-2 text-white/80">
                      <span>{formatMinutesToHours(todayMetrics.estimatedMinutes)} of 3.0h target</span>
                      <span>{todayMetrics.movesCompleted} moves</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500" 
                        style={{ width: `${Math.min(todayMetrics.pacingPercent, 100)}%` }} 
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No data yet</p>
                )}
              </div>
            </ArcCard>

            {/* Weekly Trends - Mobile */}
            <ArcCard glowColor="cyan">
              <div className="p-4">
                <div className="flex items-center justify-between pb-3">
                  <div className="text-base font-semibold flex items-center gap-2 text-white">
                    <TrendingUp className="h-4 w-4 text-cyan-400" />
                    This Week
                  </div>
                  <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/30">
                    {weeklyHours}h / 15h
                  </Badge>
                </div>
                {loadingWeekly ? (
                  <Skeleton className="h-12 w-full bg-white/10" />
                ) : weeklyMetrics ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="p-2 rounded-xl bg-white/5">
                        <div className="text-xl font-bold text-white">{weeklyMetrics.totalMoves}</div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Moves</div>
                      </div>
                      <div className="p-2 rounded-xl bg-white/5">
                        <div className="text-xl font-bold text-cyan-400">{weeklyHours}h</div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Time</div>
                      </div>
                      <div className="p-2 rounded-xl bg-white/5">
                        <div className="text-xl font-bold text-white">{weeklyMetrics.averageMovesPerDay.toFixed(1)}</div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Avg/Day</div>
                      </div>
                    </div>
                    
                    <div className="text-sm text-center">
                      {weeklyPacing >= 100 ? (
                        <span className="text-emerald-400 font-medium flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-4 h-4" /> Weekly target hit!
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {Math.round(100 - weeklyPacing)}% to weekly 15h target
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No data yet</p>
                )}
              </div>
            </ArcCard>

            {/* Client Activity - Mobile */}
            <ArcCard glowColor="emerald">
              <div className="p-4">
                <div className="text-base font-semibold flex items-center gap-2 text-white pb-3">
                  <Users className="h-4 w-4 text-emerald-400" />
                  Clients
                </div>
                {loadingClients ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full bg-white/10" />
                    <Skeleton className="h-8 w-full bg-white/10" />
                  </div>
                ) : clientMetrics && clientMetrics.length > 0 ? (
                  <div className="space-y-2">
                    {clientMetrics.slice(0, 5).map((client) => (
                      <div key={client.clientName} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10">
                        <span className="text-sm font-medium truncate text-white/90">{client.clientName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{client.totalMoves} moves</span>
                          {client.daysSinceLastMove >= 2 ? (
                            <span className="text-xs text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full border border-orange-400/20">{client.daysSinceLastMove}d</span>
                          ) : (
                            <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">Active</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No client data</p>
                )}
              </div>
            </ArcCard>
          </div>
        </ScrollArea>

        <TriageDialog open={triageOpen} onOpenChange={setTriageOpen} />
      </div>
    );
  }

  // Desktop View
  return (
    <div className="h-screen flex bg-transparent text-slate-200 font-sans" data-testid="page-metrics">
      <GlassSidebar onTriageClick={() => setTriageOpen(true)} />

      <IslandLayout>
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <div>
              <h2 className="text-lg font-semibold text-white">Metrics</h2>
              <p className="text-sm text-muted-foreground">Track your work pacing and client activity</p>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
          
          {/* Today's Pacing */}
          <ArcCard glowColor="purple">
            <div className="p-6">
                <div className="flex flex-row items-center justify-between gap-2 pb-4">
                <div className="text-lg font-semibold flex items-center gap-2 text-white">
                    <Target className="h-5 w-5 text-purple-400" />
                    Today's Pacing
                </div>
                {todayMetrics && (
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 hover:bg-purple-500/30">
                    {todayMetrics.pacingPercent}%
                    </Badge>
                )}
                </div>
                
                {loadingToday ? (
                  <Skeleton className="h-4 w-full" />
                ) : todayMetrics ? (
                  <>
                    <div className="flex justify-between text-sm mb-2 text-white/80">
                        <span>{formatMinutesToHours(todayMetrics.estimatedMinutes)} of 3.0h target</span>
                        <span>{todayMetrics.movesCompleted} moves</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden mt-2 mb-4">
                        <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${Math.min(todayMetrics.pacingPercent, 100)}%` }} />
                    </div>
                  </>
                ) : <p className="text-muted-foreground">No data</p>}
            </div>
          </ArcCard>

          {/* Weekly Trends */}
          <ArcCard glowColor="cyan">
             <div className="p-6">
                <div className="flex items-center justify-between pb-4">
                    <div className="text-lg font-semibold flex items-center gap-2 text-white">
                        <TrendingUp className="h-5 w-5 text-cyan-400" />
                        Weekly Trends
                    </div>
                    <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/30">
                        {weeklyHours}h / 15h
                    </Badge>
                </div>

                {loadingWeekly ? (
                   <Skeleton className="h-20 w-full" />
                ) : weeklyMetrics ? (
                   <div className="space-y-4">
                     <div className="grid grid-cols-3 gap-4 text-center mb-4">
                       <div className="p-3 rounded-xl bg-white/5">
                         <div className="text-2xl font-bold text-white">{weeklyMetrics.totalMoves}</div>
                         <div className="text-xs text-muted-foreground uppercase tracking-wider">Moves</div>
                       </div>
                       <div className="p-3 rounded-xl bg-white/5">
                         <div className="text-2xl font-bold text-cyan-400">{weeklyHours}h</div>
                         <div className="text-xs text-muted-foreground uppercase tracking-wider">Time</div>
                       </div>
                       <div className="p-3 rounded-xl bg-white/5">
                         <div className="text-2xl font-bold text-white">{weeklyMetrics.averageMovesPerDay}</div>
                         <div className="text-xs text-muted-foreground uppercase tracking-wider">Avg/Day</div>
                       </div>
                     </div>
                     
                     <div className="text-sm text-center">
                        {weeklyPacing >= 100 ? (
                            <span className="text-emerald-400 font-medium flex items-center justify-center gap-2">
                                <CheckCircle2 className="w-4 h-4" /> Weekly target hit!
                            </span>
                        ) : (
                            <span className="text-muted-foreground">
                                {Math.round(100 - weeklyPacing)}% to weekly 15h target
                            </span>
                        )}
                     </div>
                   </div>
                ) : <p>No data</p>}
             </div>
          </ArcCard>

          {/* Client Activity */}
          <ArcCard glowColor="none">
             <div className="p-6">
                <div className="text-lg font-semibold flex items-center gap-2 text-white pb-4">
                    <Users className="h-5 w-5 text-white/70" />
                    Client Activity
                </div>
                {loadingClients ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                    </div>
                ) : clientMetrics && clientMetrics.length > 0 ? (
                    <div className="space-y-3">
                      {clientMetrics.map((client) => (
                        <div key={client.clientName} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                           <span className="font-medium text-white/90 capitalize">{client.clientName}</span>
                           <div className="flex items-center gap-3">
                              <span className="text-sm text-muted-foreground">{client.totalMoves} moves</span>
                              {client.daysSinceLastMove >= 2 ? (
                                <span className="text-xs text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full border border-orange-400/20">{client.daysSinceLastMove}d stale</span>
                              ) : (
                                <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">Active</span>
                              )}
                           </div>
                        </div>
                      ))}
                    </div>
                ) : <p className="text-muted-foreground text-sm">No data</p>}
             </div>
          </ArcCard>
          
            </div>
          </ScrollArea>
        </div>
      </IslandLayout>
      <TriageDialog open={triageOpen} onOpenChange={setTriageOpen} />
    </div>
  );
}
