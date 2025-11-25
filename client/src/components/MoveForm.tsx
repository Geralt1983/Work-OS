import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import type { Client } from "@shared/schema";
import { EFFORT_LEVELS, DRAIN_TYPES, MOVE_STATUSES } from "@shared/schema";

const moveFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  clientId: z.string().optional(),
  status: z.enum(MOVE_STATUSES),
  effortEstimate: z.number().min(1).max(4),
  drainType: z.string().optional(),
});

type MoveFormValues = z.infer<typeof moveFormSchema>;

interface MoveFormProps {
  clients: Client[];
  onSuccess: () => void;
  defaultValues?: Partial<MoveFormValues>;
}

export default function MoveForm({ clients, onSuccess, defaultValues }: MoveFormProps) {
  const form = useForm<MoveFormValues>({
    resolver: zodResolver(moveFormSchema),
    defaultValues: {
      title: "",
      description: "",
      clientId: "none",
      status: "backlog",
      effortEstimate: 2,
      drainType: "none",
      ...defaultValues,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: MoveFormValues) => {
      const payload = {
        ...values,
        clientId: values.clientId && values.clientId !== "none" ? parseInt(values.clientId) : null,
        drainType: values.drainType && values.drainType !== "none" ? values.drainType : null,
      };
      await apiRequest("POST", "/api/moves", payload);
    },
    onSuccess: () => {
      form.reset();
      onSuccess();
    },
  });

  const onSubmit = (values: MoveFormValues) => {
    createMutation.mutate(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input 
                  placeholder="What needs to be done?" 
                  {...field} 
                  data-testid="input-move-title"
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
              <FormLabel>Description (optional)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Add more details..." 
                  className="resize-none"
                  {...field} 
                  data-testid="input-move-description"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="clientId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-move-client">
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">No client</SelectItem>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id.toString()}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-move-status">
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
        </div>

        <div className="grid grid-cols-2 gap-4">
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
                    <SelectTrigger data-testid="select-move-effort">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {EFFORT_LEVELS.map(level => (
                      <SelectItem key={level.value} value={level.value.toString()}>
                        {level.label} ({level.description})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="drainType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Drain Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-move-drain">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {DRAIN_TYPES.map(type => (
                      <SelectItem key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button 
            type="submit" 
            disabled={createMutation.isPending}
            data-testid="button-submit-move"
          >
            {createMutation.isPending ? "Creating..." : "Create Move"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
