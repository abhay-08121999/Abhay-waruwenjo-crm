
import React, { useState, useEffect } from 'react';
import { MOCK_LEADS } from '../constants.tsx';
import { generateLeadInsights, generatePipelineSummary } from '../services/geminiService.ts';
import { Sparkles, BrainCircuit, Lightbulb, AlertTriangle, Send, Loader2 } from 'lucide-react';

const AIInsights: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [pipelineSummary, setPipelineSummary] = useState<string>('');
  const [selectedLead, setSelectedLead] = useState(MOCK_LEADS[0]);
  const [leadInsights, setLeadInsights] = useState<any>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      const summary = await generatePipelineSummary(MOCK_LEADS);
      setPipelineSummary(summary || "Unable to load summary.");
      
      const insights = await generateLeadInsights(selectedLead);
      setLeadInsights(insights);
      setLoading(false);
    };
    fetchSummary();
  }, [selectedLead]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
          <Sparkles size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Gemini AI Sales Co-Pilot</h2>
          <p className="text-slate-500 text-sm">Actionable intelligence for your sales pipeline.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 rounded-2xl text-white shadow-lg">
            <h3 className="flex items-center gap-2 font-semibold mb-4">
              <BrainCircuit size={20} />
              Strategic Pipeline Analysis
            </h3>
            {loading ? (
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="animate-spin" size={20} />
                <span className="text-indigo-100">Analyzing pipeline data...</span>
              </div>
            ) : (
              <div className="prose prose-invert prose-sm max-w-none">
                <p className="text-indigo-50 leading-relaxed italic">
                  "{pipelineSummary}"
                </p>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-slate-800">Smart Lead Breakdown</h3>
              <select 
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                value={selectedLead.id}
                onChange={(e) => setSelectedLead(MOCK_LEADS.find(l => l.id === e.target.value) || MOCK_LEADS[0])}
              >
                {MOCK_LEADS.map(lead => (
                  <option key={lead.id} value={lead.id}>{lead.name} - {lead.company}</option>
                ))}
              </select>
            </div>

            {leadInsights ? (
              <div className="space-y-6">
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {leadInsights.summary}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border border-green-100 bg-green-50 rounded-xl">
                    <h4 className="flex items-center gap-2 text-green-700 font-bold text-sm mb-3">
                      <Lightbulb size={16} /> Opportunities
                    </h4>
                    <ul className="space-y-2">
                      {leadInsights.opportunities.map((item: string, i: number) => (
                        <li key={i} className="text-xs text-green-800 flex items-start gap-2">
                          <span className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-green-500"></span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 border border-amber-100 bg-amber-50 rounded-xl">
                    <h4 className="flex items-center gap-2 text-amber-700 font-bold text-sm mb-3">
                      <AlertTriangle size={16} /> Key Risks
                    </h4>
                    <ul className="space-y-2">
                      {leadInsights.risks.map((item: string, i: number) => (
                        <li key={i} className="text-xs text-amber-800 flex items-start gap-2">
                          <span className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h4 className="font-bold text-slate-800 text-sm mb-3">AI Drafted Follow-up</h4>
                  <div className="relative">
                    <pre className="p-4 bg-slate-900 text-indigo-300 rounded-xl text-xs whitespace-pre-wrap font-mono leading-normal">
                      {leadInsights.followUpTemplate}
                    </pre>
                    <button className="absolute bottom-2 right-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md">
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="animate-spin text-indigo-600 mb-4" size={32} />
                <p className="text-slate-500">Deep diving into lead history...</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4">Recommended Actions</h3>
            <div className="space-y-4">
              {[
                { title: 'Urgent Follow-up', desc: 'John Doe proposal expires in 2 days', urgency: 'high' },
                { title: 'Re-engagement', desc: 'Sarah hasn\'t replied in 72 hours', urgency: 'medium' },
                { title: 'New Opportunity', desc: 'Identify stakeholders at Mega Retail', urgency: 'low' },
              ].map((action, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                    action.urgency === 'high' ? 'bg-red-500' : action.urgency === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                  }`}></div>
                  <div>
                    <h5 className="text-sm font-semibold text-slate-800 leading-none">{action.title}</h5>
                    <p className="text-xs text-slate-500 mt-1">{action.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
            <h3 className="font-bold text-indigo-900 mb-2">Pro Tip</h3>
            <p className="text-sm text-indigo-700">
              Leads contacted within 5 minutes of inquiry are 9x more likely to convert. Use the automated greeting tool!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIInsights;
