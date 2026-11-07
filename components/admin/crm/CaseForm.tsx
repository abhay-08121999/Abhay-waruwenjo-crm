
import { useState, useEffect } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CaseStatus, CasePriority } from "@/types/crm";
import { createMedicalCase, createCaseNote, fetchProfiles, fetchUsersByRole } from "@/services/supabase";

const caseSchema = z.object({
    patient_id: z.string().min(1, "Patient is required"),
    title: z.string().min(1, "Title is required"),
    status: z.string().min(1, "Status is required"),
    priority: z.string().min(1, "Priority is required"),
    assigned_bdm_id: z.string().optional(),
    assigned_cdm_id: z.string().optional(),
    assigned_buddy_id: z.string().optional(),
    initial_note: z.string().optional(),
});

type CaseFormValues = z.infer<typeof caseSchema>;

interface CaseFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function CaseForm({ open, onOpenChange, onSuccess }: CaseFormProps) {
    const [loading, setLoading] = useState(false);
    const [patients, setPatients] = useState<any[]>([]);
    const [bdms, setBdms] = useState<any[]>([]);
    const [cdms, setCdms] = useState<any[]>([]);
    const [buddies, setBuddies] = useState<any[]>([]);

    const form = useForm<CaseFormValues>({
        resolver: zodResolver(caseSchema),
        defaultValues: {
            patient_id: "",
            title: "",
            status: "lead",
            priority: "medium",
            assigned_bdm_id: "",
            assigned_cdm_id: "",
            assigned_buddy_id: "",
            initial_note: "",
        },
    });

    useEffect(() => {
        if (open) {
            loadFormOptions();
        }
    }, [open]);

    const loadFormOptions = async () => {
        const [profiles, b, c, buds] = await Promise.all([
            fetchProfiles(),
            fetchUsersByRole('bdm'),
            fetchUsersByRole('cdm'),
            fetchUsersByRole('waru_buddy')
        ]);
        if (profiles) setPatients(profiles);
        setBdms(b);
        setCdms(c);
        setBuddies(buds);
    };


    const onSubmit = async (values: CaseFormValues) => {
        setLoading(true);
        try {
            // 1. Create the case
            const { data: newCase, error: caseError } = await createMedicalCase({
                patient_id: values.patient_id,
                title: values.title,
                status: values.status as CaseStatus,
                priority: values.priority as CasePriority,
                assigned_bdm_id: values.assigned_bdm_id || null,
                assigned_cdm_id: values.assigned_cdm_id || null,
                assigned_buddy_id: values.assigned_buddy_id || null,
            } as any);

            if (caseError) throw caseError;

            // 2. Add initial note if provided
            if (values.initial_note?.trim() && newCase) {
                const { data: { user } } = await supabase.auth.getUser();
                await createCaseNote({
                    case_id: (newCase as any).id,
                    author_id: user?.id,
                    content: values.initial_note,
                } as any);
            }


            toast.success("Medical case created successfully");
            onSuccess();
            onOpenChange(false);
            form.reset();
        } catch (error: any) {
            toast.error(error.message || "Failed to create case");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Create New Medical Case</DialogTitle>
                    <DialogDescription>
                        Open a new case for a patient and track their journey.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="patient_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Patient</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a patient" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {patients.map((p) => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    {p.full_name} ({p.email})
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
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Case Title</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., Cardiac Surgery Consultation" {...field} />
                                    </FormControl>
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
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Status" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {['lead', 'contacted', 'documents_collected', 'medical_review', 'plan_proposed'].map(s => (
                                                    <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="priority"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Priority</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Priority" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="low">Low</SelectItem>
                                                <SelectItem value="medium">Medium</SelectItem>
                                                <SelectItem value="high">High</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Operational Assignments</h4>
                             <div className="grid grid-cols-3 gap-3">
                                <FormField
                                    control={form.control}
                                    name="assigned_bdm_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[9px]">BDM</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="BDM" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                                    {bdms.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="assigned_cdm_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[9px]">CDM</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="CDM" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                                    {cdms.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="assigned_buddy_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[9px]">Buddy</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Buddy" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                                    {buddies.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                             </div>
                        </div>

                        <FormField
                            control={form.control}
                            name="initial_note"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Initial Note</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Add internal details or requirements..." {...field} />
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
                                {loading ? "Creating..." : "Create Case"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
