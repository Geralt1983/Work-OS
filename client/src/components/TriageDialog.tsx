import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  CheckCircle2, AlertTriangle, XCircle, Users, FileText, 
  Zap, RefreshCw, Loader2 
} from "lucide-react";

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
}

interface TriageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TriageDialog({ open, onOpenChange }: TriageDialogProps) {
  const [triageKey, setTriageKey] = useState(0);
  
  const { data: triage, isLoading, isFetching, refetch } = useQuery<TriageResult>({
    queryKey: ['/api/triage', triageKey],
    enabled: open,
    staleTime: 0,
  });

  const handleRefresh = () => {
    setTriageKey(prev => prev + 1);
    refetch();
  };

  const isHealthy = triage?.summary.isHealthy ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-xl">Daily Triage</DialogTitle>
              {triage && !isLoading && (
                <Badge 
                  variant={isHealthy ? "default" : "destructive"}
                  className={isHealthy ? "bg-green-500" : ""}
                >
                  {isHealthy ? (
                    <><CheckCircle2 className="w-3 h-3 mr-1" /> All Clear</>
                  ) : (
                    <><AlertTriangle className="w-3 h-3 mr-1" /> {triage.summary.totalIssues} Issues</>
                  )}
                </Badge>
              )}
            </div>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={handleRefresh}
              disabled={isFetching}
              data-testid="button-triage-refresh"
            >
              {isFetching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          </div>
          <DialogDescription>
            Pipeline health check, actionability scan, and field validation
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Running triage analysis...</p>
            </div>
          </div>
        ) : triage ? (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Pipeline Health
                  </CardTitle>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Actionability Check
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {triage.actionabilityIssues.length > 0 ? (
                    <div className="space-y-2">
                      {triage.actionabilityIssues.map((issue, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-start gap-2 p-2 rounded-md bg-amber-500/10"
                          data-testid={`triage-actionability-issue-${idx}`}
                        >
                          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">"{issue.title}"</span>
                              <Badge variant="outline" className="text-xs">{issue.clientName}</Badge>
                              <Badge variant="secondary" className="text-xs">{issue.status}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{issue.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-sm">All active and queued moves are actionable</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Missing Fields
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {triage.missingFields.length > 0 ? (
                    <div className="space-y-2">
                      {triage.missingFields.slice(0, 10).map((item, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-start gap-2 p-2 rounded-md bg-muted/50"
                          data-testid={`triage-missing-field-${idx}`}
                        >
                          <FileText className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <div className="flex items-center gap-2">
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
                  ) : (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-sm">All moves have drain type and effort estimate</span>
                    </div>
                  )}
                </CardContent>
              </Card>

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
      </DialogContent>
    </Dialog>
  );
}
