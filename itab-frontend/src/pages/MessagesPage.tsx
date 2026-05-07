import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Search, MessageSquare, Plus, Users, CheckSquare, Square } from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Textarea } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuthStore } from '../store/authStore';
import { usePropertyStore } from '../store/propertyStore';
import { filterPropertiesForUser } from '../lib/rbac';
import { timeAgo } from '../lib/utils';
import toast from 'react-hot-toast';

const mockConversations = [
  { id: 'c1', name: 'Sarah Nakato',   role: 'Property Manager', lastMessage: 'Your inspection is confirmed for March 10.', time: '2024-03-05T10:00:00Z', unread: 2, propertyTitle: '3-Bedroom Apartment in Kololo' },
  { id: 'c2', name: 'John Ssemakula', role: 'Landlord',          lastMessage: 'Please confirm the payout details.',        time: '2024-03-04T14:00:00Z', unread: 0, propertyTitle: 'Entebbe Apartment' },
  { id: 'c3', name: 'Grace Apio',     role: 'Tenant',            lastMessage: 'Thank you for the confirmation.',           time: '2024-03-03T08:00:00Z', unread: 1, propertyTitle: '1-Bedroom Apartment in Entebbe' },
];

const mockMessages: Record<string, { id: string; sender: string; content: string; time: string; isMe: boolean }[]> = {
  c1: [
    { id: 'm1', sender: 'Sarah Nakato',   content: 'Hello! I wanted to confirm your inspection booking for the Kololo apartment.', time: '2024-03-05T09:00:00Z', isMe: false },
    { id: 'm2', sender: 'Me',             content: "Yes, I'm available on March 10 at 10 AM.",                                    time: '2024-03-05T09:05:00Z', isMe: true  },
    { id: 'm3', sender: 'Sarah Nakato',   content: 'Your inspection is confirmed for March 10 at 10:00 AM. Please bring your national ID.', time: '2024-03-05T10:00:00Z', isMe: false },
    { id: 'm4', sender: 'Sarah Nakato',   content: 'Also, remember the inspection fee of UGX 100,000 will be credited toward your first rent! 🏠', time: '2024-03-05T10:01:00Z', isMe: false },
  ],
  c2: [
    { id: 'm5', sender: 'John Ssemakula', content: 'Hi, I wanted to check on the payout for February.',                          time: '2024-03-04T14:00:00Z', isMe: false },
    { id: 'm6', sender: 'Me',             content: 'The payout was processed on March 5. You should receive it within 24 hours.', time: '2024-03-04T15:00:00Z', isMe: true  },
  ],
  c3: [
    { id: 'm7', sender: 'Grace Apio',     content: 'Hi, I have a question about my rent balance.',                               time: '2024-03-03T07:30:00Z', isMe: false },
    { id: 'm8', sender: 'Me',             content: 'Sure, what would you like to know?',                                         time: '2024-03-03T07:45:00Z', isMe: true  },
    { id: 'm9', sender: 'Grace Apio',     content: 'Thank you for the confirmation.',                                            time: '2024-03-03T08:00:00Z', isMe: false },
  ],
};

const mockPropertyTenants: Record<string, { id: string; name: string }[]> = {
  p6: [{ id: 'u4', name: 'Grace Apio' }],
  p1: [{ id: 'u7', name: 'James Okello' }],
  p2: [], p3: [], p4: [], p5: [],
};

export function MessagesPage() {
  const { user } = useAuthStore();
  const { properties: allProperties } = usePropertyStore();
  const myProperties = filterPropertiesForUser(allProperties, user);

  const [activeConv, setActiveConv]   = useState<string | null>('c1');
  const [message, setMessage]         = useState('');
  const [messages, setMessages]       = useState(mockMessages);
  const [search, setSearch]           = useState('');
  const [showBulkModal, setShowBulkModal]             = useState(false);
  const [bulkMessage, setBulkMessage]                 = useState('');
  const [bulkLoading, setBulkLoading]                 = useState(false);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<Set<string>>(new Set());
  const [bulkTarget, setBulkTarget]                   = useState<'all' | 'selected'>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const canBulkMessage = user?.role === 'property_manager' || user?.role === 'admin' || user?.role === 'landlord';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv, messages]);

  const sendMessage = () => {
    if (!message.trim() || !activeConv) return;
    const newMsg = { id: `m_${Date.now()}`, sender: 'Me', content: message, time: new Date().toISOString(), isMe: true };
    setMessages(prev => ({ ...prev, [activeConv]: [...(prev[activeConv] || []), newMsg] }));
    setMessage('');
  };

  const getRecipients = () => {
    const targetProps = bulkTarget === 'all' ? myProperties : myProperties.filter(p => selectedPropertyIds.has(p.id));
    const out: { name: string; property: string }[] = [];
    targetProps.forEach(p => (mockPropertyTenants[p.id] || []).forEach(t => out.push({ name: t.name, property: p.title })));
    return out;
  };

  const handleBulkSend = async () => {
    if (!bulkMessage.trim()) { toast.error('Please enter a message'); return; }
    const r = getRecipients();
    if (r.length === 0) { toast.error('No tenants found in the selected properties'); return; }
    setBulkLoading(true);
    await new Promise(res => setTimeout(res, 1200));
    setBulkLoading(false);
    setShowBulkModal(false);
    setBulkMessage('');
    setSelectedPropertyIds(new Set());
    setBulkTarget('all');
    toast.success(`Message sent to ${r.length} tenant${r.length > 1 ? 's' : ''}!`);
  };

  const toggleProperty = (id: string) => {
    setSelectedPropertyIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const closeBulk = () => { setShowBulkModal(false); setBulkMessage(''); setSelectedPropertyIds(new Set()); setBulkTarget('all'); };

  const activeConvData = mockConversations.find(c => c.id === activeConv);
  const activeMessages = activeConv ? (messages[activeConv] || []) : [];
  const recipients     = getRecipients();

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      <div className={`${activeConv ? 'hidden sm:flex' : 'flex'} flex-col w-full sm:w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden flex-shrink-0`}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Messages</h2>
            <div className="flex gap-1">
              {canBulkMessage && (
                <button onClick={() => setShowBulkModal(true)} title="Bulk message tenants"
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-primary-600 transition-colors">
                  <Users size={16} />
                </button>
              )}
              <button title="New conversation"
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-primary-600 transition-colors">
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
          {mockConversations.filter(c => c.name.toLowerCase().includes(search.toLowerCase())).map(conv => (
            <button key={conv.id} onClick={() => setActiveConv(conv.id)}
              className={`w-full flex items-start gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${activeConv === conv.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}>
              <Avatar name={conv.name} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">{conv.name}</p>
                  <p className="text-xs text-slate-400 flex-shrink-0 ml-2">{timeAgo(conv.time)}</p>
                </div>
                <p className="text-xs text-slate-400 truncate">{conv.role}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{conv.lastMessage}</p>
              </div>
              {conv.unread > 0 && (
                <span className="w-5 h-5 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center flex-shrink-0">{conv.unread}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {activeConv && activeConvData ? (
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-slate-100 dark:border-slate-700">
            <button onClick={() => setActiveConv(null)} className="sm:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">←</button>
            <Avatar name={activeConvData.name} size="md" />
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{activeConvData.name}</p>
              <p className="text-xs text-slate-400">{activeConvData.role} · {activeConvData.propertyTitle}</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {activeMessages.map((msg, i) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] flex flex-col gap-1 ${msg.isMe ? 'items-end' : 'items-start'}`}>
                  <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${msg.isMe ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-bl-sm'}`}>
                    {msg.content}
                  </div>
                  <p className="text-xs text-slate-400">{timeAgo(msg.time)}</p>
                </div>
              </motion.div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-4 border-t border-slate-100 dark:border-slate-700">
            <div className="flex gap-2">
              <input value={message} onChange={e => setMessage(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Type a message… (Enter to send)"
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
              <Button icon={<Send size={16} />} onClick={sendMessage} disabled={!message.trim()} />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 hidden sm:flex items-center justify-center bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700">
          <EmptyState icon={<MessageSquare size={28} />} title="Select a conversation" description="Choose a conversation from the list to start messaging." />
        </div>
      )}

      <Modal open={showBulkModal} onClose={closeBulk} title="Bulk Message Tenants" size="md"
        footer={
          <>
            <Button variant="secondary" onClick={closeBulk}>Cancel</Button>
            <Button loading={bulkLoading} onClick={handleBulkSend} icon={<Send size={14} />} disabled={recipients.length === 0 || !bulkMessage.trim()}>
              Send to {recipients.length} tenant{recipients.length !== 1 ? 's' : ''}
            </Button>
          </>
        }>
        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Send to</p>
            <div className="grid grid-cols-2 gap-2">
              {([{ key: 'all' as const, label: 'All properties', sub: 'Every tenant you manage' }, { key: 'selected' as const, label: 'Selected properties', sub: 'Choose specific buildings' }]).map(opt => (
                <button key={opt.key} type="button" onClick={() => { setBulkTarget(opt.key); setSelectedPropertyIds(new Set()); }}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${bulkTarget === opt.key ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'}`}>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{opt.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{opt.sub}</p>
                </button>
              ))}
            </div>
          </div>
          {bulkTarget === 'selected' && (
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Select properties {selectedPropertyIds.size > 0 && <span className="ml-2 text-xs text-primary-600 font-normal">{selectedPropertyIds.size} selected</span>}
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {myProperties.filter(p => p.status === 'rented' || p.status === 'published').map(p => {
                  const tenants = mockPropertyTenants[p.id] || [];
                  const isSel = selectedPropertyIds.has(p.id);
                  return (
                    <button key={p.id} type="button" onClick={() => toggleProperty(p.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${isSel ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'}`}>
                      {isSel ? <CheckSquare size={16} className="text-primary-600 flex-shrink-0" /> : <Square size={16} className="text-slate-400 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{p.title}</p>
                        <p className="text-xs text-slate-400">{p.district} · {tenants.length} tenant{tenants.length !== 1 ? 's' : ''}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {recipients.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Recipients ({recipients.length})</p>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {recipients.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{r.name}</span>
                    <span className="text-slate-400 truncate ml-2 max-w-[160px]">{r.property}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <Textarea label="Message *" placeholder="e.g. Water will be off on Saturday 8AM-2PM for maintenance. Please store water in advance."
            value={bulkMessage} onChange={e => setBulkMessage(e.target.value)} rows={4} />
        </div>
      </Modal>
    </div>
  );
}
