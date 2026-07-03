import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Send, Search, MessageSquare, Plus, X, ChevronRight, RefreshCw } from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { useAuthStore } from '../store/authStore';
import { useDataStore } from '../store/dataStore';
import { messagesApi, userSearchApi } from '../lib/api';
import { timeAgo } from '../lib/utils';
import toast from 'react-hot-toast';
import type { Conversation, Message } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SearchUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  avatar?: string;
  phone?: string;
}

export function MessagesPage() {
  const { user } = useAuthStore();
  const { conversations, messages, setConversations, setMessages, addMessage } = useDataStore();

  // ── Conversation sidebar state ────────────────────────────────────────────
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [convSearch, setConvSearch] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(false);

  // ── Message input state ───────────────────────────────────────────────────
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── New conversation modal state ──────────────────────────────────────────
  const [showNewConv, setShowNewConv] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<SearchUser[]>([]);
  const [creatingConv, setCreatingConv] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Derived state ─────────────────────────────────────────────────────────
  const activeConv = conversations.find(c => c.id === activeConvId);
  const activeMessages = activeConvId ? (messages[activeConvId] || []) : [];

  const filteredConvs = convSearch.trim()
    ? conversations.filter(c => {
        const q = convSearch.toLowerCase();
        return (
          c.participants?.some(p => p.name?.toLowerCase().includes(q)) ||
          c.propertyTitle?.toLowerCase().includes(q) ||
          (c.lastMessage as Message | null)?.content?.toLowerCase().includes(q)
        );
      })
    : conversations;

  // ── Load conversations on mount + poll every 8s ───────────────────────────
  const loadConversations = useCallback(async (silent = false) => {
    if (!silent) setLoadingConvs(true);
    try {
      const res = await messagesApi.conversations();
      const convs = (res.data as { data: Conversation[] }).data;
      if (Array.isArray(convs)) setConversations(convs);
    } catch { /* keep cached */ }
    finally { if (!silent) setLoadingConvs(false); }
  }, [setConversations]);

  useEffect(() => {
    loadConversations();
    const interval = setInterval(() => loadConversations(true), 8000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  // ── Load messages when conversation is selected + poll every 4s ──────────
  const loadMessages = useCallback(async (convId: string) => {
    try {
      const res = await messagesApi.messages(convId);
      const msgs = (res.data as { data: Message[] }).data;
      if (Array.isArray(msgs)) setMessages(convId, msgs);
    } catch { /* keep cached */ }
  }, [setMessages]);

  useEffect(() => {
    if (!activeConvId) return;
    loadMessages(activeConvId);
    const interval = setInterval(() => loadMessages(activeConvId), 4000);
    return () => clearInterval(interval);
  }, [activeConvId, loadMessages]);

  // ── Auto-scroll to latest message ─────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length]);

  // ── Focus input when conversation selected ────────────────────────────────
  useEffect(() => {
    if (activeConvId) setTimeout(() => inputRef.current?.focus(), 100);
  }, [activeConvId]);

  // ── Live user search with debounce ────────────────────────────────────────
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!userSearch.trim()) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    searchDebounce.current = setTimeout(async () => {
      try {
        const res = await userSearchApi.search(userSearch.trim());
        setSearchResults(res.data?.data || []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [userSearch]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getConvName = (conv: Conversation) => {
    const others = (conv.participants || []).filter(p => p.id !== user?.id);
    if (others.length === 0) return 'You';
    if (others.length === 1) return others[0].name || 'Unknown';
    return `${others[0].name} +${others.length - 1}`;
  };

  const toggleUser = (u: SearchUser) => {
    setSelectedUsers(prev =>
      prev.find(x => x.id === u.id)
        ? prev.filter(x => x.id !== u.id)
        : [...prev, u]
    );
  };

  const resetModal = () => {
    setShowNewConv(false);
    setUserSearch('');
    setSearchResults([]);
    setSelectedUsers([]);
    setCreatingConv(false);
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = async () => {
    const content = newMessage.trim();
    if (!content || !activeConvId) return;
    setNewMessage('');
    setSending(true);

    // Optimistic message
    const tempId = `temp_${Date.now()}`;
    const tempMsg: Message = {
      id: tempId,
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
      const current = messages[activeConvId] || [];
      setMessages(activeConvId, current.map(m => m.id === tempId ? saved : m));
      // Refresh conversation list to update last message preview
      loadConversations(true);
    } catch {
      toast.error('Failed to send message');
      const current = messages[activeConvId] || [];
      setMessages(activeConvId, current.filter(m => m.id !== tempId));
      setNewMessage(content); // restore
    } finally {
      setSending(false);
    }
  };

  // ── Start new conversation ────────────────────────────────────────────────
  const handleStartConversation = async () => {
    if (selectedUsers.length === 0) { toast.error('Select at least one person'); return; }
    setCreatingConv(true);
    try {
      const participantIds  = selectedUsers.map(u => u.id);
      const participantDetails = selectedUsers.map(u => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`.trim(),
        role: u.role,
      }));

      const res = await messagesApi.startConv({ participantIds, participantDetails });
      const conv = (res.data as { data: Conversation }).data;

      // Upsert: if conversation already exists (dedup), just switch to it
      setConversations(prev => {
        const exists = prev.find(c => c.id === conv.id);
        return exists ? prev : [conv, ...prev];
      });
      setActiveConvId(conv.id);
      resetModal();
      toast.success(`Conversation started with ${selectedUsers.map(u => u.firstName).join(', ')}`);
    } catch {
      toast.error('Failed to start conversation');
    } finally {
      setCreatingConv(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden">

      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      <div className="w-80 flex-shrink-0 border-r border-slate-100 dark:border-slate-700 flex flex-col">

        {/* Sidebar header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base">Messages</h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => loadConversations()}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title="Refresh"
              >
                <RefreshCw size={14} className={loadingConvs ? 'animate-spin' : ''} />
              </button>
              <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowNewConv(true)}>
                New
              </Button>
            </div>
          </div>
          {/* Conversation search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={convSearch}
              onChange={e => setConvSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-slate-100 placeholder-slate-400"
            />
            {convSearch && (
              <button onClick={() => setConvSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {filteredConvs.length === 0 ? (
            <div className="p-6 text-center">
              <MessageSquare size={28} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {convSearch ? 'No conversations match your search' : 'No conversations yet'}
              </p>
              {!convSearch && (
                <Button size="sm" className="mt-3" onClick={() => setShowNewConv(true)}>
                  Start a conversation
                </Button>
              )}
            </div>
          ) : (
            filteredConvs.map(conv => {
              const isActive = conv.id === activeConvId;
              const convName = getConvName(conv);
              const lastMsg = conv.lastMessage as Message | null;
              const unread = Number(conv.unreadCount || 0);

              return (
                <motion.button
                  key={conv.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setActiveConvId(conv.id)}
                  className={`w-full flex items-start gap-3 p-4 text-left border-b border-slate-50 dark:border-slate-700/50 transition-all ${
                    isActive
                      ? 'bg-primary-50 dark:bg-primary-900/20 border-l-2 border-l-primary-500'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <Avatar name={convName} size="md" className="flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-semibold truncate ${isActive ? 'text-primary-700 dark:text-primary-300' : 'text-slate-900 dark:text-slate-100'}`}>
                        {convName}
                      </p>
                      <span className="text-xs text-slate-400 flex-shrink-0">
                        {conv.updatedAt ? timeAgo(conv.updatedAt) : ''}
                      </span>
                    </div>
                    {conv.propertyTitle && (
                      <p className="text-xs text-primary-500 dark:text-primary-400 truncate mt-0.5">
                        🏠 {conv.propertyTitle}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {lastMsg
                          ? lastMsg.senderId === user?.id
                            ? `You: ${lastMsg.content}`
                            : lastMsg.content
                          : 'No messages yet'}
                      </p>
                      {unread > 0 && (
                        <span className="ml-2 flex-shrink-0 text-xs bg-primary-500 text-white font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Message thread ─────────────────────────────────────────────── */}
      {activeConv ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Thread header */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
            <Avatar name={getConvName(activeConv)} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{getConvName(activeConv)}</p>
              {activeConv.propertyTitle && (
                <p className="text-xs text-slate-400 truncate">🏠 {activeConv.propertyTitle}</p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {(activeConv.participants || []).filter(p => p.id !== user?.id).map(p => (
                <Badge key={p.id} variant="gray" className="text-xs capitalize">{p.role?.replace('_', ' ')}</Badge>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {activeMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageSquare size={36} className="text-slate-200 dark:text-slate-600 mb-3" />
                <p className="text-slate-400 text-sm">No messages yet. Say hello!</p>
              </div>
            ) : (
              activeMessages.map(msg => {
                const isMine = msg.senderId === user?.id;
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-end gap-2.5 ${isMine ? 'flex-row-reverse' : ''}`}
                  >
                    {!isMine && <Avatar name={msg.senderName} size="xs" className="flex-shrink-0 mb-1" />}
                    <div className={`max-w-[70%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      {!isMine && (
                        <span className="text-xs text-slate-400 px-1">{msg.senderName}</span>
                      )}
                      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        isMine
                          ? 'bg-primary-600 text-white rounded-br-sm'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-bl-sm'
                      } ${msg.id.startsWith('temp_') ? 'opacity-70' : ''}`}>
                        {msg.content}
                      </div>
                      <span className="text-xs text-slate-400 px-1">{timeAgo(msg.createdAt)}</span>
                    </div>
                  </motion.div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message input */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
            <div className="flex items-center gap-3">
              <input
                ref={inputRef}
                type="text"
                placeholder="Type a message..."
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                className="flex-1 px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-slate-100 placeholder-slate-400"
                disabled={sending}
              />
              <Button
                onClick={handleSend}
                disabled={!newMessage.trim() || sending}
                loading={sending}
                icon={<Send size={15} />}
                className="flex-shrink-0"
              >
                Send
              </Button>
            </div>
            <p className="text-xs text-slate-400 mt-1.5 px-1">Press Enter to send</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={<MessageSquare size={32} />}
            title="Select a conversation"
            description="Choose a conversation from the list, or start a new one."
            action={
              <Button icon={<Plus size={15} />} onClick={() => setShowNewConv(true)}>
                New Conversation
              </Button>
            }
          />
        </div>
      )}

      {/* ── New Conversation Modal ─────────────────────────────────────── */}
      <Modal
        open={showNewConv}
        onClose={resetModal}
        title="New Conversation"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={resetModal}>Cancel</Button>
            <Button
              loading={creatingConv}
              disabled={selectedUsers.length === 0}
              onClick={handleStartConversation}
              icon={<ChevronRight size={14} />}
            >
              Start {selectedUsers.length > 1 ? `Group Chat (${selectedUsers.length})` : 'Chat'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Selected users chips */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
              {selectedUsers.map(u => (
                <span key={u.id} className="inline-flex items-center gap-1.5 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-medium px-2.5 py-1.5 rounded-full">
                  <Avatar name={`${u.firstName} ${u.lastName}`} size="xs" />
                  {u.firstName} {u.lastName}
                  <button onClick={() => toggleUser(u)} className="hover:text-red-500 ml-0.5">
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Live search input */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email or role..."
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              autoFocus
              className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-slate-100 placeholder-slate-400"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {userSearch && !searching && (
              <button onClick={() => setUserSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Search results */}
          <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-600 divide-y divide-slate-100 dark:divide-slate-700">
            {!userSearch.trim() ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                Start typing to search for people to message
              </div>
            ) : searching ? (
              <div className="px-4 py-6 text-center text-sm text-slate-400">Searching...</div>
            ) : searchResults.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-400">
                No users found for "{userSearch}"
              </div>
            ) : (
              searchResults.map(u => {
                const isSelected = !!selectedUsers.find(x => x.id === u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => toggleUser(u)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      isSelected
                        ? 'bg-primary-50 dark:bg-primary-900/20'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <Avatar name={`${u.firstName} ${u.lastName}`} size="sm" className="flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {u.firstName} {u.lastName}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="gray" className="text-xs capitalize">{u.role.replace('_', ' ')}</Badge>
                      {isSelected && (
                        <div className="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {selectedUsers.length > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              {selectedUsers.length === 1
                ? `1 person selected — will start a direct message`
                : `${selectedUsers.length} people selected — will create a group chat`}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
