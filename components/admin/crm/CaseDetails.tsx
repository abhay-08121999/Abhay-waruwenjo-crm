
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, Paperclip, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MedicalCase, CaseNote } from "@/types/crm";
import { fetchMedicalCases, fetchCaseNotes, createCaseNote, updateMedicalCaseStatus, supabase } from "@/services/supabase";

interface CaseDetailsProps {
    caseId: string;
    onBack: () => void;
}

export const CaseDetails = ({ caseId, onBack }: CaseDetailsProps) => {
    const [caseData, setCaseData] = useState<MedicalCase | null>(null);
    const [notes, setNotes] = useState<CaseNote[]>([]);
    const [newNote, setNewNote] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        loadCaseInfo();
    }, [caseId]);

    const loadCaseInfo = async () => {
        setLoading(true);
        try {
            const { data: cases } = await fetchMedicalCases();
            const foundCase = cases?.find((c: any) => c.id === caseId);

            if (!foundCase) {
                toast.error("Case not found");
                onBack();
                return;
            }

            setCaseData(foundCase);
            const notesData = await fetchCaseNotes(caseId);
            if (notesData?.data) setNotes(notesData.data);
        } catch (error) {
            toast.error("Failed to load case details");
        } finally {
            setLoading(false);
        }
    };

    const handleSendNote = async () => {
        if (!newNote.trim()) return;
        setSending(true);

        const { data: { user } } = await supabase.auth.getUser();

        const { error } = await createCaseNote({
            case_id: caseId,
            author_id: user?.id,
            content: newNote,
            is_internal: isInternal
        });

        if (error) {
            toast.error("Failed to add note");
        } else {
            setNewNote("");
            setIsInternal(false);
            const notesData = await fetchCaseNotes(caseId);
            if (notesData?.data) setNotes(notesData.data);
        }
        setSending(false);
    };

    const updateStatus = async (newStatus: string) => {
        const { error } = await updateMedicalCaseStatus(caseId, newStatus);

        if (error) {
            toast.error("Failed to update status");
        } else {
            // Sync with Patient Journey
            await syncWithJourney(newStatus);
            toast.success("Status updated and synced with journey");
            loadCaseInfo();
        }
    };

    const syncWithJourney = async (status: string) => {
        if (!caseData?.patient_id) return;

        // Map medical_case status to journey_stage
        const stageMap: Record<string, any> = {
            'visa': 'visa_process',
            'travel': 'travel',
            'treatment': 'treatment',
            'payment': 'payment',
            'post_op': 'post_op',
            'closed': 'follow_up'
        };

        const journeyStage = stageMap[status];
        if (!journeyStage) return;

        const { data: existingJourney } = await supabase
            .from("patient_journey")
            .select("id")
            .eq("user_id", caseData.patient_id)
            .maybeSingle();

        if (existingJourney) {
            await supabase
                .from("patient_journey")
                .update({
                    current_stage: journeyStage,
                    [`${status}_complete`]: true
                } as any)
                .eq("id", existingJourney.id);
        } else {
            await supabase
                .from("patient_journey")
                .insert({
                    user_id: caseData.patient_id,
                    current_stage: journeyStage,
                    [`${status}_complete`]: true
                } as any);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
        </div>
    );
    if (!caseData) return <div>Case not found</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onBack} className="hover:bg-slate-100 rounded-xl">
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">{caseData.title}</h2>
                    <p className="text-sm font-medium text-slate-500">Patient: {caseData.patient?.full_name}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <Select value={caseData.status} onValueChange={updateStatus}>
                        <SelectTrigger className="w-[200px] border-slate-200 rounded-xl font-bold text-xs uppercase tracking-widest">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            {['lead', 'contacted', 'documents_collected', 'medical_review', 'plan_proposed', 'visa', 'travel', 'treatment', 'post_op', 'closed'].map(s => (
                                <SelectItem key={s} value={s} className="capitalize text-xs font-bold">{s.replace('_', ' ')}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Main Timeline/Chat */}
                <Card className="xl:col-span-2 h-[600px] flex flex-col border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Case Evolution Timeline</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col overflow-hidden p-6">
                        <ScrollArea className="flex-1 pr-4">
                            <div className="space-y-6">
                                {notes.map((note) => (
                                    <div key={note.id} className={`flex flex-col ${note.is_internal ? 'opacity-80' : ''}`}>
                                        <div className="flex justify-between items-center mb-2 px-1">
                                            <span className="font-black text-[10px] uppercase tracking-wider text-indigo-600">
                                                {note.author?.full_name || "System Monitor"}
                                                {note.is_internal && <span className="ml-2 text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">INTERNAL</span>}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400">{new Date(note.created_at).toLocaleString()}</span>
                                        </div>
                                        <div className={`p-5 rounded-3xl text-sm font-medium leading-relaxed ${note.is_internal ? 'bg-amber-50 border border-amber-100/50 text-slate-700' : 'bg-slate-50 border border-slate-100 text-slate-600'
                                            }`}>
                                            {note.content}
                                        </div>
                                    </div>
                                ))}
                                {notes.length === 0 && (
                                    <div className="py-20 text-center opacity-20">
                                        <Send size={48} className="mx-auto mb-4" />
                                        <p className="text-sm font-bold uppercase tracking-widest">Timeline established. No entries yet.</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                        <div className="mt-6 flex gap-3 bg-slate-50 p-4 rounded-[2rem] border border-slate-100">
                            <Textarea
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                placeholder="Log progress or internal observations..."
                                className="min-h-[80px] bg-white border-slate-200 rounded-2xl text-sm focus:ring-8 focus:ring-indigo-500/5 resize-none"
                            />
                            <div className="flex flex-col gap-2">
                                <Button
                                    size="icon"
                                    onClick={handleSendNote}
                                    disabled={sending}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-lg shadow-indigo-500/20"
                                >
                                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </Button>
                                <Button size="icon" variant="outline" className="rounded-2xl border-slate-200 text-slate-400">
                                    <Paperclip className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Sidebar Info */}
                <div className="space-y-6">
                    <Card className="border-slate-200 rounded-[2.5rem] shadow-sm">
                        <CardHeader className="p-6 pb-2">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Patient Intelligence</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Direct Contact</p>
                                <p className="text-sm font-bold text-slate-700">{caseData.patient?.email}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Mobile</p>
                                <p className="text-sm font-bold text-slate-700">{caseData.patient?.phone || "Private"}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Origin</p>
                                <p className="text-sm font-bold text-slate-700">{caseData.patient?.country || "Earth"}</p>
                            </div>
                            <Separator className="bg-slate-100 my-2" />
                            <Button variant="outline" className="w-full rounded-2xl border-slate-200 text-xs font-black uppercase tracking-widest text-slate-600 py-6">
                                Full Patient Profile
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200 rounded-[2.5rem] shadow-sm bg-indigo-50/30">
                        <CardHeader className="p-6 pb-2">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resource Vault</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="text-center py-6 opacity-40">
                                <Paperclip size={32} className="mx-auto mb-2 text-indigo-400" />
                                <p className="text-[10px] font-bold uppercase tracking-widest">No attachments</p>
                            </div>
                            <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest py-6 mt-4">
                                Attach Record
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
