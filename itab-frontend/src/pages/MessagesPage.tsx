import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Send, Search, MessageSquare, Plus, Users, X } from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuthStore } from '../store/authStore';
import { useDataStore } from '../store/dataStore';
import { useUserStore } from '../store/userStore';
import { messagesApi } from '../lib/api';
import { timeAgo } from '../lib/utils';
import toast from 'react-hot-toast';
import type { Conversation, Message } from '../types';

export function MessagesPage() {
  const { user } = useAuthStore();
  const { conversations, messages, setConversations, setMessages, addMessage } = useDataStore();
  const { users } = useUserStore();

  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [showNewConv, setShowNewConv] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [creatingConv, setCreatingConv] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find(c => c.id === activeConvId);
  const activeMessages = activeConvId ? (messages[activeConvId] || []) : [];

  // Filter conversations by search
  const filteredConvs = conversations.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.participants.some(p => p.name?.toLowerCase().includes(q)) ||
           c.propertyTitle?.toLowerCase().includes(q);
  });

  // Load messages when conversation is selected
  const loadMessages = useCallback(async (convId: string) => {
    try {
      const res = await messagesApi.messages(convId);
      const msgs = (res.data as { data: Message[] }).data;
      setMessages(convId, msgs);
    } catch {
      // Keep cached messages
    }
  }, [setMessages]);

  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId);
    }
  }, [activeConvId, loadMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length]);

  // Reload conversations from backend
  useEffect(() => {
    messagesApi.conversations()
      .then(res => {
        const convs = (res.data as { data: Conversation[] }).data;
        if (Array.isArray(convs)) setConversations(convs);
      })
      .catch(() => {});
  }, [setConversations]);

  const handleSend = async () => {
    if (!newMessage.trim() || !activeConvId) return;
    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);

    // Optimistic update
    const tempMsg: Message = {
      id: `temp_${Date.now()}`,
      conversationId: activeConvId,
      senderId: user?.id || '',
      senderName: `${user?.firstName} ${user?.lastName}`,
      senderAvatar: user?.avatar,
      content,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    addMessage(activeConvId, tempMsg);

    try {
      const res = await messagesApi.send(activeConvId, content);
      const saved = (res.data as { data: Message }).data;
      // Replace temp with real
      const current = messages[activeConvId] || [];
      setMessages(activeConvId, current.map(m => m.id === tempMsg.id ? saved : m));
    } catch {
      toast.error('Failed to send message');
      // Remove temp message on failure
      const current = messages[activeConvId] || [];
      setMessages(activeConvId, current.filter(m => m.id !== tempMsg.id));
    } finally {
      setSending(false);
    }
  };

  const handleStartConversation = async () => {
    if (selectedParticipants.length === 0) { toast.error('Select at least one person'); return; }
    setCreatingConv(true);
    try {
      const participantDetails = selectedParticipants.map(id => {
        const u = users.find(x => x.id === id);
        return { id, name: u ? `${u.firstName} ${u.lastName}` : id, role: u?.role || 'tenant' };
      });
      // Add current user
      if (user) {
        participantDetails.push({ id: user.id, name: `${user.firstName} ${user.lastName}`, role: user.role });
      }
      const res = await messagesApi.startConv({ participantIds: selectedParticipants, participantDetails });
      const conv = (res.data as { data: Conversation }).data;
      setConversations([conv, ...conversations]);
      setActiveConvId(conv.id);
      setShowNewConv(false);
      setSelectedParticipants([]);
    } catch {
      toast.error('Failed to start conversation');
    } finally {
      setCreatingConv(false);
    }
  };

  const getConvName = (conv: Conversation) => {
    const others = conv.participants.filter(p => p.id !== user?.id);
    if (others.length === 0) return 'You';
    if (others.length === 1) return others[0].name;
    return `${others[0].name} +${others.length - 1}`;
  };

  const getConvInitials = (conv: Conversation) => {
    const name = getConvName(conv);
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Other users to start conversations with, filtered by live search
  const otherUsers = users.filter(u => u.id !== user?.id);
  const filteredUsers = userSearch.trim()
    ? otherUsers.filter(u =>
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.role?.toLowerCase().includes(userSearch.toLowerCase())
      )
    : otherUsers;

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <div className="w-80 flex-shrink-0 border-r border-slate-100 dark:border-slate-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Messages</h2>
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowNewConv(true)}>New</Button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-slate-100 placeholder-slate-400"
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {filteredConvs.length === 0 ? (
            <div className="p-6 text-center">
              <MessageSquare size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">No conversations yet</p>
              <Button size="sm" className="mt-3" onClick={() => setShowNewConv(true)}>Start one</Button>
            </div>
          ) : (
            filteredConvs.map(conv => {
              const isActive = conv.id === activeConvId;
              const lastMsg = conv.lastMessage;
              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className={`w-full flex items-start gap-3 p-4 text-left transition-colors border-b border-slate-50 dark:border-slate-700/50 ${isActive ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                >
                  <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-700 dark:text-primary-300 font-bold text-sm flex-shrink-0">
                    {getConvInitials(conv)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">{getConvName(conv)}</p>
                      {conv.unreadCount > 0 && (
                        <span className="flex-shrink-0 w-5 h-5 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    {conv.propertyTitle && (
                      <p className="text-xs text-primary-600 dark:text-primary-400 truncate">📍 {conv.propertyTitle}</p>
                    )}
                    {lastMsg && (
                      <p className="text-xs text-slate-400 truncate mt-0.5">{lastMsg.content}</p>
                    )}
                    <p className="text-xs text-slate-300 dark:text-slate-600 mt-0.5">{timeAgo(conv.updatedAt)}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Chat area ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeConv ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={<MessageSquare size={32} />}
              title="Select a conversation"
              description="Choose a conversation from the left or start a new one."
            />
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-700 dark:text-primary-300 font-bold text-sm">
                {getConvInitials(activeConv)}
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{getConvName(activeConv)}</p>
                {activeConv.propertyTitle && (
                  <p className="text-xs text-slate-400">{activeConv.propertyTitle}</p>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {activeMessages.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400">No messages yet. Say hello!</div>
              ) : (
                activeMessages.map(msg => {
                  const isMe = msg.senderId === user?.id;
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      {!isMe && (
                        <Avatar name={msg.senderName} src={msg.senderAvatar} size="xs" />
                      )}
                      <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                        {!isMe && (
                          <p className="text-xs text-slate-400 px-1">{msg.senderName}</p>
                        )}
                        <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                          isMe
                            ? 'bg-primary-600 text-white rounded-br-sm'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-bl-sm'
                        }`}>
                          {msg.content}
                        </div>
                        <p className="text-xs text-slate-300 dark:text-slate-600 px-1">{timeAgo(msg.createdAt)}</p>
                      </div>
                    </motion.div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-700">
              <div className="flex items-end gap-2">
                <textarea
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type a message... (Enter to send)"
                  rows={1}
                  className="flex-1 px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-slate-100 placeholder-slate-400 resize-none"
                />
                <Button
                  icon={<Send size={16} />}
                  onClick={handleSend}
                  loading={sending}
                  disabled={!newMessage.trim()}
                  className="flex-shrink-0"
                >
                  Send
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── New Conversation Modal ────────────────────────────────────────── */}
      <Modal
        open={showNewConv}
        onClose={() => { setShowNewConv(false); setSelectedParticipants([]); setUserSearch(''); }}
        title="New Conversation"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowNewConv(false); setSelectedParticipants([]); setUserSearch(''); }}>Cancel</Button>
            <Button
              loading={creatingConv}
              icon={<Users size={14} />}
              onClick={handleStartConversation}
              disabled={selectedParticipants.length === 0}
            >
              Start Conversation
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Select people to message:</p>

          {/* Live search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              autoFocus
              placeholder="Search by name, email or role..."
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-slate-100 placeholder-slate-400"
            />
            {userSearch && (
              <button onClick={() => setUserSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Selected count */}
          {selectedParticipants.length > 0 && (
            <p className="text-xs text-primary-600 font-medium">
              {selectedParticipants.length} person{selectedParticipants.length > 1 ? 's' : ''} selected
            </p>
          )}

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                {userSearch ? `No results for "${userSearch}"` : 'No other users found'}
              </p>
            ) : filteredUsers.map(u => {
              const isSelected = selectedParticipants.includes(u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => setSelectedParticipants(prev =>
                    isSelected ? prev.filter(id => id !== u.id) : [...prev, u.id]
                  )}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                    isSelected
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Avatar name={`${u.firstName} ${u.lastName}`} src={u.avatar} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{u.firstName} {u.lastName}</p>
                    <p className="text-xs text-slate-400 capitalize">{u.role.replace('_', ' ')} · {u.email}</p>
                  </div>
                  {isSelected && <span className="text-primary-600 font-bold text-base">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      </Modal>
    </div>
  );
}
