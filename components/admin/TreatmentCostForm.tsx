import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const treatmentCostSchema = z.object({
  treatment_name: z.string().min(1, "Treatment name is required"),
  base_cost: z.number().min(0, "Base cost must be positive"),
  duration_days: z.number().min(0).optional(),
  description: z.string().optional(),
});

type TreatmentCostFormValues = z.infer<typeof treatmentCostSchema>;

interface TreatmentCostFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  treatment?: any;
  onSuccess: () => void;
}

export function TreatmentCostForm({ open, onOpenChange, treatment, onSuccess }: TreatmentCostFormProps) {
  const [loading, setLoading] = useState(false);
  const isEdit = !!treatment;

  const form = useForm<TreatmentCostFormValues>({
    resolver: zodResolver(treatmentCostSchema),
    defaultValues: {
      treatment_name: treatment?.treatment_name || "",
      base_cost: treatment?.base_cost || 0,
      duration_days: treatment?.duration_days || undefined,
      description: treatment?.description || "",
    },
  });

  const onSubmit = async (values: TreatmentCostFormValues) => {
    setLoading(true);
    try {
      const data = {
        treatment_name: values.treatment_name,
        base_cost: values.base_cost,
        duration_days: values.duration_days || null,
        description: values.description || null,
      };

      if (isEdit) {
        const { error } = await supabase
          .from("treatment_costs")
          .update(data)
          .eq("id", treatment.id);
        
        if (error) throw error;
        toast.success("Treatment cost updated successfully");
      } else {
        const { error } = await supabase
          .from("treatment_costs")
          .insert([data]);
        
        if (error) throw error;
        toast.success("Treatment cost added successfully");
      }

      onSuccess();
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      toast.error(error.message || "Failed to save treatment cost");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Treatment Cost" : "Add New Treatment Cost"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update treatment pricing information" : "Add a new treatment pricing option"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="treatment_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Treatment Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Cardiac Surgery" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="base_cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base Cost ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="5000"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="duration_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (Days)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="7"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Treatment description and what it includes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : isEdit ? "Update" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
