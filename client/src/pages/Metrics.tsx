import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Clock, Target, TrendingUp, Users, AlertCircle, CheckCircle2, 
  Brain, MessageCircle, FileText, Lightbulb, Zap, Archive, 
  ThumbsUp, ThumbsDown, Minus, AlertTriangle, Star, Loader2,
  MessageSquare, List, BarChart3, ArrowUpRight, ArrowDownRight, Activity
} from "lucide-react";
import { DRAIN_TYPE_LABELS, type DrainType } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
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
  momentum: {
    trend: "up" | "down" | "stable";
    percentChange: number;
    message: string;
  };
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
  isEmpty: boolean;
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
  deep: "bg-cyan-500",
  comms: "bg-green-500",
  admin: "bg-orange-500",
  creative: "bg-purple-500",
  easy: "bg-yellow-500",
  unset: "bg-gray-500",
};

function formatMinutesToHours(minutes: number): string {
  const hours = (minutes / 60).toFixed(1);
  return `${hours}h`;
}

export default function Metrics() {
  const [triageOpen, setTriageOpen] = useState(false);
  const { toast } = useToast();

  const { data: todayMetrics, isLoading: loadingToday } = useQuery<TodayMetrics>({ queryKey: ["/api/metrics/today"] });
  const { data: weeklyMetrics, isLoading: loadingWeekly } = useQuery<WeeklyMetrics>({ queryKey: ["/api/metrics/weekly"] });
  const { data: clientMetrics, isLoading: loadingClients } = useQuery<ClientMetric[]>({ queryKey: ["/api/metrics/clients"] });
  const { data: drainMetrics, isLoading: loadingDrain } = useQuery<DrainTypeMetric[]>({ queryKey: ["/api/metrics/drain-types"] });
  const { data: backlogHealth, isLoading: loadingBacklog } = useQuery<BacklogHealthMetric[]>({ queryKey: ["/api/metrics/backlog-health"] });
  const { data: productivityData, isLoading: loadingProductivity } = useQuery<ProductivityHour[]>({ queryKey: ["/api/metrics/productivity"] });

  const updateSentiment = useMutation({
    mutationFn: async ({ clientName, sentiment }: { clientName: string; sentiment: string }) => {
      return apiRequest("PATCH", `/api/client-memory/${encodeURIComponent(clientName)}/sentiment`, { sentiment });
    },
    onSuccess: (_, { clientName }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/metrics/clients"] });
      toast({ title: "Updated", description: `${clientName} sentiment saved` });
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
  });

  const weeklyTargetMinutes = 900; // 15 hours
  const weeklyHours = weeklyMetrics ? (weeklyMetrics.totalMinutes / 60).toFixed(1) : "0.0";
  const weeklyPacing = weeklyMetrics ? Math.min(Math.round((weeklyMetrics.totalMinutes / weeklyTargetMinutes) * 100), 100) : 0;

  const MetricsContent = (
    <div className="space-y-6 w-full overflow-x-hidden">
      
      {/* Today's Pacing */}
      <ArcCard glowColor="purple" className="w-full">
        <div className="p-5 sm:p-6">
          <div className="flex flex-row items-center justify-between gap-2 pb-4">
            <div className="text-lg font-semibold flex items-center gap-2 text-white">
              <Target className="h-5 w-5 text-purple-400" />
              Today's Pacing
            </div>
            {todayMetrics && (
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                {todayMetrics.pacingPercent}%
              </Badge>
            )}
          </div>
          
          {loadingToday ? (
            <Skeleton className="h-12 w-full bg-white/5" />
          ) : todayMetrics ? (
            <>
              <div className="flex justify-between text-sm mb-2 text-white/80">
                <span>{formatMinutesToHours(todayMetrics.estimatedMinutes)} of 3.0h target</span>
                <span>{todayMetrics.movesCompleted} moves</span>
              </div>
              <div className="h-3 bg-black/40 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500" 
                  style={{ width: `${Math.min(todayMetrics.pacingPercent, 100)}%` }} 
                />
              </div>
              <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
                <span>{todayMetrics.backlogMoves} from backlog</span>
                <span>{todayMetrics.clientsTouched.length} clients touched</span>
              </div>
            </>
          ) : <p className="text-muted-foreground">No data</p>}
        </div>
      </ArcCard>

      {/* Weekly Trends - Meter List View */}
      <ArcCard glowColor="cyan" className="w-full">
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between pb-6">
            <div className="flex flex-col gap-1">
              <div className="text-lg font-semibold flex items-center gap-2 text-white">
                <TrendingUp className="h-5 w-5 text-cyan-400" />
                Weekly Trends
              </div>
              
              {/* MOMENTUM SCORE DISPLAY */}
              {weeklyMetrics && (
                <div className="flex items-center gap-2 mt-1">
                  <div className={`text-2xl font-bold ${
                    weeklyMetrics.momentum.percentChange >= 80 ? "text-emerald-400" :
                    weeklyMetrics.momentum.percentChange >= 50 ? "text-yellow-400" : "text-rose-400"
                  }`}>
                    {weeklyMetrics.momentum.percentChange}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Momentum Score</span>
                    <span className={`text-xs font-medium ${
                      weeklyMetrics.momentum.percentChange >= 80 ? "text-emerald-400/80" :
                      weeklyMetrics.momentum.percentChange >= 50 ? "text-yellow-400/80" : "text-rose-400/80"
                    }`}>
                      {weeklyMetrics.momentum.message}
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Hours Badge */}
            <div className="text-right">
              <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 mb-1">
                {weeklyHours}h / 15h
              </Badge>
            </div>
          </div>

          {loadingWeekly ? (
            <Skeleton className="h-40 w-full bg-white/5" />
          ) : weeklyMetrics ? (
            <div className="space-y-5">
              {/* List of Days with Horizontal Meters */}
              <div className="space-y-4">
                {weeklyMetrics.days.map((day, index) => {
                  const dailyHours = (day.estimatedMinutes / 60).toFixed(1);
                  const isZero = day.estimatedMinutes === 0;
                  // Backend returns Mon-Sun order (index 0-6), use static names to avoid timezone shifts
                  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                  const dayName = dayNames[index];
                  const percent = Math.min((day.estimatedMinutes / 180) * 100, 100); // Based on 3h daily target

                  return (
                    <div key={day.date} className="flex items-center gap-3 sm:gap-4">
                      <div className="w-20 sm:w-24 shrink-0 text-sm text-muted-foreground font-medium">
                        {dayName}
                      </div>
                      
                      <div className="flex-1 h-3 bg-black/40 rounded-full overflow-hidden relative">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${isZero ? 'bg-transparent' : 'bg-cyan-500'}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <div className={`w-12 shrink-0 text-right text-sm font-bold ${isZero ? 'text-white/20' : 'text-cyan-300'}`}>
                        {dailyHours}h
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between text-sm text-muted-foreground border-t border-white/5 pt-4 mt-2">
                <div>
                  <span className="text-white font-bold">{weeklyMetrics.totalMoves}</span> <span className="text-[10px] uppercase tracking-wider">Moves</span>
                </div>
                <div>
                  <span className="text-cyan-400 font-bold">{weeklyMetrics.averageMovesPerDay}</span> <span className="text-[10px] uppercase tracking-wider">Avg/Day</span>
                </div>
              </div>
              
              <div className="text-xs text-center text-muted-foreground pt-2">
                {weeklyPacing >= 100 ? (
                  <span className="text-emerald-400 font-medium">Weekly target hit!</span>
                ) : (
                  <span>{Math.round(100 - weeklyPacing)}% to weekly 15h target</span>
                )}
              </div>
            </div>
          ) : <p className="text-muted-foreground">No data</p>}
        </div>
      </ArcCard>

      {/* Work Type Breakdown */}
      <ArcCard glowColor="orange" className="w-full">
        <div className="p-5 sm:p-6">
          <div className="text-lg font-semibold flex items-center gap-2 text-white pb-4">
            <Brain className="h-5 w-5 text-orange-400" />
            Work Type Breakdown
          </div>
          
          {loadingDrain ? (
            <Skeleton className="h-24 w-full bg-white/5" />
          ) : drainMetrics && drainMetrics.length > 0 ? (
            <div className="space-y-4">
              <div className="flex h-3 rounded-full overflow-hidden bg-black/40">
                {drainMetrics.map((metric) => (
                  <div
                    key={metric.drainType}
                    className={`${DRAIN_COLORS[metric.drainType] || DRAIN_COLORS.unset} transition-all opacity-80 hover:opacity-100`}
                    style={{ width: `${metric.percentage}%` }}
                    title={`${metric.drainType}: ${metric.percentage}%`}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {drainMetrics.map((metric) => {
                  const DrainIcon = DRAIN_ICONS[metric.drainType];
                  return (
                    <div key={metric.drainType} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/5">
                      <div className={`w-2 h-2 rounded-full ${DRAIN_COLORS[metric.drainType] || DRAIN_COLORS.unset}`} />
                      {DrainIcon && <DrainIcon className="h-3 w-3 text-muted-foreground" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate text-white/90 capitalize">
                          {metric.drainType}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {metric.count} moves
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : <p className="text-muted-foreground text-sm">No completed moves yet</p>}
        </div>
      </ArcCard>

      {/* Productivity by Time of Day */}
      <ArcCard glowColor="emerald" className="w-full">
        <div className="p-5 sm:p-6">
          <div className="text-lg font-semibold flex items-center gap-2 text-white pb-4">
            <Clock className="h-5 w-5 text-emerald-400" />
            Productivity Rhythm
          </div>

          {loadingProductivity ? (
            <Skeleton className="h-32 w-full bg-white/5" />
          ) : productivityData && productivityData.length > 0 ? (
            <div className="space-y-3">
              {(() => {
                const filteredData = productivityData.filter(h => h.hour >= 6 && h.hour <= 22);
                const maxTotal = Math.max(...filteredData.map(h => h.completions + h.deferrals));
                return (
                  <>
                    <div className="flex gap-0.5 h-32 items-end px-2">
                      {filteredData.map((hourData) => {
                        const total = hourData.completions + hourData.deferrals;
                        const heightPercent = maxTotal > 0 ? (total / maxTotal) * 100 : 5;
                        const isPositive = hourData.completions >= hourData.deferrals;
                        const barHeight = Math.max(4, Math.round((heightPercent / 100) * 128));
                        return (
                          <div
                            key={hourData.hour}
                            className="flex-1 flex flex-col items-center group relative justify-end h-full"
                            title={`${hourData.hour}:00 - ${total} tasks`}
                          >
                            <div
                              className={`w-full min-w-[2px] rounded-t-sm transition-all duration-200 ${isPositive ? "bg-emerald-500 group-hover:bg-emerald-400" : total > 0 ? "bg-rose-500 group-hover:bg-rose-400" : "bg-white/10"}`}
                              style={{ height: `${barHeight}px` }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wider px-2">
                      <span>6am</span>
                      <span>12pm</span>
                      <span>6pm</span>
                      <span>10pm</span>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : <p className="text-muted-foreground text-sm">No productivity data yet.</p>}
        </div>
      </ArcCard>

      {/* Client Activity List */}
      <ArcCard glowColor="none" className="w-full">
        <div className="p-5 sm:p-6">
          <div className="text-lg font-semibold flex items-center gap-2 text-white pb-4">
            <Users className="h-5 w-5 text-white/70" />
            Client Activity
          </div>
          
          {loadingClients ? (
            <div className="space-y-3"><Skeleton className="h-16 w-full bg-white/5" /></div>
          ) : clientMetrics && clientMetrics.length > 0 ? (
            <div className="space-y-3">
              {clientMetrics.map((client) => (
                <div key={client.clientName} className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3 hover:bg-white/[0.07] transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-white tracking-wide capitalize">{client.clientName}</span>
                      <span className="text-xs text-muted-foreground">{client.totalMoves} moves</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {client.daysSinceLastMove >= 2 ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded-full border border-rose-400/20">
                          <AlertCircle className="w-3 h-3" /> {client.daysSinceLastMove}d stale
                        </span>
                      ) : client.daysSinceLastMove === 0 ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{client.daysSinceLastMove}d ago</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                    <Select value={client.sentiment} onValueChange={(val) => updateSentiment.mutate({ clientName: client.clientName, sentiment: val })}>
                      <SelectTrigger className="h-8 text-xs bg-black/20 border-white/10 text-white"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-[#1a1b26] border-white/10 text-white">
                        <SelectItem value="positive"><div className="flex gap-1"><ThumbsUp className="w-3 h-3 text-emerald-400"/> Positive</div></SelectItem>
                        <SelectItem value="neutral"><div className="flex gap-1"><Minus className="w-3 h-3"/> Neutral</div></SelectItem>
                        <SelectItem value="negative"><div className="flex gap-1"><ThumbsDown className="w-3 h-3 text-rose-400"/> Negative</div></SelectItem>
                        <SelectItem value="complicated"><div className="flex gap-1"><AlertTriangle className="w-3 h-3 text-orange-400"/> Complicated</div></SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={client.importance} onValueChange={(val) => updateImportance.mutate({ clientName: client.clientName, importance: val })}>
                      <SelectTrigger className="h-8 text-xs bg-black/20 border-white/10 text-white"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-[#1a1b26] border-white/10 text-white">
                        <SelectItem value="high"><div className="flex gap-1"><Star className="w-3 h-3 text-yellow-400"/> High</div></SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-muted-foreground text-sm">No client data yet</p>}
        </div>
      </ArcCard>

      {/* Backlog Health */}
      <ArcCard glowColor="none" className="w-full">
        <div className="p-5 sm:p-6">
          <div className="text-lg font-semibold flex items-center gap-2 text-white pb-4">
            <Archive className="h-5 w-5 text-white/70" />
            Backlog Health
          </div>
          {loadingBacklog ? (
            <Skeleton className="h-20 w-full bg-white/5" />
          ) : backlogHealth && backlogHealth.length > 0 ? (
            <div className="space-y-2">
              {backlogHealth.map((client) => (
                <div key={client.clientName} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                  <div className="flex flex-col">
                    <span className="font-medium text-white/90 capitalize">{client.clientName}</span>
                    <span className="text-xs text-muted-foreground">
                      {client.isEmpty ? "No backlog tasks" : `${client.totalCount} tasks • avg ${client.avgDays}d old`}
                    </span>
                  </div>
                  {client.isEmpty ? (
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30">
                      Empty
                    </Badge>
                  ) : client.agingCount > 0 ? (
                    <Badge variant="destructive" className="bg-rose-500/20 text-rose-300 border-rose-500/30 hover:bg-rose-500/30">
                      {client.agingCount} aging
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30">
                      Healthy
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          ) : <p className="text-muted-foreground text-sm">No backlog data yet</p>}
        </div>
      </ArcCard>
    </div>
  );

  return (
    <>
      {/* === MOBILE VIEW (Hidden on Desktop) === */}
      <div className="h-screen flex md:hidden flex-col bg-[#030309] text-foreground font-sans overflow-hidden">
        <header className="h-14 glass-strong border-b border-purple-500/20 flex items-center justify-between px-4 shrink-0 relative z-50">
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
          <div className="p-4 pb-24 w-full">
            {MetricsContent}
          </div>
        </ScrollArea>
      </div>

      {/* === DESKTOP VIEW (Hidden on Mobile) === */}
      <div className="h-screen hidden md:flex bg-transparent text-foreground font-sans">
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
              <div className="max-w-4xl mx-auto px-6 py-6">
                {MetricsContent}
              </div>
            </ScrollArea>
          </div>
        </IslandLayout>
      </div>

      <TriageDialog open={triageOpen} onOpenChange={setTriageOpen} />
    </>
  );
}
