"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
    Settings,
    Shield,
    Clock,
    Loader2,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Bell,
    Lock,
    Unlock,
    RotateCcw,
    ChevronDown,
    Database,
    FolderOpen,
    Globe,
    Zap,
    Eye,
    BellRing,
    ShieldCheck,
    ShieldX,
    Cpu,
    Sliders,
    Layers
} from 'lucide-react';

// Types
interface Permissions {
    [tool: string]: {
        [action: string]: string;
    };
}

interface PendingAction {
    request_id: string;
    tool: string;
    action: string;
    params: Record<string, any>;
    user_id: string;
    created_at: string;
}

interface ActivityEntry {
    type: string;
    user_id: string;
    timestamp: string;
    tool: string;
    action: string;
    summary: string;
    details: Record<string, any>;
    permission_level: string | null;
    success: boolean | null;
}

const PERMISSION_LEVELS = [
    { value: 'auto', label: 'Auto', icon: Unlock, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
    { value: 'notify', label: 'Notify', icon: Bell, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
    { value: 'confirm', label: 'Confirm', icon: ShieldCheck, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
    { value: 'deny', label: 'Deny', icon: ShieldX, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
];

const TOOL_ICONS: Record<string, any> = {
    memory: Database,
    file: FolderOpen,
    web: Globe,
};

const SettingsPage = () => {
    const { user, loading } = useAuth();
    const router = useRouter();

    const [activities, setActivities] = useState<ActivityEntry[]>([]);
    const [models, setModels] = useState<{ model: string, name: string }[]>([]);
    const [settings, setSettings] = useState<{
        default_model: string;
        temperature: number;
        num_ctx: number;
        top_p: number;
        top_k: number;
        repeat_penalty: number;
    } | null>(null);
    const [fetching, setFetching] = useState(true);
    const [activeTab, setActiveTab] = useState<'permissions' | 'pending' | 'activity' | 'model'>('permissions');
    const [permissions, setPermissions] = useState<Permissions | null>(null);
    const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
    const [updating, setUpdating] = useState<string | null>(null);
    const [expandedTool, setExpandedTool] = useState<string | null>(null);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    const fetchData = async () => {
        setFetching(true);
        try {
            const [permRes, pendingRes, activityRes, modelRes, settingsRes] = await Promise.all([
                axios.get('http://localhost:5000/api/permissions', { withCredentials: true }),
                axios.get('http://localhost:5000/api/pending-actions', { withCredentials: true }),
                axios.get('http://localhost:5000/api/activity', { withCredentials: true }),
                axios.get('http://localhost:5000/ollama_models?json=true', { withCredentials: true }),
                axios.get('http://localhost:5000/api/settings', { withCredentials: true }),
            ]);
            setPermissions(permRes.data);
            setPendingActions(pendingRes.data.pending || []);
            setActivities(activityRes.data.activities || []);
            setModels(modelRes.data.models || []);
            setSettings(settingsRes.data);
        } catch (error) {
            console.error("Failed to fetch settings data:", error);
        } finally {
            setFetching(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    const handlePermissionChange = async (tool: string, action: string, level: string) => {
        const key = `${tool}-${action}`;
        setUpdating(key);
        try {
            await axios.post('http://localhost:5000/api/permissions',
                { tool, action, level },
                { withCredentials: true }
            );
            // Update local state
            setPermissions(prev => prev ? {
                ...prev,
                [tool]: { ...prev[tool], [action]: level }
            } : null);
        } catch (error) {
            console.error("Failed to update permission:", error);
        } finally {
            setUpdating(null);
        }
    };

    const handleResetPermissions = async () => {
        if (!confirm("Reset all permissions to defaults?")) return;
        try {
            await axios.post('http://localhost:5000/api/permissions/reset', {}, { withCredentials: true });
            await fetchData();
        } catch (error) {
            console.error("Failed to reset permissions:", error);
        }
    };

    const handleApprove = async (requestId: string) => {
        try {
            await axios.post(`http://localhost:5000/api/pending-actions/${requestId}/approve`, {}, { withCredentials: true });
            setPendingActions(prev => prev.filter(p => p.request_id !== requestId));
            await fetchData(); // Refresh activity
        } catch (error) {
            console.error("Failed to approve action:", error);
        }
    };

    const handleDeny = async (requestId: string) => {
        try {
            await axios.post(`http://localhost:5000/api/pending-actions/${requestId}/deny`, {}, { withCredentials: true });
            setPendingActions(prev => prev.filter(p => p.request_id !== requestId));
        } catch (error) {
            console.error("Failed to deny action:", error);
        }
    };

    const getPermissionConfig = (level: string) => {
        return PERMISSION_LEVELS.find(p => p.value === level) || PERMISSION_LEVELS[0];
    };

    const getActivityIcon = (type: string, success: boolean | null) => {
        if (success === false) return <XCircle size={16} className="text-red-400" />;
        if (type.includes('memory')) return <Database size={16} className="text-purple-400" />;
        if (type.includes('file')) return <FolderOpen size={16} className="text-blue-400" />;
        if (type.includes('web')) return <Globe size={16} className="text-green-400" />;
        if (type === 'tool_pending') return <Clock size={16} className="text-yellow-400" />;
        return <Zap size={16} className="text-gray-400" />;
    };

    if (loading || (fetching && !permissions)) {
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
                        <Settings className="text-blue-500" />
                        AI Settings
                    </h1>
                    <p className="text-gray-400 mt-1">Manage AI tool permissions and activity for <span className="text-blue-400 font-medium">{user}</span></p>
                </div>

                <button
                    onClick={handleResetPermissions}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 rounded-xl transition-all text-sm font-bold"
                >
                    <RotateCcw size={16} />
                    Reset to Defaults
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-800">
                <button
                    onClick={() => setActiveTab('permissions')}
                    className={`px-8 py-4 text-sm font-black uppercase tracking-widest transition-all relative ${activeTab === 'permissions' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <div className="flex items-center gap-2">
                        <Shield size={16} />
                        Permissions
                    </div>
                    {activeTab === 'permissions' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>}
                </button>
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`px-8 py-4 text-sm font-black uppercase tracking-widest transition-all relative ${activeTab === 'pending' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <div className="flex items-center gap-2">
                        <Clock size={16} />
                        Pending
                        {pendingActions.length > 0 && (
                            <span className="ml-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full border border-yellow-500/30">
                                {pendingActions.length}
                            </span>
                        )}
                    </div>
                    {activeTab === 'pending' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>}
                </button>
                <button
                    onClick={() => setActiveTab('activity')}
                    className={`px-8 py-4 text-sm font-black uppercase tracking-widest transition-all relative ${activeTab === 'activity' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <div className="flex items-center gap-2">
                        <Zap size={16} />
                        Activity Log
                    </div>
                    {activeTab === 'activity' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 shadow-[0_0_10_rgba(59,130,246,0.5)]"></div>}
                </button>
                <button
                    onClick={() => setActiveTab('model')}
                    className={`px-8 py-4 text-sm font-black uppercase tracking-widest transition-all relative ${activeTab === 'model' ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <div className="flex items-center gap-2">
                        <Cpu size={16} />
                        AI Model
                    </div>
                    {activeTab === 'model' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>}
                </button>
            </div>

            {/* Content */}
            <div className="min-h-[400px]">
                {/* Permissions Tab */}
                {activeTab === 'permissions' && permissions && (
                    <div className="space-y-6">
                        {/* Permission Level Legend */}
                        <div className="flex flex-wrap gap-4 p-4 bg-gray-900/40 rounded-2xl border border-gray-800/50">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Permission Levels:</span>
                            {PERMISSION_LEVELS.map(level => {
                                const Icon = level.icon;
                                return (
                                    <div key={level.value} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${level.bg} border ${level.border}`}>
                                        <Icon size={14} className={level.color} />
                                        <span className={`text-xs font-bold ${level.color}`}>{level.label}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Tool Permissions */}
                        <div className="grid gap-4">
                            {Object.entries(permissions).map(([tool, actions]) => {
                                const ToolIcon = TOOL_ICONS[tool] || Settings;
                                const isExpanded = expandedTool === tool;

                                return (
                                    <div key={tool} className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl overflow-hidden">
                                        <button
                                            onClick={() => setExpandedTool(isExpanded ? null : tool)}
                                            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-700/30 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                                                    <ToolIcon size={20} />
                                                </div>
                                                <div className="text-left">
                                                    <h3 className="text-lg font-bold text-white capitalize">{tool} Tool</h3>
                                                    <p className="text-xs text-gray-500">{Object.keys(actions).length} actions</p>
                                                </div>
                                            </div>
                                            <ChevronDown size={20} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                        </button>

                                        {isExpanded && (
                                            <div className="px-6 pb-4 space-y-3 animate-in slide-in-from-top duration-200">
                                                {Object.entries(actions).map(([action, level]) => {
                                                    const key = `${tool}-${action}`;
                                                    const currentConfig = getPermissionConfig(level);

                                                    return (
                                                        <div key={action} className="flex items-center justify-between p-4 bg-gray-900/50 rounded-xl border border-gray-700/30">
                                                            <div className="flex items-center gap-3">
                                                                <code className="text-sm font-mono text-gray-300 bg-black/30 px-2 py-1 rounded">{action}</code>
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                {updating === key && <Loader2 size={14} className="animate-spin text-blue-400" />}

                                                                <div className="flex bg-gray-900 rounded-xl p-1 border border-gray-700/50">
                                                                    {PERMISSION_LEVELS.map(permLevel => {
                                                                        const Icon = permLevel.icon;
                                                                        const isActive = level === permLevel.value;

                                                                        return (
                                                                            <button
                                                                                key={permLevel.value}
                                                                                onClick={() => handlePermissionChange(tool, action, permLevel.value)}
                                                                                disabled={updating === key}
                                                                                className={`p-2 rounded-lg transition-all ${isActive
                                                                                    ? `${permLevel.bg} ${permLevel.border} border`
                                                                                    : 'hover:bg-gray-800'
                                                                                    }`}
                                                                                title={permLevel.label}
                                                                            >
                                                                                <Icon size={16} className={isActive ? permLevel.color : 'text-gray-600'} />
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Info Box */}
                        <div className="bg-blue-600/5 border border-blue-500/20 rounded-2xl p-6 flex gap-4 items-start">
                            <div className="p-3 bg-blue-600/10 rounded-xl">
                                <Shield className="text-blue-400" size={24} />
                            </div>
                            <div>
                                <h4 className="text-blue-400 font-bold">How Permissions Work</h4>
                                <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                                    <span className="text-green-400 font-bold">Auto:</span> Executes immediately without notification.
                                    <span className="text-blue-400 font-bold ml-2">Notify:</span> Executes and logs to activity.
                                    <span className="text-yellow-400 font-bold ml-2">Confirm:</span> Requires your approval before executing.
                                    <span className="text-red-400 font-bold ml-2">Deny:</span> Never allows this action.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Pending Actions Tab */}
                {activeTab === 'pending' && (
                    <div className="space-y-4">
                        {pendingActions.length === 0 ? (
                            <div className="text-center py-20 text-gray-500 border border-dashed border-gray-800 rounded-3xl">
                                <CheckCircle2 size={48} className="mx-auto mb-4 opacity-10" />
                                <p className="text-lg font-medium">No pending actions</p>
                                <p className="text-xs mt-1">Actions requiring approval will appear here</p>
                            </div>
                        ) : (
                            pendingActions.map((pending) => (
                                <div key={pending.request_id} className="bg-gray-800/40 border border-yellow-500/30 rounded-2xl p-6 animate-in fade-in duration-300">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-yellow-500/10 rounded-xl">
                                                <AlertTriangle className="text-yellow-400" size={24} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black uppercase text-yellow-400 tracking-widest bg-yellow-400/10 border border-yellow-500/30 px-3 py-1 rounded-full">
                                                        Awaiting Approval
                                                    </span>
                                                </div>
                                                <h3 className="text-lg font-bold text-white mt-2">
                                                    {pending.tool}.{pending.action}()
                                                </h3>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Requested {new Date(pending.created_at).toLocaleString()}
                                                </p>
                                                {Object.keys(pending.params).length > 0 && (
                                                    <div className="mt-3 p-3 bg-black/30 rounded-xl border border-gray-700/50">
                                                        <pre className="text-xs text-gray-400 font-mono overflow-x-auto">
                                                            {JSON.stringify(pending.params, null, 2)}
                                                        </pre>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex gap-2 flex-shrink-0">
                                            <button
                                                onClick={() => handleApprove(pending.request_id)}
                                                className="flex items-center gap-2 px-4 py-2 bg-green-600/10 hover:bg-green-600 text-green-400 hover:text-white border border-green-500/30 rounded-xl transition-all text-sm font-bold"
                                            >
                                                <CheckCircle2 size={16} />
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => handleDeny(pending.request_id)}
                                                className="flex items-center gap-2 px-4 py-2 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 rounded-xl transition-all text-sm font-bold"
                                            >
                                                <XCircle size={16} />
                                                Deny
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Activity Log Tab */}
                {activeTab === 'activity' && (
                    <div className="space-y-4">
                        {activities.length === 0 ? (
                            <div className="text-center py-20 text-gray-500 border border-dashed border-gray-800 rounded-3xl">
                                <Zap size={48} className="mx-auto mb-4 opacity-10" />
                                <p className="text-lg font-medium">No activity yet</p>
                                <p className="text-xs mt-1">Tool usage will be logged here</p>
                            </div>
                        ) : (
                            <div className="relative border-l-2 border-gray-800 ml-6 space-y-6 py-4">
                                {activities.slice().reverse().map((activity, idx) => (
                                    <div key={idx} className="relative pl-10 animate-in slide-in-from-left duration-300" style={{ animationDelay: `${idx * 30}ms` }}>
                                        <div className={`absolute left-[-11px] top-4 w-5 h-5 rounded-full bg-gray-900 border-2 ${activity.success === false ? 'border-red-500' : 'border-blue-500'} flex items-center justify-center`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${activity.success === false ? 'bg-red-500' : 'bg-blue-500'} shadow-[0_0_8px_rgba(59,130,246,1)]`}></div>
                                        </div>

                                        <div className={`bg-gray-800/60 backdrop-blur-sm border ${activity.success === false ? 'border-red-500/30' : 'border-gray-700/50'} p-4 rounded-2xl`}>
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex items-center gap-3">
                                                    {getActivityIcon(activity.type, activity.success)}
                                                    <div>
                                                        <span className="text-sm font-bold text-white">
                                                            {activity.summary}
                                                        </span>
                                                        {activity.permission_level && (
                                                            <span className={`ml-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${getPermissionConfig(activity.permission_level).bg
                                                                } ${getPermissionConfig(activity.permission_level).color}`}>
                                                                {activity.permission_level}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-mono text-gray-600 whitespace-nowrap">
                                                    {new Date(activity.timestamp).toLocaleTimeString()}
                                                </span>
                                            </div>

                                            {activity.success === false && activity.details?.error && (
                                                <div className="mt-2 text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">
                                                    {activity.details.error}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* AI Model Tab */}
                {activeTab === 'model' && settings && (
                    <div className="max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Model Configuration */}
                        <div className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-8 space-y-8">
                            <div className="flex items-center gap-4 border-b border-gray-700/50 pb-6">
                                <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
                                    <Cpu size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Model Configuration</h2>
                                    <p className="text-sm text-gray-500">Global defaults for all AI interactions</p>
                                </div>
                            </div>

                            <div className="grid gap-8">
                                {/* Default Model */}
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-gray-400 flex items-center gap-2">
                                        <Layers size={16} className="text-blue-500" />
                                        Default LLM Model
                                    </label>
                                    <select
                                        value={settings.default_model}
                                        onChange={(e) => {
                                            const newVal = e.target.value;
                                            setSettings(s => s ? { ...s, default_model: newVal } : null);
                                            axios.post('http://localhost:5000/api/settings', { default_model: newVal }, { withCredentials: true });
                                        }}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    >
                                        {models.map(m => (
                                            <option key={m.model} value={m.model}>{m.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 italic">Preferred model used when starting a new chat.</p>
                                </div>

                                {/* Tuning Parameters */}
                                <div className="grid md:grid-cols-2 gap-8 pt-4 border-t border-gray-800/50">
                                    {/* Temperature */}
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <label className="text-sm font-bold text-gray-400 flex items-center gap-2">
                                                <Zap size={16} className="text-yellow-500" />
                                                Temperature
                                            </label>
                                            <span className="text-xs font-mono text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">{settings.temperature}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="2"
                                            step="0.1"
                                            value={settings.temperature}
                                            onChange={(e) => {
                                                const newVal = parseFloat(e.target.value);
                                                setSettings(s => s ? { ...s, temperature: newVal } : null);
                                                axios.post('http://localhost:5000/api/settings', { temperature: newVal }, { withCredentials: true });
                                            }}
                                            className="w-full accent-blue-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                        />
                                        <div className="flex justify-between text-[10px] text-gray-600 font-bold uppercase tracking-tighter">
                                            <span>Precise</span>
                                            <span>Creative</span>
                                        </div>
                                    </div>

                                    {/* Context Length */}
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <label className="text-sm font-bold text-gray-400 flex items-center gap-2">
                                                <Database size={16} className="text-purple-500" />
                                                Context Length
                                            </label>
                                            <span className="text-xs font-mono text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">{settings.num_ctx}</span>
                                        </div>
                                        <select
                                            value={settings.num_ctx}
                                            onChange={(e) => {
                                                const newVal = parseInt(e.target.value);
                                                setSettings(s => s ? { ...s, num_ctx: newVal } : null);
                                                axios.post('http://localhost:5000/api/settings', { num_ctx: newVal }, { withCredentials: true });
                                            }}
                                            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                        >
                                            <option value={2048}>2,048 (Low Memory)</option>
                                            <option value={4096}>4,096 (Standard)</option>
                                            <option value={8192}>8,192 (High Context)</option>
                                            <option value={16384}>16,384 (Extended)</option>
                                            <option value={32768}>32,768 (Turbo)</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Advanced Parameters */}
                                <div className="grid grid-cols-3 gap-4 border-t border-gray-800/50 pt-8">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Top-P</label>
                                        <input
                                            type="number"
                                            step="0.05"
                                            value={settings.top_p}
                                            onChange={(e) => {
                                                const newVal = parseFloat(e.target.value);
                                                setSettings(s => s ? { ...s, top_p: newVal } : null);
                                                axios.post('http://localhost:5000/api/settings', { top_p: newVal }, { withCredentials: true });
                                            }}
                                            className="w-full bg-black/40 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Top-K</label>
                                        <input
                                            type="number"
                                            value={settings.top_k}
                                            onChange={(e) => {
                                                const newVal = parseInt(e.target.value);
                                                setSettings(s => s ? { ...s, top_k: newVal } : null);
                                                axios.post('http://localhost:5000/api/settings', { top_k: newVal }, { withCredentials: true });
                                            }}
                                            className="w-full bg-black/40 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Penalty</label>
                                        <input
                                            type="number"
                                            step="0.05"
                                            value={settings.repeat_penalty}
                                            onChange={(e) => {
                                                const newVal = parseFloat(e.target.value);
                                                setSettings(s => s ? { ...s, repeat_penalty: newVal } : null);
                                                axios.post('http://localhost:5000/api/settings', { repeat_penalty: newVal }, { withCredentials: true });
                                            }}
                                            className="w-full bg-black/40 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Note */}
                        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-6 flex gap-4 items-start">
                            <div className="p-3 bg-yellow-500/10 rounded-xl">
                                <Sliders className="text-yellow-400" size={24} />
                            </div>
                            <div>
                                <h4 className="text-yellow-400 font-bold">Model Tuning Info</h4>
                                <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                                    Higher <b>Temperature</b> results in more creative but unpredictable output.
                                    <b> Context Length</b> determines how much past conversation the AI remembers, but uses more memory.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettingsPage;
