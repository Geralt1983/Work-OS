import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Target, TrendingUp, Users, AlertCircle, CheckCircle2, Brain, MessageCircle, MessageSquare, FileText, Lightbulb, Zap, Archive, Star, Minus, AlertTriangle, ThumbsUp, ThumbsDown, Loader2, BarChart3, LayoutGrid, ClipboardCheck } from "lucide-react";
import { DRAIN_TYPE_LABELS, type DrainType } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import GlassSidebar from "@/components/GlassSidebar";
import IslandLayout from "@/components/IslandLayout";
import { TriageDialog } from "@/components/TriageDialog";
import { ArcCard } from "@/components/ArcCard";

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

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function formatDate(dateStr: string): string {
  // Parse as local date to avoid timezone shift (dateStr is YYYY-MM-DD)
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function getSentimentColor(sentiment: string): string {
  switch (sentiment) {
    case "positive": return "text-green-600 dark:text-green-400";
    case "negative": return "text-red-600 dark:text-red-400";
    case "complicated": return "text-yellow-600 dark:text-yellow-400";
    default: return "text-muted-foreground";
  }
}

function getImportanceBadgeVariant(importance: string): "default" | "secondary" | "outline" {
  switch (importance) {
    case "high": return "default";
    case "medium": return "secondary";
    default: return "outline";
  }
}

export default function Metrics() {
  const [triageOpen, setTriageOpen] = useState(false);

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

  return (
    <>
      {/* === MOBILE VIEW (CSS-hidden on desktop) === */}
      <div className="h-screen flex md:hidden flex-col bg-[#030309] text-foreground" data-testid="page-metrics">
        <header className="h-14 glass-strong border-b border-purple-500/20 flex items-center justify-between px-4 shrink-0 relative z-50">
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
          <h1 className="text-lg font-semibold tracking-wider text-gradient-purple">Metrics</h1>
          <div className="flex items-center gap-1">
            <Link href="/">
              <Button variant="ghost" size="icon" className="hover:bg-purple-500/10" data-testid="mobile-link-chat">
                <MessageSquare className="h-5 w-5 text-purple-400" />
              </Button>
            </Link>
            <Link href="/moves">
              <Button variant="ghost" size="icon" className="hover:bg-cyan-500/10" data-testid="mobile-link-moves">
                <LayoutGrid className="h-5 w-5 text-cyan-400" />
              </Button>
            </Link>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setTriageOpen(true)}
              className="hover:bg-rose-500/10"
              data-testid="mobile-button-triage"
            >
              <ClipboardCheck className="h-5 w-5 text-rose-400" />
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
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500" 
                        style={{ width: `${Math.min(todayMetrics.pacingPercent, 100)}%` }} 
                      />
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{todayMetrics.movesCompleted} moves</span>
                      <span>{formatMinutes(todayMetrics.estimatedMinutes)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No data yet</p>
                )}
              </div>
            </ArcCard>

            {/* Weekly Summary - Mobile */}
            <ArcCard glowColor="cyan">
              <div className="p-4">
                <div className="text-base font-semibold flex items-center gap-2 text-white pb-3">
                  <TrendingUp className="h-4 w-4 text-cyan-400" />
                  This Week
                </div>
                {loadingWeekly ? (
                  <Skeleton className="h-12 w-full bg-white/10" />
                ) : weeklyMetrics ? (
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-white">{weeklyMetrics.totalMoves}</div>
                      <div className="text-xs text-muted-foreground">Moves</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white">{formatMinutes(weeklyMetrics.totalMinutes)}</div>
                      <div className="text-xs text-muted-foreground">Time</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white">{weeklyMetrics.averageMovesPerDay.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">Avg/Day</div>
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
                      <div key={client.clientName} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                        <span className="text-sm font-medium truncate text-white/90">{client.clientName}</span>
                        <Badge variant="outline" className="text-xs bg-white/5 border-white/10 text-white/70">
                          {client.daysSinceLastMove}d
                        </Badge>
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

      </div>

      {/* === DESKTOP VIEW (CSS-hidden on mobile) === */}
      <div className="h-screen hidden md:flex gradient-bg" data-testid="page-metrics-desktop">
        <GlassSidebar onTriageClick={() => setTriageOpen(true)} />

      <IslandLayout>
        <div className="h-full flex flex-col">
          {/* Island Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <div>
              <h2 className="text-lg font-semibold" data-testid="text-page-title">Metrics</h2>
              <p className="text-sm text-muted-foreground">Track your work pacing and client activity</p>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
          
          {/* Today's Pacing */}
          <ArcCard glowColor="purple" data-testid="card-today-pacing">
            <div className="p-6">
              <div className="flex flex-row items-center justify-between gap-2 pb-4">
                <div className="text-lg font-semibold flex items-center gap-2 text-white">
                  <Target className="h-5 w-5 text-purple-400" />
                  Today's Pacing
                </div>
                {loadingToday ? (
                  <Skeleton className="h-6 w-20 bg-white/10" />
                ) : (
                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 hover:bg-purple-500/30" data-testid="badge-pacing-percent">
                    {todayMetrics?.pacingPercent || 0}%
                  </Badge>
                )}
              </div>
              {loadingToday ? (
                <div className="space-y-4">
                  <Skeleton className="h-4 w-full bg-white/10" />
                  <Skeleton className="h-8 w-32 bg-white/10" />
                </div>
              ) : todayMetrics ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">
                        {formatMinutes(todayMetrics.estimatedMinutes)} of {formatMinutes(todayMetrics.targetMinutes)} target
                      </span>
                      <span className="font-medium text-white" data-testid="text-moves-today">
                        {todayMetrics.movesCompleted} moves
                      </span>
                    </div>
                    <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500" 
                        style={{ width: `${Math.min(todayMetrics.pacingPercent, 100)}%` }} 
                      />
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-4 text-sm text-white/80">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span data-testid="text-estimated-time">{formatMinutes(todayMetrics.estimatedMinutes)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span>{todayMetrics.backlogMoves} from backlog</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{todayMetrics.clientsTouched?.length || 0} clients touched</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No data for today yet</p>
              )}
            </div>
          </ArcCard>

          {/* Weekly Trends */}
          <ArcCard glowColor="cyan" data-testid="card-weekly-trends">
            <div className="p-6">
              <div className="text-lg font-semibold flex items-center gap-2 text-white pb-4">
                <TrendingUp className="h-5 w-5 text-cyan-400" />
                Weekly Trends
              </div>
              {loadingWeekly ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-10 w-full bg-white/10" />
                  ))}
                </div>
              ) : weeklyMetrics && Array.isArray(weeklyMetrics.days) && weeklyMetrics.days.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-4 text-sm mb-4">
                    <div>
                      <span className="text-muted-foreground">Total moves: </span>
                      <span className="font-medium text-white" data-testid="text-total-moves">{weeklyMetrics.totalMoves}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total time: </span>
                      <span className="font-medium text-white">{formatMinutes(weeklyMetrics.totalMinutes)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Avg/day: </span>
                      <span className="font-medium text-white">{weeklyMetrics.averageMovesPerDay} moves</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {weeklyMetrics.days.map((day) => (
                      <div key={day.date} className="flex items-center gap-4" data-testid={`row-day-${day.date}`}>
                        <div className="w-24 text-sm text-muted-foreground shrink-0">
                          {formatDate(day.date)}
                        </div>
                        <div className="flex-1 h-6 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-300"
                            style={{ width: `${Math.min(day.pacingPercent, 100)}%` }}
                          />
                        </div>
                        <div className="w-20 text-sm text-right shrink-0">
                          <span className="font-medium text-white">{day.movesCompleted}</span>
                          <span className="text-muted-foreground"> moves</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No weekly data yet</p>
              )}
            </div>
          </ArcCard>

          {/* Work Type Breakdown */}
          <ArcCard glowColor="pink" data-testid="card-drain-types">
            <div className="p-6">
              <div className="text-lg font-semibold flex items-center gap-2 text-white pb-4">
                <Brain className="h-5 w-5 text-pink-400" />
                Work Type Breakdown
              </div>
              {loadingDrain ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-8 w-full bg-white/10" />
                  ))}
                </div>
              ) : drainMetrics && drainMetrics.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex h-4 rounded-full overflow-hidden">
                    {drainMetrics.map((metric) => (
                      <div
                        key={metric.drainType}
                        className={`${DRAIN_COLORS[metric.drainType] || DRAIN_COLORS.unset} transition-all`}
                        style={{ width: `${metric.percentage}%` }}
                        title={`${DRAIN_TYPE_LABELS[metric.drainType as DrainType]?.label || metric.drainType}: ${metric.percentage}%`}
                      />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {drainMetrics.map((metric) => {
                      const DrainIcon = DRAIN_ICONS[metric.drainType];
                      return (
                        <div 
                          key={metric.drainType} 
                          className="flex items-center gap-2 p-2 rounded-lg border border-white/10 bg-white/5"
                          data-testid={`drain-type-${metric.drainType}`}
                        >
                          <div className={`w-3 h-3 rounded-full ${DRAIN_COLORS[metric.drainType] || DRAIN_COLORS.unset}`} />
                          {DrainIcon && <DrainIcon className="h-4 w-4 text-muted-foreground" />}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate text-white/90">
                              {DRAIN_TYPE_LABELS[metric.drainType as DrainType]?.label || metric.drainType}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {metric.count} moves ({metric.percentage}%)
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No completed moves yet</p>
              )}
            </div>
          </ArcCard>

          {/* Backlog Health */}
          <ArcCard glowColor="orange" data-testid="card-backlog-health">
            <div className="p-6">
              <div className="text-lg font-semibold flex items-center gap-2 text-white pb-4">
                <Archive className="h-5 w-5 text-orange-400" />
                Backlog Health
              </div>
              {loadingBacklog ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full bg-white/10" />
                  ))}
                </div>
              ) : backlogHealth && backlogHealth.length > 0 ? (
                <div className="space-y-3">
                  {backlogHealth.map((client) => (
                    <div 
                      key={client.clientName} 
                      className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/5"
                      data-testid={`backlog-client-${client.clientName}`}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium capitalize text-white">{client.clientName}</span>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>{client.totalCount} in backlog</span>
                          <span>avg {client.avgDays}d old</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {client.agingCount > 0 ? (
                          <Badge className="gap-1 bg-rose-500/20 text-rose-300 border-rose-500/30">
                            <AlertCircle className="h-3 w-3" />
                            {client.agingCount} aging
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Healthy
                          </Badge>
                        )}
                        {client.oldestDays >= 7 && (
                          <span className="text-sm text-orange-400">
                            oldest: {client.oldestDays}d
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No backlog data yet</p>
              )}
            </div>
          </ArcCard>

          {/* Productivity Patterns */}
          <ArcCard glowColor="none" data-testid="card-productivity">
            <div className="p-6">
              <div className="text-lg font-semibold flex items-center gap-2 text-white pb-4">
                <Clock className="h-5 w-5 text-purple-400" />
                Productivity by Time of Day
              </div>
              {loadingProductivity ? (
                <Skeleton className="h-20 w-full bg-white/10" />
              ) : productivityData && productivityData.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex gap-1 h-16 items-end">
                    {productivityData.filter(h => h.hour >= 6 && h.hour <= 22).map((hourData) => {
                      const total = hourData.completions + hourData.deferrals;
                      const height = total > 0 ? Math.max(10, total * 10) : 4;
                      const isPositive = hourData.completions > hourData.deferrals;
                      return (
                        <div
                          key={hourData.hour}
                          className="flex-1 flex flex-col items-center"
                          title={`${hourData.hour}:00 - ${hourData.completions} completions, ${hourData.deferrals} deferrals`}
                        >
                          <div
                            className={`w-full rounded-t ${isPositive ? "bg-emerald-500" : total > 0 ? "bg-rose-400" : "bg-white/10"}`}
                            style={{ height: `${height}px` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>6am</span>
                    <span>12pm</span>
                    <span>6pm</span>
                    <span>10pm</span>
                  </div>
                  <div className="flex gap-4 text-xs text-white/70">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-emerald-500" />
                      <span>More completions</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-rose-400" />
                      <span>More deferrals</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No productivity data yet. Complete some tasks to see patterns.</p>
              )}
            </div>
          </ArcCard>

          {/* Avoided Tasks */}
          {avoidedTasks && avoidedTasks.length > 0 && (
            <ArcCard glowColor="orange" data-testid="card-avoided-tasks">
              <div className="p-6">
                <div className="text-lg font-semibold flex items-center gap-2 text-white pb-4">
                  <AlertCircle className="h-5 w-5 text-orange-400" />
                  Avoided Tasks
                  <Badge className="text-xs bg-orange-500/20 text-orange-300 border-orange-500/30">
                    {avoidedTasks.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {avoidedTasks.slice(0, 5).map((task) => (
                    <div 
                      key={task.taskId} 
                      className="flex items-center justify-between p-2 rounded-lg border border-white/10 bg-white/5"
                      data-testid={`avoided-task-${task.taskId}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate text-white/90">{task.taskName}</div>
                        <div className="text-xs text-muted-foreground capitalize">{task.clientName}</div>
                      </div>
                      <Badge className="text-xs shrink-0 bg-rose-500/20 text-rose-300 border-rose-500/30">
                        {task.count}x deferred
                      </Badge>
                    </div>
                  ))}
                  {avoidedTasks.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      +{avoidedTasks.length - 5} more avoided tasks
                    </p>
                  )}
                </div>
              </div>
            </ArcCard>
          )}

          {/* Client Metrics */}
          <ArcCard glowColor="emerald" data-testid="card-client-metrics">
            <div className="p-6">
              <div className="text-lg font-semibold flex items-center gap-2 text-white pb-4">
                <Users className="h-5 w-5 text-emerald-400" />
                Client Activity
              </div>
              {loadingClients ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full bg-white/10" />
                  ))}
                </div>
              ) : clientMetrics && Array.isArray(clientMetrics) && clientMetrics.length > 0 ? (
                <div className="space-y-3">
                  {clientMetrics.map((client) => (
                    <div 
                      key={client.clientName} 
                      className="p-3 rounded-lg border border-white/10 bg-white/5 space-y-2"
                      data-testid={`row-client-${client.clientName}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium capitalize text-white">{client.clientName}</span>
                          <span className="text-sm text-muted-foreground">
                            {client.totalMoves} moves
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {client.daysSinceLastMove >= 2 ? (
                            <div className="flex items-center gap-1 text-sm text-orange-400">
                              <AlertCircle className="h-4 w-4" />
                              <span>{client.daysSinceLastMove}d stale</span>
                            </div>
                          ) : client.daysSinceLastMove === 0 ? (
                            <div className="flex items-center gap-1 text-sm text-emerald-400">
                              <CheckCircle2 className="h-4 w-4" />
                              <span>Active today</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {client.daysSinceLastMove}d ago
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Feeling:</span>
                          <Select
                            value={client.sentiment}
                            disabled={updateSentiment.isPending}
                            onValueChange={(value) => updateSentiment.mutate({ 
                              clientName: client.clientName, 
                              sentiment: value 
                            })}
                          >
                            <SelectTrigger className="h-7 w-[110px] text-xs bg-white/5 border-white/10" data-testid={`select-sentiment-${client.clientName}`}>
                              {updateSentiment.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <SelectValue />
                              )}
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a1b26] border-white/10">
                              <SelectItem value="positive">
                                <div className="flex items-center gap-1">
                                  <ThumbsUp className="h-3 w-3 text-emerald-500" />
                                  <span>Positive</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="neutral">
                                <div className="flex items-center gap-1">
                                  <Minus className="h-3 w-3" />
                                  <span>Neutral</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="negative">
                                <div className="flex items-center gap-1">
                                  <ThumbsDown className="h-3 w-3 text-rose-500" />
                                  <span>Negative</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="complicated">
                                <div className="flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                                  <span>Complicated</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Priority:</span>
                          <Select
                            value={client.importance}
                            disabled={updateImportance.isPending}
                            onValueChange={(value) => updateImportance.mutate({ 
                              clientName: client.clientName, 
                              importance: value 
                            })}
                          >
                            <SelectTrigger className="h-7 w-[90px] text-xs bg-white/5 border-white/10" data-testid={`select-importance-${client.clientName}`}>
                              {updateImportance.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <SelectValue />
                              )}
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a1b26] border-white/10">
                              <SelectItem value="high">
                                <div className="flex items-center gap-1">
                                  <Star className="h-3 w-3 text-amber-500" />
                                  <span>High</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="medium">
                                <div className="flex items-center gap-1">
                                  <span>Medium</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="low">
                                <div className="flex items-center gap-1">
                                  <span>Low</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No client data yet</p>
              )}
            </div>
          </ArcCard>

            </div>
          </ScrollArea>
        </div>
      </IslandLayout>
      </div>

      {/* === SHARED DIALOG === */}
      <TriageDialog open={triageOpen} onOpenChange={setTriageOpen} />
    </>
  );
}
