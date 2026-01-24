"use client";

import { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import axios from 'axios';
import {
    Send,
    User,
    Bot,
    Loader2,
    BookOpen,
    Search,
    Square,
    Trash2,
    Plus,
    PanelLeftClose,
    PanelLeftOpen,
    Clock,
    ChevronRight,
    X,
    Brain,
    FileCode,
    Activity,
    ChevronDown,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    ShieldAlert
} from 'lucide-react';
import PromptVariableModal from './PromptVariableModal';
import MarkdownRenderer from './MarkdownRenderer';
import ToolActivity from './ToolActivity';

interface Prompt {
    name: string;
    content: string;
    category: string;
    tags: string[];
}

interface ChatSession {
    user_id: string;
    session_id?: string;
    timestamp: string;
    messages: { role: string, content: string, timestamp: string }[];
}

interface PendingAction {
    request_id: string;
    tool: string;
    action: string;
    params: Record<string, any>;
}

interface ComponentProps {
    initialModels: { model: string, name: string }[];
    defaultModel?: string;
}

// Pre-compiled regex patterns for better performance
// Optimized to prevent catastrophic backtracking by using more specific patterns
const TAG_REGEX = /<(thought|think|tool_call|tool_pending|tool_result|tool|answer)(?:\s+([^>]*?))?>(?:([^<]*(?:<(?![\/]?\1)[^<]*)*?)(?:<\/\1>|$))?|<(tool_pending)\s+([^>]*?)\s*\/>/g;
const NAME_ATTR_REGEX = /name=["'](.*?)["']/;
const ARGUMENT_REGEX = /<argument\s+name=["'](.*?)["']\s+value=["'](.*?)["']\s*\/?>/g;
const DEEP_ARG_REGEX = /<([a-zA-Z0-9_]+)>([\s\S]*?)<\/\1>/g;
const ATTR_REGEX_CACHE: Record<string, RegExp> = {};

// Helper to get attribute from tag content
const getAttr = (tagContent: string, name: string): string | null => {
    if (!ATTR_REGEX_CACHE[name]) {
        ATTR_REGEX_CACHE[name] = new RegExp(`${name}=["'](.*?)["']`);
    }
    const m = tagContent.match(ATTR_REGEX_CACHE[name]);
    return m ? m[1] : null;
};

// Parse message content into parts with safety limits
const parseMessageContent = (content: string): { type: string, content: string, isStreaming?: boolean }[] => {
    if (!content || content.trim().length === 0) {
        return [{ type: 'text', content: '' }];
    }

    // Safety limit: prevent processing extremely large content
    const MAX_CONTENT_LENGTH = 1000000; // 1MB limit
    if (content.length > MAX_CONTENT_LENGTH) {
        console.warn('Content too large, truncating for parsing');
        content = content.substring(0, MAX_CONTENT_LENGTH);
    }

    const parts: { type: string, content: string, isStreaming?: boolean }[] = [];
    const tagRegex = new RegExp(TAG_REGEX.source, TAG_REGEX.flags);
    let lastIndex = 0;
    let match;
    let iterations = 0;
    const MAX_ITERATIONS = 10000; // Prevent infinite loops

    while ((match = tagRegex.exec(content)) !== null) {
        iterations++;
        if (iterations > MAX_ITERATIONS) {
            console.error('Regex parsing exceeded iteration limit, breaking');
            break;
        }
        
        // Safety check: prevent infinite loop if lastIndex doesn't advance
        if (match.index === lastIndex && match[0].length === 0) {
            console.error('Regex stuck, advancing lastIndex');
            lastIndex++;
            continue;
        }
        // Add text before the match
        const textBefore = content.slice(lastIndex, match.index);
        if (textBefore.trim()) {
            parts.push({ type: 'text', content: textBefore });
        }

        const fullTag = match[0];
        const type = match[1] || match[4]; // Combined tag or self-closing
        const tagAttrs = match[2] || '';
        const tagInner = match[3] || '';

        if (type === 'thought' || type === 'think') {
            parts.push({
                type: 'thought',
                content: tagInner,
                isStreaming: !fullTag.endsWith(`</${type}>`)
            });
        } else if (type === 'tool_call' || type === 'tool') {
            let toolContent = tagInner;

            // If it's the alternative <tool name="..."> format, wrap it into a structured JSON for ToolActivity
            if (type === 'tool' && tagAttrs.includes('name=')) {
                const nameMatch = tagAttrs.match(NAME_ATTR_REGEX);
                const toolName = nameMatch ? nameMatch[1] : 'unknown';

                // Try to extract arguments from inner XML if it's not JSON
                if (!tagInner.trim().startsWith('{')) {
                    const args: any = {};
                    // Sub-pattern A: <argument name="..." value="..." />
                    const argMatches = tagInner.matchAll(ARGUMENT_REGEX);
                    for (const am of argMatches) {
                        args[am[1]] = am[2];
                    }
                    // Sub-pattern B: <key>value</key>
                    if (Object.keys(args).length === 0) {
                        const deepArgMatches = tagInner.matchAll(DEEP_ARG_REGEX);
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
            const requestId = getAttr(tagContent, 'request_id');
            const tool = getAttr(tagContent, 'tool');
            const action = getAttr(tagContent, 'action');
            const paramsB64 = getAttr(tagContent, 'params_b64');

            if (requestId && tool && action && paramsB64) {
                try {
                    // Trim and handle potential whitespace/newlines in the B64 string
                    const cleanB64 = paramsB64.trim().replace(/\s/g, '');
                    const params = JSON.parse(atob(cleanB64));
                    parts.push({
                        type: 'pending',
                        content: JSON.stringify({ request_id: requestId, tool, action, params })
                    });
                } catch (e) {
                    console.error("Failed to parse pending b64:", e, paramsB64);
                }
            }
        } else if (type === 'tool_result') {
            // Hide tool results from UI but keep in parts if needed
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

    return cleanedParts;
};

const ChatInterface = ({ initialModels, defaultModel }: ComponentProps) => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<{ role: string, content: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [model, setModel] = useState(defaultModel || initialModels[0]?.model || 'llama3.1:latest');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [showPromptSelector, setShowPromptSelector] = useState(false);
    const [allPrompts, setAllPrompts] = useState<Prompt[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Sidebar & History
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [votedActions, setVotedActions] = useState<Record<string, 'approved' | 'denied'>>({});
    const [history, setHistory] = useState<ChatSession[]>([]);
    const [sessionId, setSessionId] = useState<string>('');
    const abortControllerRef = useRef<AbortController | null>(null);

    // For manual selection variable handling
    const [selectedPromptForModal, setSelectedPromptForModal] = useState<Prompt | null>(null);
    const [variables, setVariables] = useState<string[]>([]);
    const [isVariableModalOpen, setIsVariableModalOpen] = useState(false);
    const [serverPendingCount, setServerPendingCount] = useState(0);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Memoize parsed message parts to avoid re-parsing on every render
    const parsedMessages = useMemo(() => {
        return messages.map(msg => ({
            ...msg,
            parts: msg.role === 'assistant' ? parseMessageContent(msg.content) : null
        }));
    }, [messages]);

    const generateSessionId = () => {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    };

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    const fetchHistory = useCallback(async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/history', { withCredentials: true });
            setHistory(res.data.chat_history || []);
        } catch (error) {
            console.error("Failed to fetch history:", error);
        }
    }, []);

    const fetchPendingCount = useCallback(async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/pending-actions', { withCredentials: true });
            setServerPendingCount(res.data.pending?.length || 0);
        } catch (error) {
            console.error("Failed to fetch pending actions count:", error);
        }
    }, []);

    useEffect(() => {
        // Initialize session ID
        setSessionId(generateSessionId());

        // Check for pending prompt from dashboard
        const pending = localStorage.getItem('pending_prompt');
        const target = localStorage.getItem('pending_target');

        if (pending) {
            if (target === 'input') {
                setInput(pending);
            } else {
                setSystemPrompt(pending);
            }
            localStorage.removeItem('pending_prompt');
            localStorage.removeItem('pending_target');
        }

        if (defaultModel) {
            setModel(defaultModel);
        }

        fetchHistory();
        fetchPendingCount();

        // Polling for pending actions - debounced to avoid excessive calls
        const interval = setInterval(fetchPendingCount, 10000);
        return () => clearInterval(interval);
    }, [defaultModel, fetchHistory, fetchPendingCount]);

    const fetchAllPrompts = useCallback(async () => {
        try {
            const res = await axios.get('http://localhost:5000/?json=true');
            setAllPrompts(res.data);
        } catch (error) {
            console.error("Failed to fetch prompts:", error);
        }
    }, []);

    useEffect(() => {
        if (showPromptSelector) {
            fetchAllPrompts();
        }
    }, [showPromptSelector, fetchAllPrompts]);

    const handleSelectPrompt = (prompt: Prompt) => {
        const regex = /\[\[(.*?)\]\]/g;
        const matches = [...prompt.content.matchAll(regex)];
        const uniqueVars = Array.from(new Set(matches.map(m => m[1])));

        setVariables(uniqueVars);
        setSelectedPromptForModal(prompt);
        setIsVariableModalOpen(true);
        setShowPromptSelector(false);
    };

    const handleVariableConfirm = (values: Record<string, string>, target: 'system' | 'input') => {
        if (!selectedPromptForModal) return;

        let substitutedContent = selectedPromptForModal.content;
        Object.entries(values).forEach(([key, value]) => {
            const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\[\\[${escapedKey}\\]\\]`, 'g');
            substitutedContent = substitutedContent.replace(regex, value);
        });

        if (target === 'system') {
            setSystemPrompt(substitutedContent);
        } else {
            setInput(substitutedContent);
        }
    };

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setLoading(false);
        }
    };

    const handleDeleteMessage = async (index: number) => {
        if (!sessionId) {
            setMessages(prev => prev.filter((_, i) => i !== index));
            return;
        }

        try {
            await axios.post('http://localhost:5000/api/history/delete_message', {
                session_id: sessionId,
                index: index
            }, { withCredentials: true });

            setMessages(prev => prev.filter((_, i) => i !== index));
            fetchHistory();
        } catch (error) {
            console.error("Failed to delete message:", error);
            alert("Failed to delete message from server.");
        }
    };

    const handleDeleteSession = async (e: React.MouseEvent, targetSessionId: string) => {
        e.stopPropagation();
        if (!confirm("Permanently delete this chat session?")) return;

        try {
            await axios.post('http://localhost:5000/api/history/delete_session', {
                session_id: targetSessionId
            }, { withCredentials: true });

            if (sessionId === targetSessionId) {
                handleNewChat();
            }
            fetchHistory();
        } catch (error) {
            console.error("Failed to delete session:", error);
            alert("Failed to delete session from server.");
        }
    };

    const handleNewChat = () => {
        if (messages.length > 0 && !confirm("Start a new chat? This will clear current messages.")) return;
        setMessages([]);
        setInput('');
        setSystemPrompt('');
        setSessionId(generateSessionId());
    };

    const handleLoadSession = (session: ChatSession) => {
        setMessages(session.messages.map(m => ({ role: m.role, content: m.content })));
        setSessionId(session.session_id || generateSessionId());
        setSidebarOpen(false);
    };

    const handleSubmit = async (e?: React.FormEvent, customPrompt?: string) => {
        if (e) e.preventDefault();
        const promptToUse = customPrompt || input;
        if (!promptToUse.trim() || loading) return;

        // Reset and create new AbortController
        abortControllerRef.current = new AbortController();

        const userMessage = { role: 'user', content: promptToUse };
        const currentMessages = [...messages, userMessage];
        setMessages(currentMessages);
        if (!customPrompt) setInput('');
        setLoading(true);

        try {
            const response = await fetch('http://localhost:5000/generate_text?json=true', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'include',
                signal: abortControllerRef.current.signal,
                body: JSON.stringify({
                    model: model,
                    prompt: userMessage.content,
                    system_prompt: systemPrompt,
                    messages: currentMessages.slice(0, -1), // Previous history
                    session_id: sessionId
                })
            });

            if (!response.body) throw new Error('No response body');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

            let accumulatedResponse = '';
            let chunkCount = 0;
            const MAX_CHUNKS = 100000; // Prevent infinite streaming
            const MAX_RESPONSE_LENGTH = 5000000; // 5MB limit
            let lastUpdateTime = Date.now();
            const UPDATE_THROTTLE_MS = 50; // Throttle updates to every 50ms

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                chunkCount++;
                if (chunkCount > MAX_CHUNKS) {
                    console.error('Stream exceeded max chunks, breaking');
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                accumulatedResponse += chunk;

                // Safety: prevent unbounded memory growth
                if (accumulatedResponse.length > MAX_RESPONSE_LENGTH) {
                    console.warn('Response too large, truncating');
                    accumulatedResponse = accumulatedResponse.substring(0, MAX_RESPONSE_LENGTH) + '\n...[truncated]';
                    break;
                }

                // Throttle state updates to prevent excessive re-renders
                const now = Date.now();
                if (now - lastUpdateTime >= UPDATE_THROTTLE_MS) {
                    setMessages(prev => {
                        const newMessages = [...prev];
                        const lastMsg = newMessages[newMessages.length - 1];
                        if (lastMsg.role === 'assistant') {
                            lastMsg.content = accumulatedResponse;
                        }
                        return newMessages;
                    });
                    lastUpdateTime = now;
                }
            }

            // Final update to ensure all content is displayed
            setMessages(prev => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];
                if (lastMsg.role === 'assistant') {
                    lastMsg.content = accumulatedResponse;
                }
                return newMessages;
            });

            // Refresh history after a successful turn
            fetchHistory();

        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('Fetch aborted');
            } else {
                console.error('Chat error:', error);
                setMessages(prev => [...prev, { role: 'assistant', content: 'Error: Failed to generate response.' }]);
            }
        } finally {
            setLoading(false);
            abortControllerRef.current = null;
        }
    };

    const handleApproveAction = async (pending: PendingAction) => {
        setVotedActions(prev => ({ ...prev, [pending.request_id]: 'approved' }));
        try {
            const res = await axios.post(`http://localhost:5000/api/pending-actions/${pending.request_id}/approve`, {}, { withCredentials: true });
            const result = res.data.result;
            fetchPendingCount();
            const followUp = `USER APPROVED: The action was APPROVED. Tool Result: ${JSON.stringify(result)}. 
            
CRITICAL: Please provide a clear, user-friendly summary of what was accomplished (e.g., "I've written the file test.txt with your content"). If there was an error in the tool output, explain it concisely.`;
            handleSubmit(undefined, followUp);
        } catch (error) {
            console.error("Failed to approve action:", error);
            alert("Approval failed.");
        }
    };

    const handleDenyAction = async (pending: PendingAction) => {
        setVotedActions(prev => ({ ...prev, [pending.request_id]: 'denied' }));
        try {
            await axios.post(`http://localhost:5000/api/pending-actions/${pending.request_id}/deny`, {}, { withCredentials: true });
            fetchPendingCount();
            const followUp = `The user DENIED the action. Inform the user you cannot proceed with that specific action and explain if necessary.`;
            handleSubmit(undefined, followUp);
        } catch (error) {
            console.error("Failed to deny action:", error);
            alert("Denial failed.");
        }
    };

    const PendingActionBlock = ({ pending }: { pending: PendingAction }) => {
        const status = votedActions[pending.request_id];

        return (
            <div className="my-6 p-1 bg-yellow-500/10 rounded-[2rem] border border-yellow-500/20 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4 duration-500 group/pending">
                <div className="bg-gray-900/40 rounded-[1.8rem] p-6 border border-white/5">
                    <div className="flex items-start gap-5">
                        <div className={`p-4 rounded-2xl ${status === 'approved' ? 'bg-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.2)]' : status === 'denied' ? 'bg-red-500/20 shadow-[0_0_20px_rgba(239,44,44,0.2)]' : 'bg-yellow-500/20 shadow-[0_0_20px_rgba(234,179,8,0.2)]'} transition-all duration-500`}>
                            <ShieldAlert className={status === 'approved' ? 'text-green-400' : status === 'denied' ? 'text-red-400' : 'text-yellow-400'} size={28} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                                <div className="flex items-center gap-3">
                                    <span className="px-3 py-1 bg-yellow-500 text-black text-[10px] font-black uppercase tracking-widest rounded-full">Awaiting Approval</span>
                                    <h4 className="text-white font-black text-lg uppercase tracking-tight">{pending.tool}.{pending.action}()</h4>
                                </div>
                                {status && (
                                    <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {status}
                                    </span>
                                )}
                            </div>
                            <p className="text-gray-500 text-xs font-medium mb-5">Security check: This action requires your explicit confirmation</p>

                            <div className="p-4 bg-black/40 rounded-2xl border border-white/5 font-mono text-xs text-gray-400 overflow-hidden relative">
                                <div className="absolute top-3 right-4 opacity-20 pointer-events-none uppercase font-black text-[10px] tracking-[0.2em]">Payload</div>
                                <pre className="custom-scrollbar overflow-x-auto">
                                    {JSON.stringify(pending.params, null, 2)}
                                </pre>
                            </div>

                            {!status && (
                                <div className="grid grid-cols-2 gap-3 mt-6">
                                    <button
                                        onClick={() => handleApproveAction(pending)}
                                        className="flex items-center justify-center gap-3 py-3.5 bg-green-600 hover:bg-green-500 text-white rounded-2xl transition-all font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-green-900/20 hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        <CheckCircle2 size={16} strokeWidth={3} />
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => handleDenyAction(pending)}
                                        className="flex items-center justify-center gap-3 py-3.5 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 rounded-2xl transition-all font-black text-xs uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        <XCircle size={16} strokeWidth={3} />
                                        Deny
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const filteredPrompts = allPrompts.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex h-[740px] bg-gray-900 rounded-3xl shadow-2xl border border-gray-800 overflow-hidden relative group/chat">
            {/* Sidebar */}
            <div className={`flex-shrink-0 bg-gray-900 border-r border-gray-800 transition-all duration-300 ease-in-out ${sidebarOpen ? 'w-[280px]' : 'w-0 overflow-hidden border-r-0'}`}>
                <div className="w-[280px] h-full flex flex-col p-4">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">Recent Chats</h3>
                        <button onClick={() => setSidebarOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                            <PanelLeftClose size={18} />
                        </button>
                    </div>
                    <div className="flex-grow overflow-y-auto space-y-2 custom-scrollbar pr-2">
                        {history.length === 0 ? (
                            <div className="text-center py-10 opacity-20">
                                <Clock size={32} className="mx-auto mb-2" />
                                <p className="text-xs font-bold">No history yet</p>
                            </div>
                        ) : (
                            history.map((session, i) => (
                                <div
                                    key={i}
                                    onClick={() => handleLoadSession(session)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => e.key === 'Enter' && handleLoadSession(session)}
                                    className="w-full group/item text-left p-3 rounded-xl bg-gray-800/40 hover:bg-blue-600/10 border border-gray-800 hover:border-blue-500/30 transition-all animate-in slide-in-from-left duration-200 cursor-pointer"
                                    style={{ animationDelay: `${i * 30}ms` }}
                                >
                                    <div className="text-[10px] text-gray-500 font-mono mb-1">{new Date(session.timestamp).toLocaleDateString()}</div>
                                    <div className="text-xs font-bold text-gray-300 truncate group-hover/item:text-blue-400 transition-colors">
                                        {session.messages[0]?.content || "Empty chat"}
                                    </div>
                                    <div className="text-[10px] text-gray-600 mt-1 flex items-center justify-between">
                                        <span>{session.messages.length} msg</span>
                                        <div className="flex items-center gap-2 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => handleDeleteSession(e, session.session_id || '')}
                                                className="p-1 hover:text-red-500 transition-colors"
                                                title="Delete Session"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                            <ChevronRight size={10} />
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-grow flex flex-col h-full bg-gray-800 relative">
                {/* Header */}
                <div className="p-4 border-b border-gray-700 bg-gray-900/40 backdrop-blur-md flex flex-wrap gap-4 items-center">
                    {!sidebarOpen && (
                        <button onClick={() => setSidebarOpen(true)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all" title="Open History">
                            <PanelLeftOpen size={20} />
                        </button>
                    )}

                    <button
                        onClick={handleNewChat}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/20 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                    >
                        <Plus size={14} /> New Chat
                    </button>

                    {serverPendingCount > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-xl animate-pulse shadow-[0_0_15px_rgba(234,179,8,0.1)]">
                            <ShieldAlert size={14} />
                            <span className="text-[10px] font-black uppercase tracking-widest">{serverPendingCount} Pending Attention</span>
                        </div>
                    )}

                    <div className="h-4 border-l border-gray-700 mx-1 hidden sm:block"></div>

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Model:</span>
                        <select
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            className="bg-gray-900 text-white rounded-xl px-3 py-1.5 text-xs font-bold border border-gray-700 focus:border-blue-500 outline-none transition-colors"
                        >
                            {initialModels.map(m => (
                                <option key={m.model} value={m.model}>{m.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex-grow flex items-center gap-2">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Role:</span>
                        <input
                            type="text"
                            placeholder="System Persona..."
                            className="bg-gray-900 text-white rounded-xl px-3 py-1.5 text-xs font-bold border border-gray-700 focus:border-blue-500 outline-none flex-grow transition-colors"
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={() => setShowPromptSelector(!showPromptSelector)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 border border-gray-700 rounded-xl text-xs font-bold text-gray-300 hover:text-white transition-all shadow-sm"
                        title="Load Template"
                    >
                        <BookOpen size={16} className="text-blue-400" />
                        <span className="hidden lg:inline">Templates</span>
                    </button>
                </div>

                {/* Prompt Selector Overlay */}
                {showPromptSelector && (
                    <div className="absolute inset-0 z-50 bg-gray-950/95 backdrop-blur-md p-6 flex flex-col animate-in fade-in slide-in-from-top-6 duration-300">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                    <BookOpen className="text-blue-500" />
                                    Prompt Library
                                </h2>
                                <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-black">Select a starting template</p>
                            </div>
                            <button onClick={() => setShowPromptSelector(false)} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-xl transition-all">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="relative mb-8 max-w-2xl">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                            <input
                                type="text"
                                placeholder="Search by name, category, or tags..."
                                className="w-full bg-gray-900 border border-gray-800 rounded-2xl pl-12 pr-6 py-4 text-white focus:outline-none focus:border-blue-500 focus:ring-1 ring-blue-500/20 shadow-2xl transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="flex-grow overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pb-8 custom-scrollbar">
                            {filteredPrompts.map(p => (
                                <button
                                    key={p.name}
                                    onClick={() => handleSelectPrompt(p)}
                                    className="flex flex-col text-left p-5 bg-gray-900 border border-gray-800 rounded-3xl hover:border-blue-500/50 hover:bg-gray-800/80 transition-all group/card relative overflow-hidden"
                                >
                                    <div className="text-[10px] uppercase font-black text-blue-500 mb-2 tracking-widest">{p.category}</div>
                                    <div className="text-sm font-bold text-white mb-2 group-hover/card:text-blue-400 transition-colors">{p.name}</div>
                                    <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed">{p.content}</p>
                                    <div className="absolute bottom-0 right-0 p-3 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                        <div className="bg-blue-600 rounded-lg p-1.5"><ChevronRight size={14} className="text-white" /></div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Messages Area */}
                <div className="flex-grow overflow-y-auto p-6 md:p-8 space-y-8 bg-gray-800/60 custom-scrollbar">
                    {messages.length === 0 && (
                        <div className="text-center text-gray-500 mt-20 flex flex-col items-center">
                            <div className="w-20 h-20 bg-gray-900/50 rounded-3xl flex items-center justify-center mb-6 border border-gray-700 shadow-inner">
                                <Bot size={40} className="text-blue-500/20" />
                            </div>
                            <p className="text-xl font-medium tracking-tight opacity-40 italic">New Session Initialized</p>
                            <p className="text-xs text-gray-700 uppercase tracking-widest font-black mt-2">Waiting for input...</p>
                        </div>
                    )}
                    {messages.map((msg, idx) => {
                        // Use stable key based on message content hash for better React reconciliation
                        const msgKey = `${idx}-${msg.role}-${msg.content.substring(0, 50).replace(/\s/g, '')}`;
                        return (
                        <div key={msgKey} className={`flex gap-4 group/msg ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-3 duration-300`}>
                            {msg.role === 'assistant' && (
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-900/30 border border-blue-500/20">
                                    <Bot size={22} className="text-white" />
                                </div>
                            )}

                            <div className="relative group/content max-w-[85%]">
                                <div className={`rounded-3xl p-5 shadow-inner transition-all relative ${msg.role === 'user'
                                    ? 'bg-blue-600 text-white rounded-br-none'
                                    : 'bg-gray-900 text-gray-300 rounded-bl-none border border-gray-700/50'
                                    }`}>
                                    {msg.role === 'assistant' ? (
                                        <div className="space-y-1">
                                            {(() => {
                                                const parsedMsg = parsedMessages[idx];
                                                const parts = parsedMsg?.parts || [];
                                                
                                                return (
                                                    <>
                                                        {parts.map((p, i) => {
                                                            if (p.type === 'text') {
                                                                return <MarkdownRenderer key={`${idx}-${i}`} content={p.content} />;
                                                            }
                                                            if (p.type === 'pending') {
                                                                return <PendingActionBlock key={`${idx}-${i}`} pending={JSON.parse(p.content)} />;
                                                            }
                                                            return <ToolActivity key={`${idx}-${i}`} type={p.type as any} content={p.content} isThinking={p.isStreaming} />;
                                                        })}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    ) : (
                                        <p className="whitespace-pre-wrap text-[15px] leading-relaxed font-medium">{msg.content}</p>
                                    )}

                                    {/* Inline Actions */}
                                    <button
                                        onClick={() => handleDeleteMessage(idx)}
                                        className={`absolute top-0 ${msg.role === 'user' ? '-left-10' : '-right-10'} p-2 text-gray-500 hover:text-red-500 opacity-0 group-hover/msg:opacity-100 transition-all hover:bg-gray-700/50 rounded-xl z-30`}
                                        title="Delete message"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            {msg.role === 'user' && (
                                <div className="w-10 h-10 rounded-2xl bg-gray-700 border border-gray-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                                    <User size={22} className="text-white" />
                                </div>
                            )}
                        </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-6 md:p-8 border-t border-gray-700 bg-gray-900/60 backdrop-blur-md">
                    <form onSubmit={handleSubmit} className="flex gap-4 max-w-5xl mx-auto items-end">
                        <div className="flex-grow relative group">
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Draft your message... (Shift + Enter for new line)"
                                rows={1}
                                className="w-full bg-gray-900 text-white rounded-2xl px-6 py-4 border border-gray-800 focus:border-blue-500 outline-none transition-all resize-none min-h-[56px] max-h-[300px] shadow-2xl custom-scrollbar"
                                disabled={loading}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSubmit(e as any);
                                    }
                                }}
                            />
                        </div>

                        {loading ? (
                            <button
                                type="button"
                                onClick={handleStop}
                                className="bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-2xl p-4 transition-all shadow-xl active:scale-95 flex-shrink-0 border border-red-500/20 group/stop"
                                title="Stop Generation"
                            >
                                <Square size={20} className="fill-current" />
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={!input.trim()}
                                className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl p-4 disabled:opacity-30 disabled:grayscale transition-all shadow-xl active:scale-95 flex-shrink-0"
                            >
                                <Send size={24} />
                            </button>
                        )}
                    </form>
                    <div className="max-w-5xl mx-auto mt-3 flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 px-6">
                        <span>Streaming Active</span>
                        <span>{model} context</span>
                    </div>
                </div>

                {/* Variable Modal for manual selection */}
                {selectedPromptForModal && (
                    <PromptVariableModal
                        isOpen={isVariableModalOpen}
                        onClose={() => setIsVariableModalOpen(false)}
                        variables={variables}
                        onConfirm={handleVariableConfirm}
                        promptName={selectedPromptForModal.name}
                    />
                )}
            </div>
        </div>
    );
};

export default ChatInterface;
