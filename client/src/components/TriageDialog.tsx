import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ArcCard } from "@/components/ArcCard";
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
      <DialogContent className="max-w-2xl w-[calc(100%-1rem)] sm:w-auto max-h-[85vh] flex flex-col overflow-hidden mx-2 bg-[#0f0f1a]/95 backdrop-blur-2xl border-white/10 text-white shadow-2xl">
        <DialogHeader className="shrink-0 border-b border-white/5 pb-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <DialogTitle className="text-lg sm:text-xl font-bold tracking-wide">Daily Triage</DialogTitle>
              {triage && !isLoading && (
                <Badge 
                  variant="outline"
                  className={`shrink-0 border-0 ${isHealthy ? "bg-emerald-500/20 text-emerald-400" : hasAutoActions ? "bg-cyan-500/20 text-cyan-400" : "bg-rose-500/20 text-rose-400"}`}
                >
                  {isHealthy ? (
                    <><CheckCircle2 className="w-3 h-3 mr-1.5" /> All Clear</>
                  ) : hasAutoActions ? (
                    <><Sparkles className="w-3 h-3 mr-1.5" /> {autoActions.length} Fixed</>
                  ) : (
                    <><AlertTriangle className="w-3 h-3 mr-1.5" /> {triage.summary.totalIssues} Issues</>
                  )}
                </Badge>
              )}
            </div>
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={handleRefresh}
              disabled={isFetching}
              className="shrink-0 text-muted-foreground hover:text-white hover:bg-white/10 rounded-full"
              data-testid="button-triage-refresh"
            >
              {isFetching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          </div>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground/70">
            {hasAutoActions 
              ? "Auto-balanced pipelines and filled missing fields"
              : "Pipeline health check, actionability scan, and field validation"
            }
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 flex-1">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              <p className="text-sm text-muted-foreground animate-pulse">Running triage...</p>
            </div>
          </div>
        ) : triage ? (
          <ScrollArea className="flex-1 -mr-4 pr-4 min-h-0">
            <div className="space-y-4 pt-4">
              {promotions.length > 0 && (
                <ArcCard glowColor="cyan" className="bg-cyan-500/5 border-cyan-500/20">
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-cyan-400 font-medium">
                      <ArrowUpCircle className="w-4 h-4" />
                      <span>Promoted ({promotions.length})</span>
                    </div>
                    <div className="space-y-2">
                      {promotions.map((action, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-2.5 rounded-xl bg-black/20 border border-white/5" data-testid={`triage-promotion-${idx}`}>
                          <ArrowUpCircle className="w-4 h-4 text-cyan-500 mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{action.clientName}</span>
                            </div>
                            <p className="font-medium text-sm text-white/90">"{action.moveTitle}"</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {action.from} → <span className="text-cyan-400 font-medium">{action.to}</span>
                            </p>
                            <p className="text-xs text-white/40 mt-1 italic">{action.reasoning}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </ArcCard>
              )}

              {fieldFills.length > 0 && (
                <ArcCard glowColor="purple" className="bg-purple-500/5 border-purple-500/20">
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-purple-400 font-medium">
                      <Sparkles className="w-4 h-4" />
                      <span>Fields Filled ({fieldFills.length})</span>
                    </div>
                    <div className="space-y-2">
                      {fieldFills.slice(0, 6).map((action, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-2.5 rounded-xl bg-black/20 border border-white/5" data-testid={`triage-field-fill-${idx}`}>
                          <Sparkles className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary" className="text-[10px] bg-purple-500/20 text-purple-300 border-0">
                                {action.field}: {action.value}
                              </Badge>
                            </div>
                            <p className="font-medium text-sm text-white/90">"{action.moveTitle}"</p>
                          </div>
                        </div>
                      ))}
                      {fieldFills.length > 6 && (
                        <p className="text-xs text-muted-foreground pl-6">
                          +{fieldFills.length - 6} more
                        </p>
                      )}
                    </div>
                  </div>
                </ArcCard>
              )}

              <ArcCard glowColor="none" className="bg-white/5">
                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-2 text-white/80 font-medium">
                    <Users className="w-4 h-4" />
                    <span>Pipeline Health</span>
                  </div>
                  
                  <div className="flex items-center gap-4 px-2">
                    <div className="text-3xl font-bold text-emerald-400">
                      {triage.pipelineHealth.healthyClients}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      of {triage.pipelineHealth.totalClients} clients healthy
                    </div>
                  </div>
                  
                  {triage.pipelineHealth.clientsWithIssues.length > 0 ? (
                    <div className="space-y-2">
                      {triage.pipelineHealth.clientsWithIssues.map((client, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20" data-testid={`triage-client-issue-${idx}`}>
                          <XCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-medium text-rose-200">{client.clientName}</span>
                            <ul className="text-xs text-rose-200/70 mt-1 space-y-0.5">
                              {client.issues.map((issue, i) => (
                                <li key={i}>• {issue}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-sm">All clients have active, queued, and backlog tasks</span>
                    </div>
                  )}

                  {remainingGaps.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <p className="text-sm text-muted-foreground mb-2">Could not auto-fix:</p>
                      {remainingGaps.map((gap, idx) => (
                        <div key={idx} className="text-sm text-muted-foreground">
                          • {gap.clientName}: {gap.gap} - <span className="italic">{gap.reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ArcCard>

              {vagueRewrites.length > 0 && (
                <ArcCard glowColor="orange" className="bg-orange-500/5 border-orange-500/20">
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-orange-400 font-medium">
                      <Edit3 className="w-4 h-4" />
                      <span>Rewrites ({vagueRewrites.length})</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Select rewrites to apply:</p>
                    <div className="space-y-2">
                      {vagueRewrites.map((item, idx) => {
                        const isSelected = selectedRewrites.has(item.moveId);
                        return (
                          <div 
                            key={idx} 
                            className={`p-3 rounded-xl cursor-pointer transition-all duration-200 border ${
                              isSelected 
                                ? "bg-orange-500/20 border-orange-500/40" 
                                : "bg-black/20 border-white/5 hover:bg-orange-500/10"
                            }`}
                            onClick={() => handleToggleRewrite(item.moveId)}
                            data-testid={`triage-rewrite-${idx}`}
                          >
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleToggleRewrite(item.moveId)}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-1 border-orange-500/50 data-[state=checked]:bg-orange-500 data-[state=checked]:text-white"
                                data-testid={`checkbox-rewrite-${idx}`}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] uppercase font-bold text-muted-foreground">{item.clientName}</span>
                                </div>
                                <p className="text-sm text-muted-foreground line-through decoration-orange-500/50">"{item.title}"</p>
                                <p className="text-sm font-medium text-orange-300 mt-1">→ "{item.suggestion}"</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </ArcCard>
              )}

              {triage.actionabilityIssues.length > 0 && vagueRewrites.length === 0 && (
                <ArcCard glowColor="none" className="bg-white/5">
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-white/80 font-medium">
                      <Zap className="w-4 h-4" />
                      <span>Actionability Check</span>
                    </div>
                    <div className="space-y-2">
                      {triage.actionabilityIssues.map((issue, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20" data-testid={`triage-actionability-issue-${idx}`}>
                          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-medium text-white/90">"{issue.title}"</span>
                              <Badge variant="secondary" className="text-[10px] bg-white/10 text-white/60 border-0">{issue.clientName}</Badge>
                              <Badge variant="secondary" className="text-[10px] bg-white/10 text-white/60 border-0">{issue.status}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{issue.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </ArcCard>
              )}

              {triage.missingFields.length > 0 && (
                <ArcCard glowColor="none" className="bg-white/5">
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-white/80 font-medium">
                      <FileText className="w-4 h-4" />
                      <span>Missing Fields</span>
                    </div>
                    <div className="space-y-2">
                      {triage.missingFields.slice(0, 10).map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-2.5 rounded-xl bg-black/20 border border-white/5" data-testid={`triage-missing-field-${idx}`}>
                          <FileText className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-medium text-white/90">"{item.title}"</span>
                              <Badge variant="secondary" className="text-[10px] bg-white/10 text-white/60 border-0">{item.clientName}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Missing: {item.missing.join(", ")}
                            </p>
                          </div>
                        </div>
                      ))}
                      {triage.missingFields.length > 10 && (
                        <p className="text-xs text-muted-foreground pl-6">
                          ...and {triage.missingFields.length - 10} more
                        </p>
                      )}
                    </div>
                  </div>
                </ArcCard>
              )}

              {triage.missingFields.length === 0 && triage.actionabilityIssues.length === 0 && triage.pipelineHealth.clientsWithIssues.length === 0 && (
                <ArcCard glowColor="emerald" className="bg-emerald-500/10 border-emerald-500/30">
                  <div className="p-8 flex flex-col items-center text-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-1">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <span className="text-lg font-bold text-white">All systems healthy!</span>
                    <span className="text-sm text-muted-foreground">Every client has a balanced pipeline with actionable tasks.</span>
                  </div>
                </ArcCard>
              )}

              <div className="text-xs text-muted-foreground/50 text-center pb-2 pt-2">
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
          <div className="shrink-0 pt-4 pb-2">
            <Button
              onClick={handleApplySelectedRewrites}
              disabled={applyRewritesMutation.isPending}
              className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-glow-orange transition-all"
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
