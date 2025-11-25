import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Target, TrendingUp, Users, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

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

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
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
  const { data: todayMetrics, isLoading: loadingToday } = useQuery<TodayMetrics>({
    queryKey: ["/api/metrics/today"],
  });

  const { data: weeklyMetrics, isLoading: loadingWeekly } = useQuery<WeeklyMetrics>({
    queryKey: ["/api/metrics/weekly"],
  });

  const { data: clientMetrics, isLoading: loadingClients } = useQuery<ClientMetric[]>({
    queryKey: ["/api/metrics/clients"],
  });

  return (
    <div className="h-screen flex flex-col bg-background" data-testid="page-metrics">
      <header className="h-16 border-b flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight" data-testid="text-page-title">Metrics</h1>
            <p className="text-sm text-muted-foreground">Track your work pacing and client activity</p>
          </div>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
          
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
                      className="flex items-center justify-between p-3 rounded-lg border"
                      data-testid={`row-client-${client.clientName}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-medium capitalize">{client.clientName}</span>
                            <Badge variant={getImportanceBadgeVariant(client.importance)}>
                              {client.importance}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{client.totalMoves} total moves</span>
                            <span className={getSentimentColor(client.sentiment)}>
                              {client.sentiment !== "neutral" && `(${client.sentiment})`}
                            </span>
                          </div>
                        </div>
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
  );
}
