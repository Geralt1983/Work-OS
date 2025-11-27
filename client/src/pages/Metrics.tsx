import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Target, TrendingUp, Users, AlertCircle, CheckCircle2, Brain, MessageCircle, FileText, Lightbulb, Zap, Archive, Star, Minus, AlertTriangle, ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { DRAIN_TYPE_LABELS, type DrainType } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import GlassSidebar from "@/components/GlassSidebar";
import IslandLayout from "@/components/IslandLayout";
import { TriageDialog } from "@/components/TriageDialog";

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
    onError: (error) => {
      toast({ title: "Error", description: "Failed to update priority", variant: "destructive" });
    },
  });

  return (
    <div className="h-screen flex" data-testid="page-metrics">
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
          <Card data-testid="card-today-pacing">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5" />
                Today's Pacing
              </CardTitle>
              {loadingToday ? (
                <Skeleton className="h-6 w-20" />
              ) : (
                <Badge variant={todayMetrics && todayMetrics.pacingPercent >= 100 ? "default" : "secondary"} data-testid="badge-pacing-percent">
                  {todayMetrics?.pacingPercent || 0}%
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              {loadingToday ? (
                <div className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-8 w-32" />
                </div>
              ) : todayMetrics ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">
                        {formatMinutes(todayMetrics.estimatedMinutes)} of {formatMinutes(todayMetrics.targetMinutes)} target
                      </span>
                      <span className="font-medium" data-testid="text-moves-today">
                        {todayMetrics.movesCompleted} moves
                      </span>
                    </div>
                    <Progress value={Math.min(todayMetrics.pacingPercent, 100)} className="h-3" data-testid="progress-pacing" />
                  </div>
                  
                  <div className="flex flex-wrap gap-4 text-sm">
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
            </CardContent>
          </Card>

          {/* Weekly Trends */}
          <Card data-testid="card-weekly-trends">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Weekly Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingWeekly ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : weeklyMetrics && Array.isArray(weeklyMetrics.days) && weeklyMetrics.days.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-4 text-sm mb-4">
                    <div>
                      <span className="text-muted-foreground">Total moves: </span>
                      <span className="font-medium" data-testid="text-total-moves">{weeklyMetrics.totalMoves}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total time: </span>
                      <span className="font-medium">{formatMinutes(weeklyMetrics.totalMinutes)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Avg/day: </span>
                      <span className="font-medium">{weeklyMetrics.averageMovesPerDay} moves</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {weeklyMetrics.days.map((day) => (
                      <div key={day.date} className="flex items-center gap-4" data-testid={`row-day-${day.date}`}>
                        <div className="w-24 text-sm text-muted-foreground shrink-0">
                          {formatDate(day.date)}
                        </div>
                        <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${Math.min(day.pacingPercent, 100)}%` }}
                          />
                        </div>
                        <div className="w-20 text-sm text-right shrink-0">
                          <span className="font-medium">{day.movesCompleted}</span>
                          <span className="text-muted-foreground"> moves</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No weekly data yet</p>
              )}
            </CardContent>
          </Card>

          {/* Work Type Breakdown */}
          <Card data-testid="card-drain-types">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Work Type Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingDrain ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-8 w-full" />
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
                          className="flex items-center gap-2 p-2 rounded-lg border"
                          data-testid={`drain-type-${metric.drainType}`}
                        >
                          <div className={`w-3 h-3 rounded-full ${DRAIN_COLORS[metric.drainType] || DRAIN_COLORS.unset}`} />
                          {DrainIcon && <DrainIcon className="h-4 w-4 text-muted-foreground" />}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
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
            </CardContent>
          </Card>

          {/* Backlog Health */}
          <Card data-testid="card-backlog-health">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Archive className="h-5 w-5" />
                Backlog Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingBacklog ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : backlogHealth && backlogHealth.length > 0 ? (
                <div className="space-y-3">
                  {backlogHealth.map((client) => (
                    <div 
                      key={client.clientName} 
                      className="flex items-center justify-between p-3 rounded-lg border"
                      data-testid={`backlog-client-${client.clientName}`}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium capitalize">{client.clientName}</span>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>{client.totalCount} in backlog</span>
                          <span>avg {client.avgDays}d old</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {client.agingCount > 0 ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {client.agingCount} aging
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Healthy
                          </Badge>
                        )}
                        {client.oldestDays >= 7 && (
                          <span className="text-sm text-orange-600 dark:text-orange-400">
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
            </CardContent>
          </Card>

          {/* Productivity Patterns */}
          <Card data-testid="card-productivity">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Productivity by Time of Day
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingProductivity ? (
                <Skeleton className="h-20 w-full" />
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
                            className={`w-full rounded-t ${isPositive ? "bg-green-500" : total > 0 ? "bg-red-400" : "bg-muted"}`}
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
                  <div className="flex gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-green-500" />
                      <span>More completions</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-red-400" />
                      <span>More deferrals</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No productivity data yet. Complete some tasks to see patterns.</p>
              )}
            </CardContent>
          </Card>

          {/* Avoided Tasks */}
          {avoidedTasks && avoidedTasks.length > 0 && (
            <Card data-testid="card-avoided-tasks">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  Avoided Tasks
                  <Badge variant="secondary" className="text-xs">
                    {avoidedTasks.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {avoidedTasks.slice(0, 5).map((task) => (
                    <div 
                      key={task.taskId} 
                      className="flex items-center justify-between p-2 rounded-lg border"
                      data-testid={`avoided-task-${task.taskId}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{task.taskName}</div>
                        <div className="text-xs text-muted-foreground capitalize">{task.clientName}</div>
                      </div>
                      <Badge variant="destructive" className="text-xs shrink-0">
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
              </CardContent>
            </Card>
          )}

          {/* Client Metrics */}
          <Card data-testid="card-client-metrics">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Client Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingClients ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : clientMetrics && Array.isArray(clientMetrics) && clientMetrics.length > 0 ? (
                <div className="space-y-3">
                  {clientMetrics.map((client) => (
                    <div 
                      key={client.clientName} 
                      className="p-3 rounded-lg border space-y-2"
                      data-testid={`row-client-${client.clientName}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium capitalize">{client.clientName}</span>
                          <span className="text-sm text-muted-foreground">
                            {client.totalMoves} moves
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {client.daysSinceLastMove >= 2 ? (
                            <div className="flex items-center gap-1 text-sm text-orange-600 dark:text-orange-400">
                              <AlertCircle className="h-4 w-4" />
                              <span>{client.daysSinceLastMove}d stale</span>
                            </div>
                          ) : client.daysSinceLastMove === 0 ? (
                            <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
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
                            <SelectTrigger className="h-7 w-[110px] text-xs" data-testid={`select-sentiment-${client.clientName}`}>
                              {updateSentiment.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <SelectValue />
                              )}
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="positive">
                                <div className="flex items-center gap-1">
                                  <ThumbsUp className="h-3 w-3 text-green-500" />
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
                                  <ThumbsDown className="h-3 w-3 text-red-500" />
                                  <span>Negative</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="complicated">
                                <div className="flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3 text-yellow-500" />
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
                            <SelectTrigger className="h-7 w-[90px] text-xs" data-testid={`select-importance-${client.clientName}`}>
                              {updateImportance.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <SelectValue />
                              )}
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="high">
                                <div className="flex items-center gap-1">
                                  <Star className="h-3 w-3 text-yellow-500" />
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
            </CardContent>
          </Card>

            </div>
          </ScrollArea>
        </div>
      </IslandLayout>

      <TriageDialog open={triageOpen} onOpenChange={setTriageOpen} />
    </div>
  );
}
