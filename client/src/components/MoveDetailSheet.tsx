import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Move, Client, DrainType, MoveStatus } from "@shared/schema";
import { EFFORT_LEVELS, DRAIN_TYPES, DRAIN_TYPE_LABELS, MOVE_STATUSES } from "@shared/schema";
import { ChevronUp, ChevronDown, Check, Trash2, Save, Clock, AlertCircle, Wand2, Scissors, Loader2, ArrowRight } from "lucide-react";
import { format } from "date-fns";

const moveEditSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  clientId: z.string().optional(),
  status: z.enum(MOVE_STATUSES),
  effortEstimate: z.number().min(1).max(4),
  drainType: z.string().optional(),
});

type MoveEditValues = z.infer<typeof moveEditSchema>;

interface MoveDetailSheetProps {
  move: Move | null;
  clients: Client[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

function getDaysOld(createdAt: Date | string | null): number {
  if (!createdAt) return 0;
  const created = new Date(createdAt);
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

interface Subtask {
  title: string;
  drainType: string;
}

export default function MoveDetailSheet({ move, clients, open, onOpenChange, onUpdate }: MoveDetailSheetProps) {
  const { toast } = useToast();
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [breakdownDialogOpen, setBreakdownDialogOpen] = useState(false);
  const [suggestedTitle, setSuggestedTitle] = useState<string | null>(null);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  
  // Find General Admin client as default fallback (all tasks must have a client)
  const adminClient = clients.find(c => c.name.toLowerCase().includes('admin') || c.name.toLowerCase().includes('general'));
  const defaultClientId = adminClient?.id?.toString() || clients[0]?.id?.toString() || "";
  
  const form = useForm<MoveEditValues>({
    resolver: zodResolver(moveEditSchema),
    defaultValues: {
      title: "",
      description: "",
      clientId: defaultClientId,
      status: "backlog",
      effortEstimate: 2,
      drainType: "none",
    },
  });

  useEffect(() => {
    if (move) {
      form.reset({
        title: move.title,
        description: move.description || "",
        clientId: move.clientId?.toString() || defaultClientId,
        status: move.status as MoveStatus,
        effortEstimate: move.effortEstimate || 2,
        drainType: move.drainType || "none",
      });
    }
  }, [move, form, defaultClientId]);

  useEffect(() => {
    if (!open) {
      setSuggestedTitle(null);
      setSubtasks([]);
    }
  }, [open]);

  const updateMutation = useMutation({
    mutationFn: async (values: MoveEditValues) => {
      const payload = {
        ...values,
        clientId: values.clientId ? parseInt(values.clientId) : null,
        drainType: values.drainType && values.drainType !== "none" ? values.drainType : null,
      };
      await apiRequest("PATCH", `/api/moves/${move?.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
      toast({ title: "Move updated" });
      onUpdate();
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update move", variant: "destructive" });
    },
  });

  const promoteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/moves/${move?.id}/promote`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
      onUpdate();
      onOpenChange(false);
    },
  });

  const demoteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/moves/${move?.id}/demote`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
      onUpdate();
      onOpenChange(false);
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/moves/${move?.id}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
      toast({ title: "Move completed", description: move?.title });
      onOpenChange(false);
      onUpdate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/moves/${move?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
      toast({ title: "Move deleted" });
      onOpenChange(false);
      onUpdate();
    },
  });

  const suggestRenameMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/moves/${move?.id}/suggest-rename`);
      return res.json();
    },
    onSuccess: (data: { suggestedTitle: string }) => {
      setSuggestedTitle(data.suggestedTitle);
      setRenameDialogOpen(true);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to suggest rename", variant: "destructive" });
    },
  });

  const applyRenameMutation = useMutation({
    mutationFn: async (newTitle: string) => {
      await apiRequest("PATCH", `/api/moves/${move?.id}`, { title: newTitle });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
      toast({ title: "Move renamed" });
      setRenameDialogOpen(false);
      form.setValue("title", suggestedTitle || "");
      onUpdate();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to rename", variant: "destructive" });
    },
  });

  const breakdownMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/moves/${move?.id}/breakdown`);
      return res.json();
    },
    onSuccess: (data: { subtasks: Subtask[] }) => {
      setSubtasks(data.subtasks || []);
      setBreakdownDialogOpen(true);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to break down task", variant: "destructive" });
    },
  });

  const applyBreakdownMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/moves/${move?.id}/apply-breakdown`, { subtasks });
      return res.json();
    },
    onSuccess: (data: { created: Move[]; message: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
      toast({ title: "Task broken down", description: `Created ${data.created.length} subtasks` });
      setBreakdownDialogOpen(false);
      onOpenChange(false);
      onUpdate();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to apply breakdown", variant: "destructive" });
    },
  });

  if (!move) return null;

  const client = clients.find(c => c.id === move.clientId);
  const daysOld = getDaysOld(move.createdAt);
  const isAging = daysOld >= 7 && move.status === "backlog";
  const isStale = daysOld >= 10 && move.status === "backlog";
  const canPromote = move.status !== "active" && move.status !== "done";
  const canDemote = move.status !== "backlog" && move.status !== "done";

  const onSubmit = (values: MoveEditValues) => {
    updateMutation.mutate(values);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-[#141420] border-white/10 text-white sm:max-w-md overflow-y-auto" data-testid="sheet-move-detail">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white" data-testid="sheet-move-title">
            Edit Move
            {isStale && (
              <Badge variant="destructive" className="text-xs gap-1">
                <AlertCircle className="h-3 w-3" />
                {daysOld}d old
              </Badge>
            )}
            {isAging && !isStale && (
              <Badge variant="outline" className="text-xs gap-1 text-yellow-400 border-yellow-400/50">
                <Clock className="h-3 w-3" />
                {daysOld}d old
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription className="text-slate-400">
            Make changes to your move details below.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap gap-2">
            {canPromote && (
              <Button
                variant="outline"
                size="sm"
                className="bg-transparent border-white/10 hover:bg-white/5 text-white"
                onClick={() => promoteMutation.mutate()}
                disabled={promoteMutation.isPending}
                data-testid="sheet-button-promote"
              >
                <ChevronUp className="h-4 w-4 mr-1" />
                Promote
              </Button>
            )}
            {canDemote && (
              <Button
                variant="outline"
                size="sm"
                className="bg-transparent border-white/10 hover:bg-white/5 text-white"
                onClick={() => demoteMutation.mutate()}
                disabled={demoteMutation.isPending}
                data-testid="sheet-button-demote"
              >
                <ChevronDown className="h-4 w-4 mr-1" />
                Demote
              </Button>
            )}
            {move.status !== "done" && (
              <Button
                variant="outline"
                size="sm"
                className="text-green-400 border-green-500/30 hover:bg-green-500/10"
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                data-testid="sheet-button-complete"
              >
                <Check className="h-4 w-4 mr-1" />
                Complete
              </Button>
            )}
          </div>

          {move.status !== "done" && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20"
                onClick={() => suggestRenameMutation.mutate()}
                disabled={suggestRenameMutation.isPending}
                data-testid="sheet-button-rename"
              >
                {suggestRenameMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-1" />
                )}
                Rename
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20"
                onClick={() => breakdownMutation.mutate()}
                disabled={breakdownMutation.isPending}
                data-testid="sheet-button-breakdown"
              >
                {breakdownMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Scissors className="h-4 w-4 mr-1" />
                )}
                Break Down
              </Button>
            </div>
          )}

          <Separator className="bg-white/10" />

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-400">Title</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        className="bg-black/20 border-white/10 text-white focus-visible:ring-purple-500/50" 
                        data-testid="sheet-input-title"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-400">Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        value={field.value || ""}
                        className="resize-none min-h-[100px] bg-black/20 border-white/10 text-white focus-visible:ring-purple-500/50"
                        data-testid="sheet-input-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-400">Client</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-black/20 border-white/10 text-white" data-testid="sheet-select-client">
                          <SelectValue placeholder="Select client" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-[#1a1b26] border-white/10 text-white">
                        {clients.map(c => (
                          <SelectItem key={c.id} value={c.id.toString()}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-400">Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-black/20 border-white/10 text-white" data-testid="sheet-select-status">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-[#1a1b26] border-white/10 text-white">
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="queued">Queued</SelectItem>
                          <SelectItem value="backlog">Backlog</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="effortEstimate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-400">Effort</FormLabel>
                      <Select 
                        onValueChange={(v) => field.onChange(parseInt(v))} 
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-black/20 border-white/10 text-white" data-testid="sheet-select-effort">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-[#1a1b26] border-white/10 text-white">
                          {EFFORT_LEVELS.map(level => (
                            <SelectItem key={level.value} value={level.value.toString()}>
                              {level.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="drainType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-400">Drain Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-black/20 border-white/10 text-white" data-testid="sheet-select-drain">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-[#1a1b26] border-white/10 text-white">
                        <SelectItem value="none">None</SelectItem>
                        {DRAIN_TYPES.map(type => (
                          <SelectItem key={type} value={type}>
                            {DRAIN_TYPE_LABELS[type as DrainType].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {move.createdAt && (
                <p className="text-xs text-slate-500">
                  Created: {format(new Date(move.createdAt), "MMM d, yyyy 'at' h:mm a")}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <Button 
                  type="submit" 
                  className="bg-gradient-to-r from-purple-600 to-pink-600 border-0 text-white"
                  disabled={updateMutation.isPending}
                  data-testid="sheet-button-save"
                >
                  <Save className="h-4 w-4 mr-1" />
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>

          <Separator className="bg-white/10" />

          <div className="pt-2">
            <Button
              variant="destructive"
              size="sm"
              className="bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:bg-rose-500/30"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid="sheet-button-delete"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete Move
            </Button>
          </div>
        </div>
      </SheetContent>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="bg-[#141420] border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-purple-400" />
              Rename Suggestion
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              AI-suggested actionable title for this move.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Current</p>
              <p className="text-sm text-slate-400 line-through">{move?.title}</p>
            </div>
            <div className="flex items-center gap-2 text-purple-400">
              <ArrowRight className="h-4 w-4" />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Suggested</p>
              <p className="text-sm font-medium text-white">{suggestedTitle}</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="bg-transparent border-white/10 text-white hover:bg-white/5"
              onClick={() => setRenameDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => suggestedTitle && applyRenameMutation.mutate(suggestedTitle)}
              disabled={applyRenameMutation.isPending}
              data-testid="dialog-button-apply-rename"
            >
              {applyRenameMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-1" />
              )}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={breakdownDialogOpen} onOpenChange={setBreakdownDialogOpen}>
        <DialogContent className="bg-[#141420] border-white/10 text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="h-5 w-5 text-cyan-400" />
              Break Down Task
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              This will replace "{move?.title}" with {subtasks.length} smaller subtasks.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4 max-h-[50vh] overflow-y-auto">
            {subtasks.map((subtask, idx) => (
              <div 
                key={idx} 
                className="flex items-start gap-3 p-3 rounded-xl bg-black/30 border border-white/5"
                data-testid={`breakdown-subtask-${idx}`}
              >
                <span className="shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-bold">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{subtask.title}</p>
                  <Badge variant="secondary" className="mt-1.5 text-[10px] bg-white/10 text-white/60 border-0">
                    {subtask.drainType}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="bg-transparent border-white/10 text-white hover:bg-white/5"
              onClick={() => setBreakdownDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-cyan-600 hover:bg-cyan-700 text-white"
              onClick={() => applyBreakdownMutation.mutate()}
              disabled={applyBreakdownMutation.isPending || subtasks.length === 0}
              data-testid="dialog-button-apply-breakdown"
            >
              {applyBreakdownMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-1" />
              )}
              Replace with {subtasks.length} Subtasks
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
