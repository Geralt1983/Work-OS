import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
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
import { ChevronUp, ChevronDown, Check, Trash2, Save, X, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";

const STATUS_LABELS: Record<MoveStatus, string> = {
  active: "Active",
  queued: "Queued",
  backlog: "Backlog",
  done: "Done",
};

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

export default function MoveDetailSheet({ move, clients, open, onOpenChange, onUpdate }: MoveDetailSheetProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const form = useForm<MoveEditValues>({
    resolver: zodResolver(moveEditSchema),
    defaultValues: {
      title: "",
      description: "",
      clientId: "none",
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
        clientId: move.clientId?.toString() || "none",
        status: move.status as MoveStatus,
        effortEstimate: move.effortEstimate || 2,
        drainType: move.drainType || "none",
      });
      setIsEditing(false);
    }
  }, [move, form]);

  const updateMutation = useMutation({
    mutationFn: async (values: MoveEditValues) => {
      const payload = {
        ...values,
        clientId: values.clientId && values.clientId !== "none" ? parseInt(values.clientId) : null,
        drainType: values.drainType && values.drainType !== "none" ? values.drainType : null,
      };
      await apiRequest("PATCH", `/api/moves/${move?.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
      toast({ title: "Move updated" });
      setIsEditing(false);
      onUpdate();
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
    },
  });

  const demoteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/moves/${move?.id}/demote`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
      onUpdate();
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
      toast({ title: "Move deleted" });
      onOpenChange(false);
      onUpdate();
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

  const handleCancel = () => {
    form.reset({
      title: move.title,
      description: move.description || "",
      clientId: move.clientId?.toString() || "none",
      status: move.status as MoveStatus,
      effortEstimate: move.effortEstimate || 2,
      drainType: move.drainType || "none",
    });
    setIsEditing(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto" data-testid="sheet-move-detail">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2" data-testid="sheet-move-title">
            Move Details
            {isStale && (
              <Badge variant="destructive" className="text-xs gap-1">
                <AlertCircle className="h-3 w-3" />
                {daysOld}d old
              </Badge>
            )}
            {isAging && !isStale && (
              <Badge variant="outline" className="text-xs gap-1 text-yellow-600 border-yellow-400">
                <Clock className="h-3 w-3" />
                {daysOld}d old
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            {client ? `${client.name}` : "No client"} • {STATUS_LABELS[move.status as MoveStatus]}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="flex gap-2">
            {canPromote && (
              <Button
                variant="outline"
                size="sm"
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
                className="text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-950"
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                data-testid="sheet-button-complete"
              >
                <Check className="h-4 w-4 mr-1" />
                Complete
              </Button>
            )}
          </div>

          <Separator />

          {isEditing ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="sheet-input-title" />
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
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          value={field.value || ""}
                          className="resize-none min-h-[100px]"
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
                      <FormLabel>Client</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="sheet-select-client">
                            <SelectValue placeholder="Select client" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No client</SelectItem>
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
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="sheet-select-status">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
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
                        <FormLabel>Effort</FormLabel>
                        <Select 
                          onValueChange={(v) => field.onChange(parseInt(v))} 
                          value={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="sheet-select-effort">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
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
                      <FormLabel>Drain Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="sheet-select-drain">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
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

                <div className="flex gap-2 pt-2">
                  <Button 
                    type="submit" 
                    disabled={updateMutation.isPending}
                    data-testid="sheet-button-save"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    {updateMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={handleCancel}
                    data-testid="sheet-button-cancel"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg" data-testid="sheet-display-title">{move.title}</h3>
                {move.description && (
                  <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap" data-testid="sheet-display-description">
                    {move.description}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {client && (
                  <Badge variant="outline" data-testid="sheet-badge-client">
                    {client.name}
                  </Badge>
                )}
                <Badge variant="secondary" data-testid="sheet-badge-status">
                  {STATUS_LABELS[move.status as MoveStatus]}
                </Badge>
                {move.effortEstimate && (
                  <Badge variant="secondary" data-testid="sheet-badge-effort">
                    {EFFORT_LEVELS.find(e => e.value === move.effortEstimate)?.label || `${move.effortEstimate}`}
                  </Badge>
                )}
                {move.drainType && move.drainType !== "none" && (
                  <Badge variant="secondary" data-testid="sheet-badge-drain">
                    {DRAIN_TYPE_LABELS[move.drainType as DrainType]?.label || move.drainType}
                  </Badge>
                )}
              </div>

              {move.createdAt && (
                <p className="text-xs text-muted-foreground">
                  Created: {format(new Date(move.createdAt), "MMM d, yyyy 'at' h:mm a")}
                </p>
              )}

              <Button 
                variant="outline" 
                onClick={() => setIsEditing(true)}
                data-testid="sheet-button-edit"
              >
                Edit Details
              </Button>
            </div>
          )}

          <Separator />

          <div className="pt-2">
            <Button
              variant="destructive"
              size="sm"
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
    </Sheet>
  );
}
