import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Brain, MessageCircle, FileText, Lightbulb, Zap, 
  ThumbsUp, ThumbsDown, Minus, AlertTriangle, Star,
  MessageSquare, List, BarChart3
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import GlassSidebar from "@/components/GlassSidebar";
import IslandLayout, { IslandHeader, IslandContent } from "@/components/IslandLayout";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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
  deep: "#06b6d4",
  comms: "#10b981",
  admin: "#ef4444",
  creative: "#8b5cf6",
  easy: "#f59e0b",
  unset: "#6b7280",
};

const DRAIN_BG_COLORS: Record<string, string> = {
  deep: "bg-cyan-500",
  comms: "bg-emerald-500",
  admin: "bg-red-500",
  creative: "bg-purple-500",
  easy: "bg-amber-500",
  unset: "bg-gray-500",
};

function formatMinutesToHours(minutes: number): string {
  return (minutes / 60).toFixed(1);
}

export default function Metrics() {
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

  const weeklyTargetMinutes = 900;
  const weeklyHours = weeklyMetrics ? formatMinutesToHours(weeklyMetrics.totalMinutes) : "0.0";
  const weeklyPacing = weeklyMetrics ? Math.min(Math.round((weeklyMetrics.totalMinutes / weeklyTargetMinutes) * 100), 100) : 0;

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weeklyChartData = weeklyMetrics?.days.map((day, index) => ({
    day: dayNames[index],
    hours: Number(formatMinutesToHours(day.estimatedMinutes)),
  })) || [];

  const productivityChartData = productivityData?.filter(h => h.hour >= 6 && h.hour <= 22).map(h => {
    const hour = h.hour;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return {
      time: `${displayHour}${ampm}`,
      productivity: h.completions + h.deferrals,
    };
  }) || [];

  const MetricsContent = (
    <div className="space-y-6 w-full overflow-x-hidden">
      
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card-section" data-testid="section-todays-pacing">
          <div className="flex items-start justify-between mb-6">
            <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <span className="text-2xl">🎯</span>
              Today's Pacing
            </h3>
            {todayMetrics && (
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">{todayMetrics.pacingPercent}%</div>
                <p className="text-xs text-muted-foreground">of target</p>
              </div>
            )}
          </div>

          {loadingToday ? (
            <Skeleton className="h-24 w-full" />
          ) : todayMetrics ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  {formatMinutesToHours(todayMetrics.estimatedMinutes)}h of 3.0h target
                </p>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(todayMetrics.pacingPercent, 100)}%` }}
                  />
                </div>
              </div>

              <div className="card-divider" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">From backlog</p>
                  <p className="text-sm font-medium text-foreground">{todayMetrics.backlogMoves}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Clients touched</p>
                  <p className="text-sm font-medium text-foreground">{todayMetrics.clientsTouched.length}</p>
                </div>
              </div>

              <div className="pt-2">
                <p className="text-xs text-muted-foreground">{todayMetrics.movesCompleted} moves</p>
              </div>
            </div>
          ) : <p className="text-muted-foreground">No data</p>}
        </section>

        <section className="card-section" data-testid="section-weekly-trends">
          <div className="flex items-start justify-between mb-6">
            <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <span className="text-2xl">📈</span>
              Weekly Trends
            </h3>
            {weeklyMetrics && (
              <div className="text-right">
                <div className="text-lg font-semibold text-primary">{weeklyMetrics.momentum.percentChange}</div>
                <p className="text-xs text-muted-foreground">Momentum Score</p>
              </div>
            )}
          </div>

          {loadingWeekly ? (
            <Skeleton className="h-56 w-full" />
          ) : weeklyMetrics ? (
            <>
              <div style={{ width: "100%", height: "180px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#404040" vertical={false} />
                    <XAxis dataKey="day" stroke="#808080" style={{ fontSize: "12px" }} />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1a1a1a",
                        border: "1px solid #404040",
                        borderRadius: "0.75rem",
                        color: "#ffffff",
                      }}
                      cursor={{ fill: "#2a2a2a" }}
                    />
                    <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card-divider my-4" />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">{weeklyMetrics.totalMoves} Moves</p>
                  <p className="text-muted-foreground">This week</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{weeklyMetrics.averageMovesPerDay} Avg/day</p>
                  {weeklyPacing >= 100 ? (
                    <p className="text-emerald-400">Weekly target hit!</p>
                  ) : (
                    <p className="text-muted-foreground">{100 - weeklyPacing}% to go</p>
                  )}
                </div>
              </div>
            </>
          ) : <p className="text-muted-foreground">No data</p>}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card-section" data-testid="section-work-type">
          <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 mb-6">
            <span className="text-2xl">🧠</span>
            Work Type Breakdown
          </h3>

          {loadingDrain ? (
            <Skeleton className="h-32 w-full" />
          ) : drainMetrics && drainMetrics.length > 0 ? (
            <>
              <div className="mb-8">
                <div className="flex h-4 rounded-full overflow-hidden gap-0.5 bg-black/20 p-0.5">
                  {drainMetrics.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-full shadow-lg transition-all hover:opacity-80"
                      style={{
                        backgroundColor: DRAIN_COLORS[item.drainType] || DRAIN_COLORS.unset,
                        width: `${item.percentage}%`,
                        boxShadow: `0 4px 12px ${DRAIN_COLORS[item.drainType] || DRAIN_COLORS.unset}40`,
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="card-divider mb-6" />

              <div className="grid grid-cols-2 gap-4">
                {drainMetrics.map((item) => {
                  const DrainIcon = DRAIN_ICONS[item.drainType];
                  return (
                    <div
                      key={item.drainType}
                      className="p-4 rounded-xl bg-muted/50 border border-border/50 hover:border-primary/40 hover:bg-muted transition-all"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className="w-3 h-3 rounded-full shadow-md flex-shrink-0"
                          style={{
                            backgroundColor: DRAIN_COLORS[item.drainType] || DRAIN_COLORS.unset,
                            boxShadow: `0 0 8px ${DRAIN_COLORS[item.drainType] || DRAIN_COLORS.unset}60`,
                          }}
                        />
                        <p className="font-semibold text-foreground text-sm capitalize">{item.drainType}</p>
                      </div>
                      <p className="text-xs text-muted-foreground ml-6">{item.count} moves</p>
                    </div>
                  );
                })}
              </div>
            </>
          ) : <p className="text-muted-foreground text-sm">No completed moves yet</p>}
        </section>

        <section className="card-section" data-testid="section-productivity">
          <h3 className="text-xl font-semibold text-foreground flex items-center gap-2 mb-6">
            <span className="text-2xl">🕐</span>
            Productivity Rhythm
          </h3>

          {loadingProductivity ? (
            <Skeleton className="h-56 w-full" />
          ) : productivityData && productivityData.length > 0 ? (
            <>
              <div style={{ width: "100%", height: "180px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productivityChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="#2a2a2a" vertical={false} />
                    <XAxis dataKey="time" stroke="#666666" style={{ fontSize: "11px" }} tick={{ fill: "#888888" }} />
                    <YAxis hide />
                    <Bar dataKey="productivity" fill="#10b981" radius={[6, 6, 0, 0]} isAnimationActive={true} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card-divider my-6" />

              <div className="flex justify-between text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Peak Hours</p>
                  <p className="text-foreground font-semibold">9AM - 11AM</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-xs">Average</p>
                  <p className="text-foreground font-semibold">
                    {productivityChartData.length > 0 
                      ? Math.round(productivityChartData.reduce((a, b) => a + b.productivity, 0) / productivityChartData.length)
                      : 0} moves/hr
                  </p>
                </div>
              </div>
            </>
          ) : <p className="text-muted-foreground text-sm">No productivity data yet.</p>}
        </section>
      </div>

      <section className="space-y-4" data-testid="section-backlog-health">
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <span className="text-2xl">🗂️</span>
          Backlog Health
        </h2>

        {loadingBacklog ? (
          <Skeleton className="h-32 w-full" />
        ) : backlogHealth && backlogHealth.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {backlogHealth.map((client) => {
              const status = client.isEmpty ? "empty" : client.agingCount > 0 ? "aging" : "healthy";
              const statusConfig = {
                empty: { label: "Empty", className: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
                healthy: { label: "Healthy", className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
                aging: { label: `${client.agingCount} aging`, className: "bg-red-500/20 text-red-300 border-red-500/30" },
              };
              const config = statusConfig[status];

              return (
                <div key={client.clientName} className="card-section group" data-testid={`card-backlog-${client.clientName}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-foreground capitalize">{client.clientName}</h3>
                      {!client.isEmpty && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {client.totalCount} tasks {client.avgDays > 0 && `• avg ${client.avgDays}d old`}
                        </p>
                      )}
                      {client.isEmpty && <p className="text-xs text-muted-foreground mt-1">No backlog tasks</p>}
                    </div>
                    <Badge className={`${config.className} border rounded-full px-3 py-1 text-xs font-medium`}>
                      {config.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <p className="text-muted-foreground text-sm">No backlog data yet</p>}
      </section>

      <section className="space-y-4" data-testid="section-client-activity">
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <span className="text-2xl">👥</span>
          Client Activity
        </h2>

        {loadingClients ? (
          <Skeleton className="h-48 w-full" />
        ) : clientMetrics && clientMetrics.length > 0 ? (
          <div className="space-y-3">
            {clientMetrics.map((client) => {
              const sentimentConfig = {
                positive: { icon: "👍", className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
                neutral: { icon: "−", className: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
                negative: { icon: "👎", className: "bg-red-500/20 text-red-300 border-red-500/30" },
                complicated: { icon: "⚠️", className: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
              };
              const priorityConfig = {
                low: { label: "Low", className: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
                medium: { label: "Medium", className: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
                high: { label: "High", className: "bg-red-500/20 text-red-300 border-red-500/30" },
              };

              const sentimentInfo = sentimentConfig[client.sentiment as keyof typeof sentimentConfig] || sentimentConfig.neutral;
              const priorityInfo = priorityConfig[client.importance as keyof typeof priorityConfig] || priorityConfig.medium;

              const statusLabel = client.daysSinceLastMove === 0 
                ? "Active" 
                : client.daysSinceLastMove >= 2 
                  ? `${client.daysSinceLastMove}d stale` 
                  : `${client.daysSinceLastMove}d ago`;

              const statusClass = client.daysSinceLastMove === 0
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                : client.daysSinceLastMove >= 2
                  ? "bg-red-500/20 text-red-300 border-red-500/30"
                  : "bg-amber-500/20 text-amber-300 border-amber-500/30";

              return (
                <div key={client.clientName} className="card-section group" data-testid={`card-client-${client.clientName}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground capitalize">{client.clientName}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {client.totalMoves} moves
                      </p>
                    </div>
                    <Badge className={`${statusClass} border rounded-full px-3 py-1 text-xs font-medium ml-2`}>
                      {statusLabel}
                    </Badge>
                  </div>

                  <div className="card-divider mb-4" />

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-2">Sentiment</p>
                      <Select value={client.sentiment} onValueChange={(val) => updateSentiment.mutate({ clientName: client.clientName, sentiment: val })}>
                        <SelectTrigger className="h-8 text-xs bg-muted/50 border-border/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="positive"><div className="flex gap-1 items-center">👍 Positive</div></SelectItem>
                          <SelectItem value="neutral"><div className="flex gap-1 items-center">− Neutral</div></SelectItem>
                          <SelectItem value="negative"><div className="flex gap-1 items-center">👎 Negative</div></SelectItem>
                          <SelectItem value="complicated"><div className="flex gap-1 items-center">⚠️ Complicated</div></SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-2">Priority</p>
                      <Select value={client.importance} onValueChange={(val) => updateImportance.mutate({ clientName: client.clientName, importance: val })}>
                        <SelectTrigger className="h-8 text-xs bg-muted/50 border-border/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high"><div className="flex gap-1 items-center"><Star className="w-3 h-3 text-yellow-400" /> High</div></SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <p className="text-muted-foreground text-sm">No client data yet</p>}
      </section>
    </div>
  );

  return (
    <>
      <div className="h-screen flex md:hidden flex-col bg-[#030309] text-foreground font-sans overflow-hidden">
        <header className="h-14 glass-strong border-b border-border flex items-center justify-between px-4 shrink-0 relative z-50 sticky top-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Metrics</h1>
          <div className="flex items-center gap-1">
            <Link href="/">
              <Button variant="ghost" size="icon" className="text-muted-foreground">
                <MessageSquare className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/moves">
              <Button variant="ghost" size="icon" className="text-muted-foreground">
                <List className="h-5 w-5" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" className="text-primary">
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

      <div className="h-screen hidden md:flex flex-col bg-background text-foreground font-sans overflow-hidden">
        <div className="flex flex-1 overflow-hidden">
          <GlassSidebar />
          <IslandLayout>
            <div className="flex flex-col h-full">
              <IslandHeader title="Metrics" />
              <IslandContent noPadding>
                <ScrollArea className="flex-1 h-full">
                  <div className="p-6 pb-24 max-w-5xl mx-auto">
                    {MetricsContent}
                  </div>
                </ScrollArea>
              </IslandContent>
            </div>
          </IslandLayout>
        </div>
      </div>
    </>
  );
}
