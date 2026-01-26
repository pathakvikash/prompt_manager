"use client";

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/components/AuthContext';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
    Clock,
    Database,
    History as HistoryIcon,
    Trash2,
    MessageSquare,
    Zap,
    Loader2,
    Calendar,
    User,
    CheckCircle2,
    Search,
    Filter,
    ChevronDown,
    ChevronUp,
    AlertTriangle
} from 'lucide-react';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import ToolActivity from '@/components/ToolActivity';

interface ChatSession {
    user_id: string;
    session_id?: string;
    timestamp: string;
    messages: { role: string, content: string, timestamp: string }[];
}

interface WebAction {
    action_type: string;
    timestamp: string;
    details: any;
}

interface HistoryData {
    chat_history: ChatSession[];
    web_actions: WebAction[];
    commands: any[];
}

const HistoryPage = () => {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'chat' | 'actions' | 'memory'>('chat');
    const [history, setHistory] = useState<HistoryData | null>(null);
    const [memory, setMemory] = useState<any>(null);
    const [fetching, setFetching] = useState(true);
    const [clearing, setClearing] = useState(false);

    // Search and Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
    const [showClearMenu, setShowClearMenu] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    const fetchData = async () => {
        setFetching(true);
        try {
            const [histRes, memRes] = await Promise.all([
                axios.get('http://localhost:5000/api/history'),
                axios.get('http://localhost:5000/api/memory')
            ]);
            setHistory(histRes.data);
            setMemory(memRes.data);
        } catch (error) {
            console.error("Failed to fetch history/memory:", error);
        } finally {
            setFetching(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    const handleClearHistory = async (type?: string) => {
        const typeLabel = type === 'chat_session' ? 'Chat History' : type === 'web_action' ? 'Activity Log' : 'All History';
        if (!confirm(`Are you sure you want to clear your ${typeLabel}? This cannot be undone.`)) return;

        setClearing(true);
        try {
            await axios.post('http://localhost:5000/api/history/clear', { type });
            await fetchData();
            setShowClearMenu(false);
        } catch (error) {
            console.error("Failed to clear history:", error);
        } finally {
            setClearing(false);
        }
    };

    const handleClearMemory = async () => {
        if (!confirm("Are you sure you want to clear your AI memory? This cannot be undone.")) return;
        setClearing(true);
        try {
            await axios.post('http://localhost:5000/api/memory/clear');
            setMemory({});
        } catch (error) {
            console.error("Failed to clear memory:", error);
        } finally {
            setClearing(false);
        }
    };

    const handleDeleteSession = async (session_id: string) => {
        if (!confirm("Permanently delete this chat session?")) return;
        try {
            await axios.post('http://localhost:5000/api/history/delete_session', { session_id }, { withCredentials: true });
            await fetchData();
        } catch (error) {
            console.error("Failed to delete session:", error);
        }
    };

    const handleDeleteMessage = async (session_id: string, index: number) => {
        if (!confirm("Permanently delete this message?")) return;
        try {
            await axios.post('http://localhost:5000/api/history/delete_message', { session_id, index }, { withCredentials: true });
            await fetchData();
        } catch (error) {
            console.error("Failed to delete message:", error);
        }
    };

    // Filtering Logic
    const filteredChatHistory = useMemo(() => {
        if (!history) return [];
        return history.chat_history.filter(session => {
            const matchesSearch = searchQuery === '' || session.messages.some(m =>
                m.content.toLowerCase().includes(searchQuery.toLowerCase())
            );

            const sessionDate = new Date(session.timestamp);
            const now = new Date();
            let matchesDate = true;

            if (dateRange === 'today') {
                matchesDate = sessionDate.toDateString() === now.toDateString();
            } else if (dateRange === 'week') {
                const weekAgo = new Date(now.setDate(now.getDate() - 7));
                matchesDate = sessionDate >= weekAgo;
            } else if (dateRange === 'month') {
                const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
                matchesDate = sessionDate >= monthAgo;
            }

            return matchesSearch && matchesDate;
        });
    }, [history, searchQuery, dateRange]);

    const filteredWebActions = useMemo(() => {
        if (!history) return [];
        return history.web_actions.filter(action => {
            const matchesSearch = searchQuery === '' ||
                action.action_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                JSON.stringify(action.details).toLowerCase().includes(searchQuery.toLowerCase());

            const actionDate = new Date(action.timestamp);
            const now = new Date();
            let matchesDate = true;

            if (dateRange === 'today') {
                matchesDate = actionDate.toDateString() === now.toDateString();
            } else if (dateRange === 'week') {
                const weekAgo = new Date(now.setDate(now.getDate() - 7));
                matchesDate = actionDate >= weekAgo;
            } else if (dateRange === 'month') {
                const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
                matchesDate = actionDate >= monthAgo;
            }

            return matchesSearch && matchesDate;
        });
    }, [history, searchQuery, dateRange]);

    if (loading || (fetching && !history)) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="animate-spin text-blue-500" size={48} />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-gray-900/40 p-6 rounded-3xl border border-gray-800/50 backdrop-blur-sm">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <HistoryIcon className="text-blue-500" />
                        History & Insights
                    </h1>
                    <p className="text-gray-400 mt-1">Review your interactions and AI memory for <span className="text-blue-400 font-medium">{user}</span></p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Search content..."
                            className="bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-all w-[240px]"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="flex bg-gray-800 p-1 rounded-xl border border-gray-700">
                        <button
                            onClick={() => setDateRange('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${dateRange === 'all' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setDateRange('today')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${dateRange === 'today' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                        >
                            Today
                        </button>
                        <button
                            onClick={() => setDateRange('week')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${dateRange === 'week' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                        >
                            Week
                        </button>
                    </div>

                    <div className="relative">
                        <button
                            onClick={() => setShowClearMenu(!showClearMenu)}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 rounded-xl transition-all text-sm font-bold active:scale-95"
                        >
                            <Trash2 size={16} />
                            <span>Clear</span>
                            <ChevronDown size={14} className={`transition-transform ${showClearMenu ? 'rotate-180' : ''}`} />
                        </button>

                        {showClearMenu && (
                            <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-[100] p-2 animate-in fade-in zoom-in duration-150">
                                <button
                                    onClick={() => handleClearHistory('chat_session')}
                                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg flex items-center gap-2"
                                >
                                    <MessageSquare size={14} className="text-blue-400" />
                                    Clear Chat History
                                </button>
                                <button
                                    onClick={() => handleClearHistory('web_action')}
                                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg flex items-center gap-2"
                                >
                                    <Zap size={14} className="text-yellow-500" />
                                    Clear Activity Log
                                </button>
                                <div className="h-px bg-gray-700 my-1 mx-2" />
                                <button
                                    onClick={() => handleClearHistory()}
                                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg flex items-center gap-2"
                                >
                                    <AlertTriangle size={14} />
                                    Clear All history
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="space-y-6">
                {/* Tabs */}
                <div className="flex border-b border-gray-800">
                    <button
                        onClick={() => setActiveTab('chat')}
                        className={`px-8 py-4 text-sm font-black uppercase tracking-widest transition-all relative ${activeTab === 'chat' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Chat History
                        {activeTab === 'chat' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>}
                    </button>
                    <button
                        onClick={() => setActiveTab('actions')}
                        className={`px-8 py-4 text-sm font-black uppercase tracking-widest transition-all relative ${activeTab === 'actions' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Activity Log
                        {activeTab === 'actions' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>}
                    </button>
                    <button
                        onClick={() => setActiveTab('memory')}
                        className={`px-8 py-4 text-sm font-black uppercase tracking-widest transition-all relative ${activeTab === 'memory' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        AI Memory
                        {activeTab === 'memory' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>}
                    </button>
                </div>

                <div className="min-h-[400px]">
                    {activeTab === 'chat' && (
                        <div className="grid grid-cols-1 gap-6">
                            {filteredChatHistory.length === 0 ? (
                                <div className="text-center py-20 text-gray-500 border border-dashed border-gray-800 rounded-3xl">
                                    <MessageSquare size={48} className="mx-auto mb-4 opacity-10" />
                                    <p className="text-lg font-medium">No conversations found.</p>
                                    <p className="text-xs mt-1">Try adjusting your filters or start a new chat!</p>
                                </div>
                            ) : (
                                filteredChatHistory.map((session, idx) => (
                                    <div key={idx} className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl overflow-hidden group hover:border-blue-500/30 transition-all duration-300 shadow-lg">
                                        <div className="px-6 py-4 bg-gray-900/40 border-b border-gray-700/50 flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                                                    <Calendar size={14} />
                                                </div>
                                                <span className="text-sm font-bold text-gray-300">
                                                    {new Date(session.timestamp).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                </span>
                                                <span className="text-xs text-gray-600 font-mono">
                                                    {new Date(session.timestamp).toLocaleTimeString()}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 bg-gray-800 px-3 py-1 rounded-full border border-gray-700">
                                                    {session.messages.length} interactions
                                                </span>
                                                <button
                                                    onClick={() => handleDeleteSession(session.session_id || '')}
                                                    className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                                    title="Delete Session"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="p-6 space-y-6 max-h-[400px] overflow-y-auto custom-scrollbar">
                                            {session.messages.map((msg, midx) => (
                                                <div key={midx} className={`flex gap-4 ${msg.role === 'user' ? 'opacity-90' : ''}`}>
                                                    <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center shadow-lg ${msg.role === 'user' ? 'bg-blue-600' : 'bg-purple-600'}`}>
                                                        {msg.role === 'user' ? <User size={16} className="text-white" /> : <Zap size={16} className="text-white" />}
                                                    </div>
                                                    <div className="space-y-1 flex-grow">
                                                        <div className="flex justify-between items-center group/msg-header">
                                                            <div className="text-[10px] font-black uppercase text-gray-500 tracking-wider">
                                                                {msg.role} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                            <button
                                                                onClick={() => handleDeleteMessage(session.session_id || '', midx)}
                                                                className="p-1 text-gray-600 hover:text-red-500 opacity-0 group-hover/msg-header:opacity-100 transition-opacity"
                                                                title="Delete Message"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                        <div className="text-[15px] text-gray-400 leading-relaxed capitalize-none">
                                                            {msg.role === 'assistant' ? (
                                                                <div className="space-y-1">
                                                                    {(() => {
                                                                        const parts: { type: string, content: string, isStreaming?: boolean }[] = [];
                                                                        const content = msg.content;

                                                                        // Unified regex to find all tags in order
                                                                        const tagRegex = /<(thought|think|tool_call|tool_pending|tool_result|tool|answer)(?:\s+([\s\S]*?))?>(?:([\s\S]*?)(?:<\/\1>|$))?|<(tool_pending)\s+([\s\S]*?)\s*\/>/g;

                                                                        let lastIndex = 0;
                                                                        let match;
                                                                        while ((match = tagRegex.exec(content)) !== null) {
                                                                            // Add text before the match
                                                                            const textBefore = content.slice(lastIndex, match.index);
                                                                            if (textBefore.trim()) {
                                                                                parts.push({ type: 'text', content: textBefore });
                                                                            }

                                                                            const fullTag = match[0];
                                                                            const type = match[1] || match[4];
                                                                            const tagAttrs = match[2] || '';
                                                                            const tagInner = match[3] || '';

                                                                            if (type === 'thought' || type === 'think') {
                                                                                parts.push({ type: 'thought', content: tagInner, isStreaming: false });
                                                                            } else if (type === 'tool_call' || type === 'tool') {
                                                                                let toolContent = tagInner;
                                                                                // Structured extraction for <tool name="...">
                                                                                if (type === 'tool' && tagAttrs.includes('name=')) {
                                                                                    const nameMatch = tagAttrs.match(/name=["'](.*?)["']/);
                                                                                    const toolName = nameMatch ? nameMatch[1] : 'unknown';
                                                                                    if (!tagInner.trim().startsWith('{')) {
                                                                                        const args: any = {};
                                                                                        const argMatches = tagInner.matchAll(/<argument\s+name=["'](.*?)["']\s+value=["'](.*?)["']\s*\/?>/g);
                                                                                        for (const am of argMatches) { args[am[1]] = am[2]; }
                                                                                        if (Object.keys(args).length === 0) {
                                                                                            const deepArgMatches = tagInner.matchAll(/<([a-zA-Z0-9_]+)>([\s\S]*?)<\/\1>/g);
                                                                                            for (const dam of deepArgMatches) {
                                                                                                if (!['arguments', 'thought', 'think'].includes(dam[1])) {
                                                                                                    args[dam[1]] = dam[2].trim();
                                                                                                }
                                                                                            }
                                                                                        }
                                                                                        toolContent = JSON.stringify({ name: toolName, arguments: args });
                                                                                    }
                                                                                }
                                                                                parts.push({ type: 'tool', content: toolContent });
                                                                            } else if (type === 'tool_pending') {
                                                                                const tagContent = match[2] || match[5];
                                                                                const getAttr = (name: string) => {
                                                                                    const m = tagContent.match(new RegExp(`${name}=["'](.*?)["']`));
                                                                                    return m ? m[1] : null;
                                                                                };

                                                                                const requestId = getAttr('request_id');
                                                                                const tool = getAttr('tool');
                                                                                const action = getAttr('action');
                                                                                const paramsB64 = getAttr('params_b64');

                                                                                if (requestId && tool && action && paramsB64) {
                                                                                    try {
                                                                                        const cleanB64 = paramsB64.trim().replace(/\s/g, '');
                                                                                        const params = JSON.parse(atob(cleanB64));
                                                                                        parts.push({
                                                                                            type: 'pending',
                                                                                            content: JSON.stringify({ request_id: requestId, tool, action, params })
                                                                                        });
                                                                                    } catch (e) { }
                                                                                }
                                                                            } else if (type === 'answer') {
                                                                                parts.push({ type: 'text', content: tagInner });
                                                                            }

                                                                            lastIndex = tagRegex.lastIndex;
                                                                        }
                                                                        // Add remaining text
                                                                        const remainingText = content.slice(lastIndex);
                                                                        if (remainingText.trim()) {
                                                                            parts.push({ type: 'text', content: remainingText });
                                                                        }

                                                                        // Clean up text parts from raw JSON markers if they leaked
                                                                        const cleanedParts = parts.map(p => {
                                                                            if (p.type === 'text') {
                                                                                return {
                                                                                    ...p,
                                                                                    content: p.content
                                                                                        .replace(/(?:GET|UPDATE|DELETE|SEARCH|WRITE)\s+(?:MEMORY|WEB|FILE)[\s\S]*?(\n|$)/gi, '') // Remove tool headers
                                                                                        .replace(/\{\s*"name"\s*:\s*"[^"]+"\s*,\s*"arguments"[\s\S]*?\}/g, '') // Remove raw JSON
                                                                                        .replace(/```[a-z]*\s*```/gi, '') // Remove empty code blocks
                                                                                        .trim()
                                                                                };
                                                                            }
                                                                            return p;
                                                                        }).filter(p => p.type !== 'text' || p.content);

                                                                        return (
                                                                            <>
                                                                                {cleanedParts.map((p, i) => {
                                                                                    if (p.type === 'text') {
                                                                                        return <MarkdownRenderer key={i} content={p.content} />;
                                                                                    }
                                                                                    // History doesn't show interactive pending cards, just the tool info
                                                                                    return <ToolActivity key={i} type={p.type === 'pending' ? 'pending' : p.type as any} content={p.content} />;
                                                                                })}
                                                                            </>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            ) : (
                                                                <p className="whitespace-pre-wrap">{msg.content}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'actions' && (
                        <div className="p-2">
                            <div className="relative border-l-2 border-gray-800 ml-6 space-y-8 py-4">
                                {filteredWebActions.length === 0 ? (
                                    <div className="text-center py-20 text-gray-500 border border-dashed border-gray-800 rounded-3xl ml-[-24px]">
                                        <Loader2 size={48} className="mx-auto mb-4 opacity-10" />
                                        <p>No activity logs found for this filter.</p>
                                    </div>
                                ) : (
                                    filteredWebActions.map((action, idx) => (
                                        <div key={idx} className="relative pl-10 animate-in slide-in-from-left duration-300" style={{ animationDelay: `${idx * 40}ms` }}>
                                            <div className="absolute left-[-11px] top-4 w-5 h-5 rounded-full bg-gray-900 border-2 border-blue-500 flex items-center justify-center">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,1)]"></div>
                                            </div>
                                            <div className="bg-gray-800/60 backdrop-blur-sm border border-gray-700/50 p-5 rounded-2xl shadow-xl hover:border-blue-500/30 transition-all hover:bg-gray-800/80">
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[10px] font-black uppercase text-blue-400 tracking-widest bg-blue-400/10 border border-blue-500/20 px-3 py-1 rounded-full">
                                                            {action.action_type.replace(/_/g, ' ')}
                                                        </span>
                                                        <span className="text-xs text-gray-500 font-bold">
                                                            {new Date(action.timestamp).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] font-mono text-gray-600 bg-black/30 px-2 py-1 rounded">
                                                        {new Date(action.timestamp).toLocaleTimeString()}
                                                    </div>
                                                </div>
                                                <div className="text-lg font-bold text-gray-100 mb-3 group-hover:text-blue-400 transition-colors">
                                                    {action.details.prompt_name || "System Operation"}
                                                </div>
                                                <div className="bg-black/40 rounded-xl p-4 border border-gray-700/50 overflow-hidden">
                                                    <pre className="text-[11px] text-blue-100/60 font-mono leading-relaxed overflow-x-auto custom-scrollbar">
                                                        {JSON.stringify(action.details, null, 2)}
                                                    </pre>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'memory' && (
                        <div className="p-6 max-w-5xl mx-auto space-y-8">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                        <Database className="text-purple-400" />
                                        Model Context & Memory
                                    </h2>
                                    <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-black">Persistent Persona learned over time</p>
                                </div>
                                <button
                                    onClick={handleClearMemory}
                                    disabled={clearing || !memory || Object.keys(memory).length === 0}
                                    className="flex items-center gap-2 px-6 py-3 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 rounded-2xl transition-all text-sm font-bold shadow-xl shadow-red-900/10 disabled:opacity-20 active:scale-95"
                                >
                                    {clearing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={18} />}
                                    Reset Profile
                                </button>
                            </div>

                            <div className="bg-gray-900/60 backdrop-blur-md rounded-3xl border border-gray-700/50 p-10 shadow-2xl relative group overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[100px] rounded-full"></div>
                                <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/5 blur-[120px] rounded-full"></div>

                                {(!memory || Object.keys(memory).length === 0) ? (
                                    <div className="text-center py-24 text-gray-500">
                                        <Clock size={64} className="mx-auto mb-6 opacity-5 animate-pulse" />
                                        <p className="text-xl font-medium tracking-tight">Your AI companion is still observing...</p>
                                        <p className="text-sm mt-3 text-gray-600 max-w-xs mx-auto">Conversations will automatically populate this persistent memory bank.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                                        {Object.entries(memory).map(([key, value]) => (
                                            <div key={key} className="bg-gray-800/40 border border-gray-700/40 p-5 rounded-2xl flex flex-col gap-3 hover:border-blue-500/40 transition-all hover:bg-gray-800/60 hover:shadow-lg group/item">
                                                <div className="flex justify-between items-center">
                                                    <div className="text-[10px] uppercase font-black text-gray-500 tracking-[0.2em]">{key}</div>
                                                    <CheckCircle2 size={14} className="text-blue-500/40 group-hover/item:text-blue-500 transition-colors" />
                                                </div>
                                                <div className="text-gray-200 text-sm leading-relaxed font-medium">
                                                    {typeof value === 'object'
                                                        ? <pre className="text-[10px] font-mono bg-black/20 p-2 rounded border border-gray-700/30 overflow-x-auto">{JSON.stringify(value, null, 2)}</pre>
                                                        : String(value)
                                                    }
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="bg-blue-600/5 border border-blue-500/20 rounded-3xl p-8 flex gap-6 items-center">
                                <div className="w-16 h-16 rounded-2xl bg-blue-600/10 flex items-center justify-center flex-shrink-0 animate-pulse">
                                    <Zap className="text-blue-400" size={32} />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-blue-400 font-bold tracking-tight">How automated memory works</h4>
                                    <p className="text-sm text-gray-500 leading-relaxed max-w-2xl">
                                        The underlying AI model automatically identifies contextually relevant signals during your chats—such as preferred frameworks, project names, or personal details—and stores them in this SQLite-backed vault. This information is then injected into future sessions to provide seamless personalization.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HistoryPage;
