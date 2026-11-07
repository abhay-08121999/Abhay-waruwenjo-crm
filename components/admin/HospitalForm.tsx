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

const hospitalSchema = z.object({
  name: z.string().min(1, "Name is required"),
  city: z.string().min(1, "City is required"),
  address: z.string().min(1, "Address is required"),
  description: z.string().optional(),
  accreditation: z.string().optional(),
  contact_email: z.string().email().optional().or(z.literal("")),
  contact_phone: z.string().optional(),
  image_url: z.string().optional(),
  is_active: z.boolean().default(true),
});

type HospitalFormValues = z.infer<typeof hospitalSchema>;

interface HospitalFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hospital?: any;
  onSuccess: () => void;
}

export function HospitalForm({ open, onOpenChange, hospital, onSuccess }: HospitalFormProps) {
  const [loading, setLoading] = useState(false);
  const isEdit = !!hospital;

  const form = useForm<HospitalFormValues>({
    resolver: zodResolver(hospitalSchema),
    defaultValues: {
      name: hospital?.name || "",
      city: hospital?.city || "",
      address: hospital?.address || "",
      description: hospital?.description || "",
      accreditation: hospital?.accreditation || "",
      contact_email: hospital?.contact_email || "",
      contact_phone: hospital?.contact_phone || "",
      image_url: hospital?.image_url || "",
      is_active: hospital?.is_active ?? true,
    },
  });

  const onSubmit = async (values: HospitalFormValues) => {
    setLoading(true);
    try {
      const data = {
        name: values.name,
        city: values.city,
        address: values.address,
        description: values.description || null,
        accreditation: values.accreditation || null,
        contact_email: values.contact_email || null,
        contact_phone: values.contact_phone || null,
        image_url: values.image_url || null,
        is_active: values.is_active,
      };

      if (isEdit) {
        const { error } = await supabase
          .from("hospitals")
          .update(data)
          .eq("id", hospital.id);

        if (error) throw error;
        toast.success("Hospital updated successfully");
      } else {
        const { error } = await supabase
          .from("hospitals")
          .insert([data]);

        if (error) throw error;
        toast.success("Hospital added successfully");
      }

      onSuccess();
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      toast.error(error.message || "Failed to save hospital");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Hospital" : "Add New Hospital"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update hospital information" : "Add a new hospital to the platform"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="City General Hospital" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="Mumbai" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="accreditation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Accreditation</FormLabel>
                    <FormControl>
                      <Input placeholder="JCI, NABH" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input placeholder="123 Main Street" {...field} />
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
                    <Textarea placeholder="Hospital description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contact_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="info@hospital.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+918035966149" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="image_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4 bg-teal-50/50 border-teal-100">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base text-teal-900">Visible on Website</FormLabel>
                    <p className="text-xs text-teal-600 font-medium">Approve this facility to show it in the public directory.</p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
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
