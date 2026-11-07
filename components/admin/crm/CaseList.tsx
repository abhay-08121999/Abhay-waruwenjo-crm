
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { MedicalCase } from "@/types/crm";

interface CaseListProps {
    cases: MedicalCase[];
    onViewCase: (caseId: string) => void;
}

export const CaseList = ({ cases, onViewCase }: CaseListProps) => {
    return (
        <div className="rounded-[2.5rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
            <Table>
                <TableHeader className="bg-slate-50/50">
                    <TableRow className="hover:bg-transparent border-slate-100">
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 h-16 px-8">Patient Intelligence</TableHead>
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 h-16">Medical Focus</TableHead>
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 h-16">Operational Status</TableHead>
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 h-16">Priority Level</TableHead>
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 h-16">Timeline</TableHead>
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 h-16 px-8 text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {cases.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center py-32 text-slate-400 font-bold uppercase tracking-widest text-[10px] opacity-30">
                                No active medical cases in pipeline.
                            </TableCell>
                        </TableRow>
                    ) : (
                        cases.map((c) => (
                            <TableRow key={c.id} className="group hover:bg-slate-50/50 border-slate-100 transition-colors">
                                <TableCell className="px-8 py-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xs uppercase">
                                            {c.patient?.full_name?.charAt(0) || "U"}
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-slate-800 leading-tight mb-0.5">{c.patient?.full_name || "Unknown Identity"}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{c.patient?.email}</p>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <p className="text-sm font-bold text-slate-600">{c.title}</p>
                                </TableCell>
                                <TableCell>
                                    <div className="inline-flex items-center px-3 py-1 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 text-[9px] font-black uppercase tracking-widest">
                                        {c.status.replace('_', ' ')}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className={`inline-flex items-center px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${c.priority === 'high' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                            c.priority === 'medium' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                'bg-teal-50 text-teal-600 border-teal-100'
                                        }`}>
                                        {c.priority} Priority
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(c.created_at).toLocaleDateString()}</p>
                                </TableCell>
                                <TableCell className="px-8 text-right">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => onViewCase(c.id)}
                                        className="rounded-xl hover:bg-indigo-50 hover:text-indigo-600 text-slate-400 transition-all font-black uppercase text-[10px] tracking-widest gap-2"
                                    >
                                        <Eye className="w-4 h-4" />
                                        Examine
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
};
