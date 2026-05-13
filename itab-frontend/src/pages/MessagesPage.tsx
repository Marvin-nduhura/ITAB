import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Send, Search, MessageSquare, Plus, Users, CheckSquare, Square } from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Textarea } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuthStore } from '../store/authStore';
import { usePropertyStore } from '../store/propertyStore';
import { useDataStore } from '../store/dataStore';
import { useUserStore } from '../store/userStore';
import { filterPropertiesForUser } from '../lib/rbac';
import { timeAgo } from '../lib/utils';
import { messagesApi, noticesApi } from '../lib/api';
import type { Conversation, Message, Property } from '../types';
import toast from 'react-hot-toast';

function otherParticipant(conv: Conversation, myId: string) {
  return conv.participants.find((p) => p.id !== myId);
}

function convPreview(conv: Conversation): string {
  const lm = conv.lastMessage as Message | undefined;
  if (lm?.content) return lm.content;
  return 'No messages yet';
}

function convTime(conv: Conversation): string {
  const lm = conv.lastMessage as Message | undefined;
  return lm?.createdAt || conv.updatedAt;
}

export function MessagesPage() {
  const { user } = useAuthStore();
  const { properties: allProperties } = usePropertyStore();
  const getUserById = useUserStore((s) => s.getUserById);
  const conversations = useDataStore((s) => s.conversations);
  const messagesByConv = useDataStore((s) => s.messages);
  const setMessages = useDataStore((s) => s.setMessages);

  const myProperties = useMemo(
    () => filterPropertiesForUser(allProperties, user),
    [allProperties, user]
  );

  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<Set<string>>(new Set());
  const [bulkTarget, setBulkTarget] = useState<'all' | 'selected'>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const canBulkMessage = user?.role === 'property_manager' || user?.role === 'admin' || user?.role === 'landlord';

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const other = user ? otherParticipant(c, user.id) : null;
      const name = (other?.name || '').toLowerCase();
      const title = (c.propertyTitle || '').toLowerCase();
      return name.includes(q) || title.includes(q);
    });
  }, [conversations, search, user]);

  const activeConvData = useMemo(
    () => (activeConv ? conversations.find((c) => c.id === activeConv) : undefined),
    [conversations, activeConv]
  );

  const activeMessages: Message[] = activeConv ? messagesByConv[activeConv] ?? [] : [];

  const loadMessages = useCallback(
    async (convId: string) => {
      setLoadingMsgs(true);
      try {
        const res = await messagesApi.messages(convId);
        const list = (res.data as { data: Message[] }).data;
        setMessages(convId, Array.isArray(list) ? list : []);
      } catch {
        toast.error('Could not load messages');
        setMessages(convId, []);
      } finally {
        setLoadingMsgs(false);
      }
    },
    [setMessages]
  );

  useEffect(() => {
    if (!activeConv) return;
    void loadMessages(activeConv);
  }, [activeConv, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv, activeMessages]);

  useEffect(() => {
    if (!activeConv && filteredConversations.length > 0) {
      setActiveConv(filteredConversations[0].id);
    }
  }, [activeConv, filteredConversations]);

  const sendMessage = async () => {
    if (!message.trim() || !activeConv || !user) return;
    const text = message.trim();
    setMessage('');
    try {
      await messagesApi.send(activeConv, text);
      await loadMessages(activeConv);
    } catch {
      toast.error('Message could not be sent');
      setMessage(text);
    }
  };

  const getRecipientProperties = (): Property[] => {
    const base =
      bulkTarget === 'all'
        ? myProperties.filter((p) => p.status === 'rented' || p.status === 'published')
        : myProperties.filter((p) => selectedPropertyIds.has(p.id));
    return base.filter((p) => !!p.tenantId);
  };

  const getRecipients = () => {
    const props = getRecipientProperties();
    return props.map((p) => {
      const tu = p.tenantId ? getUserById(p.tenantId) : undefined;
      const tenantName = tu ? `${tu.firstName} ${tu.lastName}`.trim() || tu.email || 'Tenant' : 'Tenant';
      return {
        name: tenantName,
        property: p.title,
        propertyId: p.id,
        propertyTitle: p.title,
        tenantId: p.tenantId!,
        tenantName,
      };
    });
  };

  const handleBulkSend = async () => {
    if (!bulkMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }
    const r = getRecipients();
    if (r.length === 0) {
      toast.error('No tenants linked to the selected properties. Assign tenants on each property first.');
      return;
    }
    setBulkLoading(true);
    let ok = 0;
    for (const row of r) {
      try {
        await noticesApi.send({
          propertyId: row.propertyId,
          propertyTitle: row.propertyTitle,
          tenantId: row.tenantId,
          tenantName: row.tenantName,
          type: 'general',
          subject: 'Notice from your property manager',
          body: bulkMessage.trim(),
          requiresAcknowledgement: false,
        });
        ok++;
      } catch {
        /* continue */
      }
    }
    setBulkLoading(false);
    setShowBulkModal(false);
    setBulkMessage('');
    setSelectedPropertyIds(new Set());
    setBulkTarget('all');
    if (ok === 0) toast.error('Could not deliver notices. Check connection or permissions.');
    else toast.success(`Sent notice to ${ok} tenant${ok !== 1 ? 's' : ''} (saved on server).`);
  };

  const toggleProperty = (id: string) => {
    setSelectedPropertyIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const closeBulk = () => {
    setShowBulkModal(false);
    setBulkMessage('');
    setSelectedPropertyIds(new Set());
    setBulkTarget('all');
  };

  const recipients = getRecipients();

  if (!user) {
    return (
      <div className="p-8">
        <EmptyState icon={<MessageSquare size={28} />} title="Sign in required" description="Please sign in to view messages." />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      <div
        className={`${activeConv ? 'hidden sm:flex' : 'flex'} flex-col w-full sm:w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden flex-shrink-0`}
      >
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Messages</h2>
            <div className="flex gap-1">
              {canBulkMessage && (
                <button
                  type="button"
                  onClick={() => setShowBulkModal(true)}
                  title="Bulk notice to tenants"
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-primary-600 transition-colors"
                >
                  <Users size={16} />
                </button>
              )}
              <button
                type="button"
                title="New conversation"
                onClick={() => toast('Create conversations from property workflows; server-backed threads appear here after sync.', { icon: '💬' })}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-primary-600 transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
          {filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">No conversations yet. They sync from the server when available.</div>
          ) : (
            filteredConversations.map((conv) => {
              const other = otherParticipant(conv, user.id);
              const name = other?.name || 'Conversation';
              const role = other?.role || '';
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => setActiveConv(conv.id)}
                  className={`w-full flex items-start gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                    activeConv === conv.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                  }`}
                >
                  <Avatar name={name} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">{name}</p>
                      <p className="text-xs text-slate-400 flex-shrink-0 ml-2">{timeAgo(convTime(conv))}</p>
                    </div>
                    <p className="text-xs text-slate-400 truncate">{role}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{convPreview(conv)}</p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <span className="w-5 h-5 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center flex-shrink-0">
                      {conv.unreadCount}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {activeConv && activeConvData ? (
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveConv(null)}
              className="sm:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
            >
              ←
            </button>
            <Avatar name={otherParticipant(activeConvData, user.id)?.name || '?'} size="md" />
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                {otherParticipant(activeConvData, user.id)?.name || 'Conversation'}
              </p>
              <p className="text-xs text-slate-400">
                {(otherParticipant(activeConvData, user.id)?.role || '') +
                  (activeConvData.propertyTitle ? ` · ${activeConvData.propertyTitle}` : '')}
              </p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loadingMsgs && activeMessages.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">Loading…</p>
            ) : (
              activeMessages.map((msg, i) => {
                const isMe = msg.senderId === user.id;
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[75%] flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          isMe
                            ? 'bg-primary-600 text-white rounded-br-sm'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-bl-sm'
                        }`}
                      >
                        {msg.content}
                      </div>
                      <p className="text-xs text-slate-400">{timeAgo(msg.createdAt)}</p>
                    </div>
                  </motion.div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-4 border-t border-slate-100 dark:border-slate-700">
            <div className="flex gap-2">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="Type a message… (Enter to send)"
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
              <Button icon={<Send size={16} />} onClick={() => void sendMessage()} disabled={!message.trim()} />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 hidden sm:flex items-center justify-center bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700">
          <EmptyState
            icon={<MessageSquare size={28} />}
            title="Select a conversation"
            description="Conversations load from the server. Use bulk notice to reach tenants by property."
          />
        </div>
      )}

      <Modal
        open={showBulkModal}
        onClose={closeBulk}
        title="Bulk notice to tenants"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={closeBulk}>
              Cancel
            </Button>
            <Button
              loading={bulkLoading}
              onClick={() => void handleBulkSend()}
              icon={<Send size={14} />}
              disabled={recipients.length === 0 || !bulkMessage.trim()}
            >
              Send to {recipients.length} tenant{recipients.length !== 1 ? 's' : ''}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <p className="text-xs text-slate-500">
            Notices are stored on the server (tenant notices). Only properties with an assigned tenant are included.
          </p>
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Send to</p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { key: 'all' as const, label: 'All properties', sub: 'Every property with a tenant' },
                  { key: 'selected' as const, label: 'Selected properties', sub: 'Choose specific buildings' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setBulkTarget(opt.key);
                    setSelectedPropertyIds(new Set());
                  }}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    bulkTarget === opt.key
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{opt.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{opt.sub}</p>
                </button>
              ))}
            </div>
          </div>
          {bulkTarget === 'selected' && (
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Select properties{' '}
                {selectedPropertyIds.size > 0 && (
                  <span className="ml-2 text-xs text-primary-600 font-normal">{selectedPropertyIds.size} selected</span>
                )}
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {myProperties
                  .filter((p) => p.status === 'rented' || p.status === 'published')
                  .map((p) => {
                    const hasTenant = !!p.tenantId;
                    const tu = p.tenantId ? getUserById(p.tenantId) : undefined;
                    const tenantName = tu ? `${tu.firstName} ${tu.lastName}`.trim() || tu.email || 'Tenant' : 'Tenant';
                    const isSel = selectedPropertyIds.has(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => hasTenant && toggleProperty(p.id)}
                        disabled={!hasTenant}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                          !hasTenant ? 'opacity-50 cursor-not-allowed' : ''
                        } ${isSel ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'}`}
                      >
                        {isSel ? (
                          <CheckSquare size={16} className="text-primary-600 flex-shrink-0" />
                        ) : (
                          <Square size={16} className="text-slate-400 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{p.title}</p>
                          <p className="text-xs text-slate-400">
                            {p.district} · {hasTenant ? tenantName : 'No tenant assigned'}
                          </p>
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
                  <div key={`${r.tenantId}-${i}`} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{r.name}</span>
                    <span className="text-slate-400 truncate ml-2 max-w-[160px]">{r.property}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <Textarea
            label="Message *"
            placeholder="e.g. Water will be off on Saturday 8AM-2PM for maintenance."
            value={bulkMessage}
            onChange={(e) => setBulkMessage(e.target.value)}
            rows={4}
          />
        </div>
      </Modal>
    </div>
  );
}
