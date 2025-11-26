import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  CheckCircle2, AlertTriangle, XCircle, Users, FileText, 
  Zap, RefreshCw, Loader2, ArrowUpCircle, Sparkles, Edit3, Check
} from "lucide-react";

interface AutoAction {
  type: "promote" | "fill_field";
  moveId: number;
  moveTitle: string;
  clientName: string;
  from?: string;
  to?: string;
  field?: string;
  value?: string;
  reasoning: string;
}

interface TriageResult {
  date: string;
  timestamp: string;
  pipelineHealth: {
    totalClients: number;
    healthyClients: number;
    clientsWithIssues: { clientName: string; issues: string[] }[];
  };
  actionabilityIssues: { 
    moveId: number;
    title: string;
    clientName: string;
    status: string;
    reason: string;
  }[];
  missingFields: {
    moveId: number;
    title: string;
    clientName: string;
    status: string;
    missing: string[];
  }[];
  summary: {
    totalIssues: number;
    pipelineIssueCount: number;
    actionabilityIssueCount: number;
    missingFieldsCount: number;
    isHealthy: boolean;
  };
  autoActions?: AutoAction[];
  remainingIssues?: {
    pipelineGaps: { clientName: string; gap: string; reason: string }[];
    vagueTasksNeedingRewrite: { moveId: number; title: string; clientName: string; suggestion: string }[];
  };
}

interface TriageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TriageDialog({ open, onOpenChange }: TriageDialogProps) {
  const [triageKey, setTriageKey] = useState(0);
  const [selectedRewrites, setSelectedRewrites] = useState<Set<number>>(new Set());
  const [appliedRewrites, setAppliedRewrites] = useState<Set<number>>(new Set());
  
  const { data: triage, isLoading, isFetching } = useQuery<TriageResult>({
    queryKey: ['triage', triageKey],
    queryFn: async () => {
      const res = await fetch('/api/triage/auto-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to run triage');
      return res.json();
    },
    enabled: open,
    staleTime: 0,
  });

  const handleRefresh = () => {
    setTriageKey(prev => prev + 1);
    setSelectedRewrites(new Set());
    setAppliedRewrites(new Set());
    queryClient.invalidateQueries({ queryKey: ['/api/moves'] });
  };

  const applyRewritesMutation = useMutation({
    mutationFn: async (rewrites: { moveId: number; newTitle: string }[]) => {
      await Promise.all(
        rewrites.map(({ moveId, newTitle }) =>
          apiRequest('PATCH', `/api/moves/${moveId}`, { title: newTitle })
        )
      );
      return rewrites.map(r => r.moveId);
    },
    onSuccess: (appliedIds) => {
      setSelectedRewrites(new Set());
      setAppliedRewrites(prev => {
        const next = new Set(prev);
        appliedIds.forEach(id => next.add(id));
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['/api/moves'] });
    },
  });

  const handleToggleRewrite = (moveId: number) => {
    setSelectedRewrites(prev => {
      const next = new Set(prev);
      if (next.has(moveId)) {
        next.delete(moveId);
      } else {
        next.add(moveId);
      }
      return next;
    });
  };

  const handleApplySelectedRewrites = () => {
    const rewrites = vagueRewrites
      .filter(r => selectedRewrites.has(r.moveId))
      .map(r => ({ moveId: r.moveId, newTitle: r.suggestion }));
    if (rewrites.length > 0) {
      applyRewritesMutation.mutate(rewrites);
    }
  };

  const autoActions = triage?.autoActions || [];
  const promotions = autoActions.filter(a => a.type === "promote");
  const fieldFills = autoActions.filter(a => a.type === "fill_field");
  const allVagueRewrites = triage?.remainingIssues?.vagueTasksNeedingRewrite || [];
  const vagueRewrites = allVagueRewrites.filter(r => !appliedRewrites.has(r.moveId));
  const remainingGaps = triage?.remainingIssues?.pipelineGaps || [];
  
  const hasAutoActions = autoActions.length > 0;
  const isHealthy = triage?.summary.isHealthy ?? false;

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen && hasAutoActions) {
        queryClient.invalidateQueries({ queryKey: ['/api/moves'] });
      }
      onOpenChange(newOpen);
    }}>
      <DialogContent className="max-w-2xl w-[calc(100%-1rem)] sm:w-auto h-[85vh] sm:h-auto sm:max-h-[85vh] flex flex-col overflow-hidden mx-2">
        <DialogHeader className="shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <DialogTitle className="text-lg sm:text-xl">Daily Triage</DialogTitle>
              {triage && !isLoading && (
                <Badge 
                  variant={isHealthy ? "default" : hasAutoActions ? "default" : "destructive"}
                  className={`shrink-0 ${isHealthy ? "bg-green-500" : hasAutoActions ? "bg-blue-500" : ""}`}
                >
                  {isHealthy ? (
                    <><CheckCircle2 className="w-3 h-3 mr-1" /> All Clear</>
                  ) : hasAutoActions ? (
                    <><Sparkles className="w-3 h-3 mr-1" /> {autoActions.length} Fixed</>
                  ) : (
                    <><AlertTriangle className="w-3 h-3 mr-1" /> {triage.summary.totalIssues} Issues</>
                  )}
                </Badge>
              )}
            </div>
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={handleRefresh}
              disabled={isFetching}
              className="shrink-0"
              data-testid="button-triage-refresh"
            >
              {isFetching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          </div>
          <DialogDescription className="text-xs sm:text-sm">
            {hasAutoActions 
              ? "Auto-balanced pipelines and filled missing fields"
              : "Pipeline health check, actionability scan, and field validation"
            }
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 flex-1">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Running triage with auto-fix...</p>
            </div>
          </div>
        ) : triage ? (
          <ScrollArea className="flex-1 -mr-4 pr-4 min-h-0">
            <div className="space-y-4">
              {promotions.length > 0 && (
                <Card className="border-blue-500/50 bg-blue-500/5 overflow-hidden">
                  <CardHeader className="pb-2 px-3 sm:px-6">
                    <CardTitle className="text-sm sm:text-base flex items-center gap-2 text-blue-600 dark:text-blue-400">
                      <ArrowUpCircle className="w-4 h-4 shrink-0" />
                      <span>Promoted ({promotions.length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-6 overflow-hidden">
                    <div className="space-y-2">
                      {promotions.map((action, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-start gap-2 p-2 rounded-md bg-blue-500/10"
                          data-testid={`triage-promotion-${idx}`}
                        >
                          <ArrowUpCircle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs shrink-0">{action.clientName}</Badge>
                            </div>
                            <p className="font-medium text-sm break-words">"{action.moveTitle}"</p>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                              {action.from} → <span className="font-medium text-blue-600">{action.to}</span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-1 italic break-words">{action.reasoning}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {fieldFills.length > 0 && (
                <Card className="border-green-500/50 bg-green-500/5 overflow-hidden">
                  <CardHeader className="pb-2 px-3 sm:px-6">
                    <CardTitle className="text-sm sm:text-base flex items-center gap-2 text-green-600 dark:text-green-400">
                      <Sparkles className="w-4 h-4 shrink-0" />
                      <span>Fields Filled ({fieldFills.length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-6 overflow-hidden">
                    <div className="space-y-2">
                      {fieldFills.slice(0, 6).map((action, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-start gap-2 p-2 rounded-md bg-green-500/10"
                          data-testid={`triage-field-fill-${idx}`}
                        >
                          <Sparkles className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary" className="text-xs shrink-0">
                                {action.field}: {action.value}
                              </Badge>
                            </div>
                            <p className="font-medium text-sm break-words">"{action.moveTitle}"</p>
                          </div>
                        </div>
                      ))}
                      {fieldFills.length > 6 && (
                        <p className="text-xs text-muted-foreground pl-6">
                          +{fieldFills.length - 6} more
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="overflow-hidden">
                <CardHeader className="pb-2 px-3 sm:px-6">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <Users className="w-4 h-4 shrink-0" />
                    <span>Pipeline Health</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-6 overflow-hidden">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="text-2xl font-bold text-green-600">
                      {triage.pipelineHealth.healthyClients}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      of {triage.pipelineHealth.totalClients} clients healthy
                    </div>
                  </div>
                  
                  {triage.pipelineHealth.clientsWithIssues.length > 0 ? (
                    <div className="space-y-2">
                      {triage.pipelineHealth.clientsWithIssues.map((client, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-start gap-2 p-2 rounded-md bg-destructive/10"
                          data-testid={`triage-client-issue-${idx}`}
                        >
                          <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                          <div>
                            <span className="font-medium">{client.clientName}</span>
                            <ul className="text-sm text-muted-foreground mt-1">
                              {client.issues.map((issue, i) => (
                                <li key={i}>• {issue}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-sm">All clients have active, queued, and backlog tasks</span>
                    </div>
                  )}

                  {remainingGaps.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm text-muted-foreground mb-2">Could not auto-fix:</p>
                      {remainingGaps.map((gap, idx) => (
                        <div key={idx} className="text-sm text-muted-foreground">
                          • {gap.clientName}: {gap.gap} - <span className="italic">{gap.reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {vagueRewrites.length > 0 && (
                <Card className="border-amber-500/50 overflow-hidden">
                  <CardHeader className="pb-2 px-3 sm:px-6">
                    <CardTitle className="text-sm sm:text-base flex items-center gap-2 text-amber-600 dark:text-amber-400">
                      <Edit3 className="w-4 h-4 shrink-0" />
                      <span>Rewrites ({vagueRewrites.length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-6 overflow-hidden">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-3">
                      Select rewrites to apply:
                    </p>
                    <div className="space-y-2">
                      {vagueRewrites.map((item, idx) => {
                        const isSelected = selectedRewrites.has(item.moveId);
                        return (
                          <div 
                            key={idx} 
                            className={`p-2 sm:p-3 rounded-md cursor-pointer transition-colors overflow-hidden ${
                              isSelected 
                                ? "bg-amber-500/20 ring-1 ring-amber-500/50" 
                                : "bg-amber-500/10 hover-elevate"
                            }`}
                            onClick={() => handleToggleRewrite(item.moveId)}
                            data-testid={`triage-rewrite-${idx}`}
                          >
                            <div className="flex items-start gap-2 overflow-hidden">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleToggleRewrite(item.moveId)}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-0.5 shrink-0"
                                data-testid={`checkbox-rewrite-${idx}`}
                              />
                              <div className="flex-1 min-w-0 overflow-hidden">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs shrink-0">{item.clientName}</Badge>
                                </div>
                                <p className="text-xs sm:text-sm line-through text-muted-foreground break-words">"{item.title}"</p>
                                <p className="text-xs sm:text-sm font-medium text-amber-700 dark:text-amber-300 break-words mt-1">→ "{item.suggestion}"</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {triage.actionabilityIssues.length > 0 && vagueRewrites.length === 0 && (
                <Card className="overflow-hidden">
                  <CardHeader className="pb-2 px-3 sm:px-6">
                    <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                      <Zap className="w-4 h-4 shrink-0" />
                      <span>Actionability Check</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-6 overflow-hidden">
                    <div className="space-y-2">
                      {triage.actionabilityIssues.map((issue, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-start gap-2 p-2 rounded-md bg-amber-500/10"
                          data-testid={`triage-actionability-issue-${idx}`}
                        >
                          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">"{issue.title}"</span>
                              <Badge variant="outline" className="text-xs">{issue.clientName}</Badge>
                              <Badge variant="secondary" className="text-xs">{issue.status}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{issue.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {triage.missingFields.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Missing Fields
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {triage.missingFields.slice(0, 10).map((item, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-start gap-2 p-2 rounded-md bg-muted/50"
                          data-testid={`triage-missing-field-${idx}`}
                        >
                          <FileText className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">"{item.title}"</span>
                              <Badge variant="outline" className="text-xs">{item.clientName}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Missing: {item.missing.join(", ")}
                            </p>
                          </div>
                        </div>
                      ))}
                      {triage.missingFields.length > 10 && (
                        <p className="text-sm text-muted-foreground pl-6">
                          ...and {triage.missingFields.length - 10} more
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {triage.missingFields.length === 0 && triage.actionabilityIssues.length === 0 && triage.pipelineHealth.clientsWithIssues.length === 0 && (
                <Card className="border-green-500/50 bg-green-500/5">
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center gap-2 text-green-600">
                      <CheckCircle2 className="w-8 h-8" />
                      <span className="font-medium">All systems healthy!</span>
                      <span className="text-sm text-muted-foreground">Every client has a balanced pipeline with actionable tasks.</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Separator />
              
              <div className="text-xs text-muted-foreground text-center pb-2">
                Triage run at {new Date(triage.timestamp).toLocaleString('en-US', { 
                  timeZone: 'America/New_York',
                  dateStyle: 'medium',
                  timeStyle: 'short'
                })} ET
              </div>
            </div>
          </ScrollArea>
        ) : null}

        {selectedRewrites.size > 0 && (
          <div className="shrink-0 border-t pt-3 pb-1 px-1 bg-background">
            <Button
              onClick={handleApplySelectedRewrites}
              disabled={applyRewritesMutation.isPending}
              className="w-full"
              data-testid="button-apply-rewrites"
            >
              {applyRewritesMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Apply {selectedRewrites.size} Rewrite{selectedRewrites.size > 1 ? 's' : ''}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
