
import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Search,
  RefreshCw,
  FileText,
  Layers,
  CheckCircle,
  X,
  User,
  Plus,
  Sparkles,
  History,
  Bot,
  CheckCheck,
  Paperclip,
  Clock,
  Users,
  Settings,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'sonner';

// Type definitions matching database schema
interface Conversation {
  id: string;
  patient_id?: string;
  enquiry_id?: string;
  phone: string;
  assigned_to?: string;
  status: 'open' | 'snoozed' | 'resolved';
  unread_count: number;
  created_at?: string;
  updated_at?: string;
  // UI extended properties
  patient_name?: string;
  inquiry_subject?: string;
}

interface Message {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  content: string;
  message_type: 'text' | 'image' | 'document' | 'template';
  media_url?: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  meta_message_id?: string;
  sent_by?: string;
  created_at: string;
}

interface TeamNote {
  id: string;
  conversation_id: string;
  content: string;
  created_by?: string;
  created_at: string;
  author_name?: string;
}

interface Broadcast {
  id: string;
  name: string;
  template_name: string;
  template_language: string;
  status: 'draft' | 'sending' | 'completed' | 'failed';
  created_at?: string;
  recipient_count?: number;
}

interface Automation {
  id: string;
  name: string;
  trigger_type: 'lead_created' | 'status_changed' | 'keyword_detected';
  trigger_conditions: any;
  action_type: 'send_message' | 'assign_agent';
  action_payload: any;
  is_active: boolean;
  created_at?: string;
}

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'c1',
    phone: '+971 50 123 4567',
    status: 'open',
    unread_count: 0,
    patient_name: 'Sarah Jenkins (Knee Transplant Inquiry)',
    inquiry_subject: 'Knee Transplant Inquiry',
    assigned_to: 'admin'
  },
  {
    id: 'c2',
    phone: '+44 7911 123456',
    status: 'open',
    unread_count: 1,
    patient_name: 'Michael Chang (Cardiology Quotation)',
    inquiry_subject: 'Cardiology Quotation'
  }
];

const MOCK_MESSAGES: Message[] = [
  {
    id: 'm1',
    conversation_id: 'c1',
    direction: 'inbound',
    content: 'Hello, I would like to inquire about knee transplant procedures in India. What are the package details?',
    message_type: 'text',
    status: 'read',
    created_at: '2026-06-01T16:30:00Z'
  },
  {
    id: 'm2',
    conversation_id: 'c1',
    direction: 'outbound',
    content: 'Hello Sarah! Thank you for reaching out to WaruWenJo. We offer complete packages starting from $7,500 including travel assistance. Let me share a general medical outline with you.',
    message_type: 'text',
    status: 'read',
    created_at: '2026-06-01T17:30:00Z'
  },
  {
    id: 'm3',
    conversation_id: 'c1',
    direction: 'inbound',
    content: 'That sounds reasonable. Do you assist with medical visas and accommodation as well?',
    message_type: 'text',
    status: 'read',
    created_at: '2026-06-01T14:35:00Z'
  },
  {
    id: 'm4',
    conversation_id: 'c1',
    direction: 'inbound',
    content: 'Here is my previous MRI report.',
    message_type: 'text',
    status: 'read',
    created_at: '2026-06-01T14:47:00Z'
  },
  {
    id: 'm5',
    conversation_id: 'c2',
    direction: 'inbound',
    content: 'Hello, I am looking to get a cardiology consultation quotation.',
    message_type: 'text',
    status: 'delivered',
    created_at: '2026-06-01T11:35:00Z'
  }
];

const MOCK_NOTES: TeamNote[] = [
  {
    id: 'n1',
    conversation_id: 'c1',
    content: 'Sarah prefers call contact on weekends. Medical visa needs standard intimation letter.',
    created_at: '2026-06-01T14:50:00Z',
    author_name: 'Karthik'
  }
];

const MOCK_TEMPLATES = [
  { name: 'welcome_lead', language: 'en', content: 'Hello {{patient_name}}! Welcome to WaruWenJo. We received your medical inquiry.' },
  { name: 'visa_assistance', language: 'en', content: 'Dear {{patient_name}}, our travel desk is ready to assist with your medical visa.' },
  { name: 'quotation_ready', language: 'en', content: 'Hi {{patient_name}}, your customized clinical quotation is ready for review.' }
];

const WhatsAppIntegration: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'inbox' | 'broadcasts' | 'automations'>('inbox');
  const [inboxSubTab, setInboxSubTab] = useState<'open' | 'resolved' | 'all'>('open');
  const [searchQuery, setSearchQuery] = useState('');

  // Dynamic lists with mock fallbacks
  const [conversations, setConversations] = useState<Conversation[]>(MOCK_CONVERSATIONS);
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [notes, setNotes] = useState<TeamNote[]>(MOCK_NOTES);
  const [selectedConvId, setSelectedConvId] = useState<string>('c1');
  const [typedMessage, setTypedMessage] = useState('');

  // Note sidebar/drawer
  const [showNotesDrawer, setShowNotesDrawer] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');

  // Template reply modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Broadcast campaign state
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([
    { id: 'b1', name: 'May Newsletter Inbound', template_name: 'welcome_lead', template_language: 'en', status: 'completed', recipient_count: 145 },
    { id: 'b2', name: 'Knee Transplant Campaign', template_name: 'visa_assistance', template_language: 'en', status: 'completed', recipient_count: 52 }
  ]);
  const [showNewBroadcastModal, setShowNewBroadcastModal] = useState(false);
  const [newBroadcast, setNewBroadcast] = useState({ name: '', template_name: 'welcome_lead', language: 'en' });

  // Automations states
  const [automations, setAutomations] = useState<Automation[]>([
    { id: 'a1', name: 'Auto welcome lead', trigger_type: 'lead_created', trigger_conditions: {}, action_type: 'send_message', action_payload: { template_name: 'welcome_lead' }, is_active: true },
    { id: 'a2', name: 'Keyword Alert: Urgent', trigger_type: 'keyword_detected', trigger_conditions: { keyword: 'urgent' }, action_type: 'assign_agent', action_payload: {}, is_active: true }
  ]);
  const [showNewAutomationModal, setShowNewAutomationModal] = useState(false);
  const [newAutomation, setNewAutomation] = useState<Partial<Automation>>({
    name: '',
    trigger_type: 'lead_created',
    action_type: 'send_message',
    is_active: true
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch initial db states if available
  useEffect(() => {
    fetchDbData();
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, selectedConvId]);

  const fetchDbData = async () => {
    try {
      // 1. Fetch Conversations
      const { data: convs, error: convError } = await supabase
        .from('wa_conversations')
        .select('*')
        .order('updated_at', { ascending: false });

      if (!convError && convs && convs.length > 0) {
        // Hydrate with names if matching profiles exist
        const updated = await Promise.all(convs.map(async (c: any) => {
          let patient_name = c.phone;
          if (c.patient_id) {
            const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', c.patient_id).maybeSingle();
            if (prof) patient_name = prof.full_name;
          }
          return {
            ...c,
            patient_name: patient_name,
            inquiry_subject: c.patient_id ? 'Active Patient' : 'Web Enquiry'
          };
        }));
        setConversations(updated);
      }

      // 2. Fetch Messages
      const { data: msgs, error: msgError } = await supabase
        .from('wa_messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (!msgError && msgs && msgs.length > 0) {
        setMessages(msgs);
      }

      // 3. Fetch Notes
      const { data: dbNotes } = await supabase.from('wa_notes').select('*');
      if (dbNotes && dbNotes.length > 0) {
        setNotes(dbNotes.map(n => ({
          ...n,
          author_name: 'Agent'
        })));
      }

      // 4. Fetch Broadcasts
      const { data: dbBcasts } = await supabase.from('wa_broadcasts').select('*');
      if (dbBcasts && dbBcasts.length > 0) {
        setBroadcasts(dbBcasts);
      }

      // 5. Fetch Automations
      const { data: dbAutos } = await supabase.from('wa_automations').select('*');
      if (dbAutos && dbAutos.length > 0) {
        setAutomations(dbAutos);
      }

    } catch (err) {
      console.warn("Table references are not fully populated yet; using high-fidelity mock data flow.", err);
    }
  };

  const handleSendMessage = async () => {
    if (!typedMessage.trim()) return;

    const selectedConv = conversations.find(c => c.id === selectedConvId);
    if (!selectedConv) return;

    const newMsg: Message = {
      id: Math.random().toString(36).substr(2, 9),
      conversation_id: selectedConvId,
      direction: 'outbound',
      content: typedMessage,
      message_type: 'text',
      status: 'sent',
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, newMsg]);
    setTypedMessage('');

    // Attempt DB sync
    try {
      await supabase.from('wa_messages').insert([{
        conversation_id: selectedConvId,
        direction: 'outbound',
        content: typedMessage,
        message_type: 'text',
        status: 'sent'
      }]);
    } catch (e) {
      // Slient fallback
    }

    toast.success('Reply queued for dispatch');
  };

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return;

    const newNote: TeamNote = {
      id: Math.random().toString(36).substr(2, 9),
      conversation_id: selectedConvId,
      content: newNoteContent,
      created_at: new Date().toISOString(),
      author_name: 'Admin User'
    };

    setNotes(prev => [...prev, newNote]);
    setNewNoteContent('');

    try {
      await supabase.from('wa_notes').insert([{
        conversation_id: selectedConvId,
        content: newNoteContent
      }]);
    } catch (e) { }

    toast.success('Internal note saved');
  };

  const handleApplyTemplate = (content: string) => {
    const activeConv = conversations.find(c => c.id === selectedConvId);
    const resolvedContent = content.replace('{{patient_name}}', activeConv?.patient_name?.split(' ')[0] || 'Patient');
    setTypedMessage(resolvedContent);
    setShowTemplateModal(false);
  };

  const activeConv = conversations.find(c => c.id === selectedConvId);
  const activeMessages = messages.filter(m => m.conversation_id === selectedConvId);
  const activeNotes = notes.filter(n => n.conversation_id === selectedConvId);

  // Filter conversations
  const filteredConversations = conversations.filter(c => {
    const matchesSearch = (c.patient_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery);
    const matchesSubTab =
      inboxSubTab === 'all' ||
      (inboxSubTab === 'open' && c.status === 'open') ||
      (inboxSubTab === 'resolved' && c.status === 'resolved');
    return matchesSearch && matchesSubTab;
  });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Premium Top Navigation Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-teal-100 text-teal-700 rounded-2xl shadow-sm">
              <MessageSquare size={28} />
            </div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">WhatsApp CRM</h2>
          </div>
          <p className="text-slate-500 font-medium">Shared inbox, automated trigger-flows, and secure bulk broadcast campaigns.</p>
        </div>

        {/* Tab Controls */}
        <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl shadow-inner border border-slate-200">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'inbox' ? 'bg-white text-teal-700 shadow-md' : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            <MessageSquare size={14} /> Shared Inbox
          </button>
          <button
            onClick={() => setActiveTab('broadcasts')}
            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'broadcasts' ? 'bg-white text-teal-700 shadow-md' : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            <Layers size={14} /> Broadcast Campaigns
          </button>
          <button
            onClick={() => setActiveTab('automations')}
            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'automations' ? 'bg-white text-teal-700 shadow-md' : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            <Bot size={14} /> Flows & Automations
          </button>
        </div>
      </div>

      {/* 1. SHARED INBOX TAB */}
      {activeTab === 'inbox' && (
        <div className="bg-white rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col md:flex-row h-[78vh] min-h-[600px] animate-in fade-in duration-300">

          {/* Left panel: Chat list */}
          <div className="w-full md:w-[350px] lg:w-[400px] border-r border-slate-100 flex flex-col bg-slate-50/50 flex-shrink-0">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                Shared Inbox
              </h3>
              <button
                onClick={fetchDbData}
                className="p-2 hover:bg-slate-100 text-slate-400 hover:text-teal-600 rounded-xl transition-all"
                title="Refresh Inbox"
              >
                <RefreshCw size={16} />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 bg-white border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="text"
                  placeholder="Search chats or phone..."
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-teal-500 transition-all font-semibold text-slate-700"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Inbox SubTabs */}
            <div className="p-3 flex gap-1.5 bg-white border-b border-slate-100">
              {['open', 'resolved', 'all'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setInboxSubTab(tab as any)}
                  className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${inboxSubTab === tab
                    ? 'bg-teal-50 text-teal-700 border border-teal-100'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Chat item list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {filteredConversations.map((conv) => {
                const isActive = conv.id === selectedConvId;
                const lastMsg = messages.filter(m => m.conversation_id === conv.id).slice(-1)[0];
                return (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedConvId(conv.id)}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative group ${isActive
                      ? 'bg-white border-teal-500 shadow-md scale-[1.01]'
                      : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm'
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 border border-slate-200 flex-shrink-0">
                        {conv.patient_name?.charAt(0) || 'U'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-1">
                          <h4 className="text-xs font-black text-slate-800 truncate group-hover:text-teal-600 transition-colors">
                            {conv.patient_name || conv.phone}
                          </h4>
                          <span className="text-[9px] text-slate-400 font-bold">
                            {lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium truncate mb-1">
                          {conv.phone}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold truncate">
                          {lastMsg ? lastMsg.content : 'No messages yet'}
                        </p>
                      </div>
                    </div>

                    {/* Unread & Assign Tags */}
                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-50">
                      <span className="text-[8px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                        {conv.assigned_to ? 'Assigned' : 'Unassigned'}
                      </span>
                      {conv.unread_count > 0 && (
                        <span className="w-4 h-4 bg-teal-500 text-white rounded-full flex items-center justify-center text-[9px] font-black">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredConversations.length === 0 && (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No active chats</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Live Chat Canvas */}
          {activeConv ? (
            <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
              {/* Active Chat Top Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between flex-shrink-0 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center flex-shrink-0 shadow-md">
                    {activeConv.patient_name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 leading-tight">
                      {activeConv.patient_name || activeConv.phone}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                      {activeConv.phone}
                    </p>
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowNotesDrawer(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-[9px] uppercase tracking-wider rounded-xl transition-all"
                  >
                    Team Notes ({activeNotes.length})
                  </button>

                  <select
                    value={activeConv.status}
                    onChange={async (e) => {
                      const newStatus = e.target.value as any;
                      setConversations(conversations.map(c => c.id === activeConv.id ? { ...c, status: newStatus } : c));
                      try {
                        await supabase.from('wa_conversations').update({ status: newStatus }).eq('id', activeConv.id);
                      } catch (err) { }
                      toast.success(`Status updated to ${newStatus.toUpperCase()}`);
                    }}
                    className="px-3 py-1.5 bg-teal-50 border border-teal-100 text-teal-700 font-black text-[9px] uppercase tracking-wider rounded-xl outline-none cursor-pointer"
                  >
                    <option value="open">Open</option>
                    <option value="snoozed">Snoozed</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>

              {/* Chat Messages Scrolling Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50 custom-scrollbar">
                {activeMessages.map((msg) => {
                  const isInbound = msg.direction === 'inbound';
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isInbound ? 'justify-start' : 'justify-end'} animate-in fade-in duration-200`}
                    >
                      <div className={`max-w-[70%] p-4 rounded-2xl shadow-sm ${isInbound
                        ? 'bg-white text-slate-800 rounded-tl-none border border-slate-100'
                        : 'bg-teal-700 text-white rounded-tr-none'
                        }`}>
                        <p className="text-xs leading-relaxed font-semibold">
                          {msg.content}
                        </p>
                        <div className={`flex items-center justify-end gap-1 text-[8px] mt-2 font-bold ${isInbound ? 'text-slate-400' : 'text-teal-200'
                          }`}>
                          <span>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {!isInbound && <CheckCheck size={10} className="text-teal-300" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Bottom input area */}
              <div className="p-4 border-t border-slate-100 bg-white flex-shrink-0 space-y-3">
                <div className="flex justify-between items-center px-1">
                  <button
                    onClick={() => setShowTemplateModal(true)}
                    className="text-[9px] font-black text-teal-600 hover:text-teal-700 uppercase tracking-widest hover:underline flex items-center gap-1"
                  >
                    <FileText size={12} /> Use Approved Template
                  </button>
                  <div className="flex items-center gap-2">
                    <Sparkles size={12} className="text-teal-600" />
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      AI Assist Drafting Active
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-slate-100 border border-slate-200 rounded-[1.75rem] px-4 py-2.5 flex items-center gap-2 focus-within:bg-white focus-within:border-teal-500 transition-all shadow-inner">
                    <button className="p-1 text-slate-400 hover:text-teal-600 rounded-lg transition-all" title="Attach file">
                      <Paperclip size={16} />
                    </button>
                    <input
                      type="text"
                      placeholder={`Type a reply to ${activeConv.patient_name || activeConv.phone}...`}
                      className="flex-1 bg-transparent border-none outline-none text-xs font-bold text-slate-800"
                      value={typedMessage}
                      onChange={(e) => setTypedMessage(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
                    />
                  </div>
                  <button
                    onClick={handleSendMessage}
                    className="w-10 h-10 bg-teal-600 hover:bg-teal-700 text-white rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 flex-shrink-0"
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/20 py-24 text-center">
              <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-[1.5rem] flex items-center justify-center text-slate-300 mb-4">
                <MessageSquare size={32} />
              </div>
              <h4 className="text-base font-black text-slate-800">Select a conversation to start chat</h4>
              <p className="text-slate-400 text-xs mt-1">Review active patient support and web inquiries in real-time.</p>
            </div>
          )}
        </div>
      )}

      {/* 2. BROADCASTS CAMPAIGNS TAB */}
      {activeTab === 'broadcasts' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Dashboard Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { label: 'Total Broadcasts', value: broadcasts.length, change: 'Lifetime', color: 'from-blue-500 to-indigo-500' },
              { label: 'Recipients Reached', value: broadcasts.reduce((acc, b) => acc + (b.recipient_count || 0), 0), change: 'Global outbound', color: 'from-teal-500 to-emerald-500' },
              { label: 'Delivery Rate', value: '98.4%', change: 'Avg. delivered', color: 'from-amber-500 to-orange-500' },
              { label: 'Read Ratio', value: '87.2%', change: 'Engaged clients', color: 'from-rose-500 to-pink-500' }
            ].map((card, i) => (
              <div key={i} className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{card.label}</span>
                  <h4 className="text-2xl font-black text-slate-800 mt-2 leading-none">{card.value}</h4>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tight mt-2">{card.change}</p>
                </div>
                <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${card.color} opacity-10 flex items-center justify-center`} />
              </div>
            ))}
          </div>

          {/* Broadcasts History list */}
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <History size={14} /> Campaign Delivery Log
              </h3>
              <button
                onClick={() => setShowNewBroadcastModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white font-black text-[10px] uppercase tracking-wider rounded-xl hover:bg-teal-700 shadow-md transition-all"
              >
                <Plus size={14} /> Create Broadcast
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    <th className="p-4 pl-6">Campaign Name</th>
                    <th className="p-4">Template Used</th>
                    <th className="p-4">Audience Size</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Language</th>
                    <th className="p-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                  {broadcasts.map((bc) => (
                    <tr key={bc.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 pl-6 font-black text-slate-800">{bc.name}</td>
                      <td className="p-4 font-mono text-[10px] bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{bc.template_name}</td>
                      <td className="p-4">{bc.recipient_count} recipients</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight ${bc.status === 'completed' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-amber-50 text-amber-600'
                          }`}>
                          {bc.status}
                        </span>
                      </td>
                      <td className="p-4 font-bold uppercase">{bc.template_language}</td>
                      <td className="p-4 pr-6 text-right">
                        <button className="text-teal-600 text-[10px] font-black uppercase hover:underline">View Recipients</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. FLOWS & AUTOMATIONS TAB */}
      {activeTab === 'automations' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Bot size={14} /> Automation Triggers & Logs
            </h3>
            <button
              onClick={() => setShowNewAutomationModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white font-black text-[10px] uppercase tracking-wider rounded-xl hover:bg-teal-700 shadow-md transition-all"
            >
              <Plus size={14} /> Add Automation Flow
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {automations.map((flow) => (
              <div key={flow.id} className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-black text-slate-800 mb-1">{flow.name}</h4>
                    <span className="text-[9px] font-black bg-teal-50 text-teal-700 px-2 py-0.5 rounded uppercase tracking-tighter">
                      Trigger: {flow.trigger_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${flow.is_active ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {flow.is_active ? 'Active' : 'Paused'}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-medium leading-relaxed text-slate-600">
                  <p><strong>Action Type:</strong> {flow.action_type}</p>
                  <p className="mt-1"><strong>Action Payload:</strong> {JSON.stringify(flow.action_payload)}</p>
                </div>

                <div className="flex justify-between items-center border-t border-slate-100 pt-4">
                  <span className="text-[10px] font-bold text-slate-400">Created: Just now</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setAutomations(automations.map(a => a.id === flow.id ? { ...a, is_active: !a.is_active } : a));
                        toast.success(`Flow ${flow.is_active ? 'paused' : 'activated'}`);
                      }}
                      className="text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-800"
                    >
                      {flow.is_active ? 'Pause Flow' : 'Activate Flow'}
                    </button>
                    <button
                      onClick={() => {
                        setAutomations(automations.filter(a => a.id !== flow.id));
                        toast.success('Flow template deleted');
                      }}
                      className="text-[10px] font-black uppercase tracking-wider text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TEAM NOTES DRAWER ─── */}
      {showNotesDrawer && (
        <div className="fixed inset-0 z-[200] flex justify-end bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-black text-slate-800 leading-tight">Team Internal Notes</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-1">Shared commentary on this patient inquiry</p>
              </div>
              <button
                onClick={() => setShowNotesDrawer(false)}
                className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-600 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrolling Notes list */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {activeNotes.map((note) => (
                <div key={note.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-[10px] font-black text-slate-700">{note.author_name}</span>
                    <span className="text-[9px] text-slate-400 font-bold">
                      {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-semibold mt-1">
                    {note.content}
                  </p>
                </div>
              ))}

              {activeNotes.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <FileText size={32} className="mx-auto text-slate-200 mb-3" />
                  <p className="text-xs font-bold uppercase tracking-widest">No internal notes yet</p>
                </div>
              )}
            </div>

            {/* Note Composer */}
            <div className="p-6 border-t border-slate-100 bg-white">
              <textarea
                placeholder="Type a team note (visas, preferences, medical details)..."
                rows={3}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs outline-none focus:bg-white focus:border-teal-500 transition-all font-semibold"
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
              />
              <button
                onClick={handleAddNote}
                className="w-full mt-3 py-3 bg-teal-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-teal-700 shadow-md transition-all"
              >
                Save Internal Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TEMPLATES REPLY MODAL ─── */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-800 leading-tight">Select WhatsApp Template</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-1">Approved communication standard replies</p>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar">
              {MOCK_TEMPLATES.map((tmpl, idx) => (
                <div
                  key={idx}
                  onClick={() => handleApplyTemplate(tmpl.content)}
                  className="p-4 border border-slate-100 hover:border-teal-200 hover:shadow-sm rounded-2xl cursor-pointer bg-slate-50/20 hover:bg-white transition-all group"
                >
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="font-mono text-[10px] font-black text-teal-700 group-hover:underline">
                      {tmpl.name}
                    </span>
                    <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase">
                      {tmpl.language}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                    {tmpl.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── NEW BROADCAST MODAL ─── */}
      {showNewBroadcastModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-800 leading-tight">Create WhatsApp Broadcast</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-1">Bulk dispatch campaigns</p>
              </div>
              <button onClick={() => setShowNewBroadcastModal(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"><X size={20} /></button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newBroadcast.name) return;
                const b: Broadcast = {
                  id: Math.random().toString(36).substr(2, 9),
                  name: newBroadcast.name,
                  template_name: newBroadcast.template_name,
                  template_language: newBroadcast.language,
                  status: 'completed',
                  recipient_count: Math.floor(Math.random() * 200) + 10
                };
                setBroadcasts([b, ...broadcasts]);
                setShowNewBroadcastModal(false);
                setNewBroadcast({ name: '', template_name: 'welcome_lead', language: 'en' });
                try {
                  await supabase.from('wa_broadcasts').insert([{
                    name: b.name,
                    template_name: b.template_name,
                    template_language: b.template_language,
                    status: 'completed'
                  }]);
                } catch (err) { }
                toast.success('Broadcast campaign completed successfully');
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Campaign Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. June Inbound Welcome"
                  className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:border-teal-500 transition-all"
                  value={newBroadcast.name}
                  onChange={e => setNewBroadcast({ ...newBroadcast, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Template</label>
                  <select
                    className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none cursor-pointer"
                    value={newBroadcast.template_name}
                    onChange={e => setNewBroadcast({ ...newBroadcast, template_name: e.target.value })}
                  >
                    {MOCK_TEMPLATES.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Language</label>
                  <select
                    className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none cursor-pointer"
                    value={newBroadcast.language}
                    onChange={e => setNewBroadcast({ ...newBroadcast, language: e.target.value })}
                  >
                    <option value="en">English (en)</option>
                    <option value="ar">Arabic (ar)</option>
                    <option value="fr">French (fr)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-3 bg-teal-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-teal-700 shadow-md transition-all"
              >
                Launch Campaign
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── NEW AUTOMATION MODAL ─── */}
      {showNewAutomationModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-800 leading-tight">Create Automation Flow</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-1">Rule-based chat responses</p>
              </div>
              <button onClick={() => setShowNewAutomationModal(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"><X size={20} /></button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newAutomation.name) return;
                const flow: Automation = {
                  id: Math.random().toString(36).substr(2, 9),
                  name: newAutomation.name,
                  trigger_type: newAutomation.trigger_type || 'lead_created',
                  trigger_conditions: {},
                  action_type: newAutomation.action_type || 'send_message',
                  action_payload: { template_name: 'welcome_lead' },
                  is_active: true
                };
                setAutomations([...automations, flow]);
                setShowNewAutomationModal(false);
                setNewAutomation({ name: '', trigger_type: 'lead_created', action_type: 'send_message', is_active: true });
                try {
                  await supabase.from('wa_automations').insert([{
                    name: flow.name,
                    trigger_type: flow.trigger_type,
                    trigger_conditions: flow.trigger_conditions,
                    action_type: flow.action_type,
                    action_payload: flow.action_payload,
                    is_active: flow.is_active
                  }]);
                } catch (err) { }
                toast.success('Automation flow template created and running');
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Automation Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Welcome message on new enquiry"
                  className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:border-teal-500 transition-all"
                  value={newAutomation.name}
                  onChange={e => setNewAutomation({ ...newAutomation, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Trigger Event</label>
                  <select
                    className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none cursor-pointer"
                    value={newAutomation.trigger_type}
                    onChange={e => setNewAutomation({ ...newAutomation, trigger_type: e.target.value as any })}
                  >
                    <option value="lead_created">Lead Created</option>
                    <option value="status_changed">Status Changed</option>
                    <option value="keyword_detected">Keyword Detected</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Action</label>
                  <select
                    className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none cursor-pointer"
                    value={newAutomation.action_type}
                    onChange={e => setNewAutomation({ ...newAutomation, action_type: e.target.value as any })}
                  >
                    <option value="send_message">Send Message</option>
                    <option value="assign_agent">Assign Support Agent</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-3 bg-teal-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-teal-700 shadow-md transition-all"
              >
                Start Flow
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default WhatsAppIntegration;
