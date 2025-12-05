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

const DRAIN_COLORS: Record<string, string> = {
  deep: "#06b6d4",
  comms: "#10b981",
  admin: "#ef4444",
  creative: "#8b5cf6",
  easy: "#f59e0b",
  unset: "#6b7280",
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
      
      <section className="card-section" data-testid="section-todays-pacing">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="text-xl">🎯</span>
            Today's Pacing
          </h3>
          {todayMetrics && (
            <div className="text-2xl font-bold text-emerald-400">{todayMetrics.pacingPercent}%</div>
          )}
        </div>

        {loadingToday ? (
          <Skeleton className="h-20 w-full" />
        ) : todayMetrics ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-zinc-300 mb-2">
                {formatMinutesToHours(todayMetrics.estimatedMinutes)}h of 3.0h target
              </p>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(todayMetrics.pacingPercent, 100)}%` }}
                />
              </div>
            </div>

            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-zinc-400">From backlog: </span>
                <span className="text-white font-medium">{todayMetrics.backlogMoves}</span>
              </div>
              <div>
                <span className="text-zinc-400">Clients touched: </span>
                <span className="text-white font-medium">{todayMetrics.clientsTouched.length}</span>
              </div>
            </div>
          </div>
        ) : <p className="text-muted-foreground">No data</p>}
      </section>

      <section className="card-section" data-testid="section-weekly-trends">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <span className="text-xl">📈</span>
          Weekly Trends
        </h3>
        
        {weeklyMetrics && (
          <div className="flex items-center gap-4 mb-6">
            <div className="text-5xl font-bold text-cyan-400">{weeklyMetrics.momentum.percentChange}</div>
            <div>
              <div className="text-xs text-zinc-400 tracking-wider uppercase">Momentum Score</div>
              <div className="text-lg text-emerald-400 font-medium">{weeklyMetrics.momentum.message}</div>
            </div>
          </div>
        )}

        {loadingWeekly ? (
          <Skeleton className="h-48 w-full" />
        ) : weeklyMetrics && weeklyChartData.length > 0 ? (
          <>
            <div className="w-full h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="day" stroke="#888" tick={{ fill: '#ccc', fontSize: 12 }} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1a1a",
                      border: "1px solid #333",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                    formatter={(value: number) => [`${value}h`, "Hours"]}
                  />
                  <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex justify-between text-sm mt-4 pt-4 border-t border-zinc-700">
              <div>
                <span className="text-zinc-400">Moves: </span>
                <span className="text-white font-semibold">{weeklyMetrics.totalMoves}</span>
              </div>
              <div>
                <span className="text-zinc-400">Avg/day: </span>
                <span className="text-white font-semibold">{weeklyMetrics.averageMovesPerDay}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-zinc-700">
              <p className="text-xs text-zinc-400 mb-2">Momentum Score Breakdown:</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center p-2 rounded-lg bg-zinc-900">
                  <div className="text-cyan-400 font-semibold">40%</div>
                  <div className="text-zinc-500">Velocity</div>
                  <div className="text-zinc-400 text-[10px]">15h/week target</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-zinc-900">
                  <div className="text-cyan-400 font-semibold">30%</div>
                  <div className="text-zinc-500">Consistency</div>
                  <div className="text-zinc-400 text-[10px]">5 active days</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-zinc-900">
                  <div className="text-cyan-400 font-semibold">30%</div>
                  <div className="text-zinc-500">Impact</div>
                  <div className="text-zinc-400 text-[10px]">50% deep work</div>
                </div>
              </div>
            </div>
          </>
        ) : <p className="text-muted-foreground">No data</p>}
      </section>

      <section className="card-section" data-testid="section-work-type">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <span className="text-xl">🧠</span>
          Work Type Breakdown
        </h3>

        {loadingDrain ? (
          <Skeleton className="h-24 w-full" />
        ) : drainMetrics && drainMetrics.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-4 mb-4">
              {drainMetrics.map((item) => (
                <div key={item.drainType} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: DRAIN_COLORS[item.drainType] || DRAIN_COLORS.unset }}
                  />
                  <span className="text-sm text-white capitalize">{item.drainType}</span>
                </div>
              ))}
            </div>

            <div className="flex h-5 rounded-full overflow-hidden gap-0.5">
              {drainMetrics.map((item) => (
                <div
                  key={item.drainType}
                  className="transition-all hover:opacity-80"
                  style={{
                    backgroundColor: DRAIN_COLORS[item.drainType] || DRAIN_COLORS.unset,
                    width: `${item.percentage}%`,
                  }}
                  title={`${item.drainType}: ${item.count} moves (${item.percentage}%)`}
                />
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-zinc-700">
              {drainMetrics.map((item) => (
                <div key={item.drainType} className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: DRAIN_COLORS[item.drainType] || DRAIN_COLORS.unset }}
                  />
                  <span className="text-xs text-zinc-300 capitalize">{item.drainType}</span>
                  <span className="text-xs text-white font-medium ml-auto">{item.count}</span>
                </div>
              ))}
            </div>
          </>
        ) : <p className="text-muted-foreground text-sm">No completed moves yet</p>}
      </section>

      <section className="card-section" data-testid="section-productivity">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <span className="text-xl">🕐</span>
          Productivity Rhythm
        </h3>

        {loadingProductivity ? (
          <Skeleton className="h-48 w-full" />
        ) : productivityData && productivityChartData.length > 0 ? (
          <>
            <div className="w-full h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productivityChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis 
                    dataKey="time" 
                    stroke="#888" 
                    tick={{ fill: '#ccc', fontSize: 10 }} 
                    interval={2}
                  />
                  <YAxis hide />
                  <Bar dataKey="productivity" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex justify-between text-sm mt-4 pt-4 border-t border-zinc-700">
              <div>
                <span className="text-zinc-400">Mid - Total: </span>
                <span className="text-white font-semibold">
                  {productivityChartData.reduce((a, b) => a + b.productivity, 0)}
                </span>
              </div>
              <div>
                <span className="text-white font-semibold">
                  {productivityChartData.length > 0 
                    ? Math.round(productivityChartData.reduce((a, b) => a + b.productivity, 0) / productivityChartData.length)
                    : 0} moves/hr
                </span>
              </div>
            </div>
          </>
        ) : <p className="text-muted-foreground text-sm">No productivity data yet.</p>}
      </section>

      <section className="space-y-3" data-testid="section-backlog-health">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <span className="text-xl">🗂️</span>
          Backlog Health
        </h2>

        {loadingBacklog ? (
          <Skeleton className="h-32 w-full" />
        ) : backlogHealth && backlogHealth.length > 0 ? (
          <div className="space-y-2">
            {backlogHealth.map((client) => {
              const status = client.isEmpty ? "empty" : client.agingCount > 0 ? "aging" : "healthy";
              const statusConfig = {
                empty: { label: "Empty", className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
                healthy: { label: "Healthy", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
                aging: { label: "aging", className: "bg-red-500/20 text-red-400 border-red-500/30" },
              };
              const config = statusConfig[status];

              return (
                <div 
                  key={client.clientName} 
                  className="flex items-center justify-between p-3 rounded-xl bg-black border border-zinc-800"
                  data-testid={`card-backlog-${client.clientName}`}
                >
                  <div>
                    <h3 className="font-medium text-white capitalize">{client.clientName}</h3>
                    <p className="text-xs text-zinc-400">
                      {client.isEmpty 
                        ? "No backlog tasks" 
                        : `${client.totalCount} tasks • avg ${client.avgDays}d old`}
                    </p>
                  </div>
                  <Badge className={`${config.className} border rounded-full px-3 py-1 text-xs font-medium`}>
                    {config.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        ) : <p className="text-muted-foreground text-sm">No backlog data yet</p>}
      </section>

      <section className="space-y-3" data-testid="section-client-activity">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <span className="text-xl">👥</span>
          Client Activity
        </h2>

        {loadingClients ? (
          <Skeleton className="h-48 w-full" />
        ) : clientMetrics && clientMetrics.length > 0 ? (
          <div className="space-y-2">
            {clientMetrics.map((client) => {
              const statusLabel = client.daysSinceLastMove === 0 
                ? "Active" 
                : `${client.daysSinceLastMove}d ago`;

              return (
                <div 
                  key={client.clientName} 
                  className="p-4 rounded-xl bg-black border border-zinc-800"
                  data-testid={`card-client-${client.clientName}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-white capitalize">{client.clientName}</h3>
                      <p className="text-xs text-zinc-400">{client.totalMoves} moves • {statusLabel}</p>
                    </div>
                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 border rounded-full px-3 py-1 text-xs">
                      {statusLabel}
                    </Badge>
                  </div>

                  <div className="h-px bg-white/10 mb-4" />

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-zinc-400 mb-2">Sentiment</p>
                      <Select value={client.sentiment} onValueChange={(val) => updateSentiment.mutate({ clientName: client.clientName, sentiment: val })}>
                        <SelectTrigger 
                          className={`h-auto py-1.5 px-3 text-sm border rounded-full w-fit gap-1 ${
                            client.sentiment === 'positive' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                            client.sentiment === 'negative' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                            client.sentiment === 'complicated' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                            'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-800 border-zinc-700">
                          <SelectItem value="positive"><div className="flex gap-2 items-center text-emerald-400">👍 Positive</div></SelectItem>
                          <SelectItem value="neutral"><div className="flex gap-2 items-center text-amber-400">− Neutral</div></SelectItem>
                          <SelectItem value="negative"><div className="flex gap-2 items-center text-red-400">👎 Negative</div></SelectItem>
                          <SelectItem value="complicated"><div className="flex gap-2 items-center text-orange-400">⚠️ Complicated</div></SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 mb-2">Priority</p>
                      <Select value={client.importance} onValueChange={(val) => updateImportance.mutate({ clientName: client.clientName, importance: val })}>
                        <SelectTrigger 
                          className={`h-auto py-1.5 px-3 text-sm border rounded-full w-fit gap-1 ${
                            client.importance === 'high' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                            client.importance === 'low' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' :
                            'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-800 border-zinc-700">
                          <SelectItem value="high"><div className="flex gap-2 items-center text-yellow-400"><Star className="w-3 h-3" /> High</div></SelectItem>
                          <SelectItem value="medium"><div className="flex gap-2 items-center text-amber-400"><Star className="w-3 h-3" /> Medium</div></SelectItem>
                          <SelectItem value="low"><div className="flex gap-2 items-center text-cyan-400">Low</div></SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <p className="text-zinc-400 text-sm">No client data yet</p>}
      </section>
    </div>
  );

  return (
    <>
      <div className="h-screen flex md:hidden flex-col bg-black text-foreground font-sans overflow-hidden">
        <header className="border-b border-zinc-800 bg-black sticky top-0 z-10">
          <div className="px-4 py-4">
            <h1 className="text-2xl font-bold tracking-tight text-white">Metrics</h1>
            <p className="text-sm text-zinc-400">Real-time dashboard insights</p>
          </div>
        </header>

        <ScrollArea className="flex-1">
          <div className="p-4 pb-24 w-full">
            {MetricsContent}
          </div>
        </ScrollArea>
      </div>

      <div className="h-screen hidden md:flex flex-col bg-black text-foreground font-sans overflow-hidden">
        <div className="flex flex-1 overflow-hidden">
          <GlassSidebar />
          <IslandLayout>
            <div className="flex flex-col h-full bg-black">
              <div className="border-b border-zinc-800 px-6 py-4">
                <h1 className="text-2xl font-bold tracking-tight text-white">Metrics</h1>
                <p className="text-sm text-zinc-400">Real-time dashboard insights</p>
              </div>
              <IslandContent noPadding>
                <ScrollArea className="flex-1 h-full">
                  <div className="p-6 pb-24 max-w-4xl mx-auto">
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
