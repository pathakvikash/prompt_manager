import { useState, useEffect } from 'react';
import {
    Brain,
    FileCode,
    Activity,
    ChevronDown,
    ChevronRight,
    ShieldAlert
} from 'lucide-react';

interface ToolActivityProps {
    type: 'thought' | 'tool';
    content: string;
    isThinking?: boolean;
}

const ToolActivity = ({ type, content, isThinking }: ToolActivityProps) => {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (isThinking) {
            setIsOpen(true);
        }
    }, [isThinking]);

    const getParsedData = () => {
        try {
            const data = JSON.parse(content);
            const toolName = (data?.tool || data?.name || '').toLowerCase();
            if (['terminate', 'alise', 'assistant', 'stop'].includes(toolName)) {
                return 'FILTERED';
            }
            return data;
        } catch (e) {
            return null;
        }
    };

    const getIcon = () => {
        if (type === 'thought') return <Brain size={14} className="text-purple-400" />;
        if (type === 'pending' as any) return <ShieldAlert size={14} className="text-yellow-400" />;
        const data = getParsedData();
        if (data === 'FILTERED') return null;
        const toolName = (data?.tool || data?.name || '').toLowerCase();

        if (toolName.includes('file')) return <FileCode size={14} className="text-blue-400" />;
        if (toolName.includes('memory')) return <Activity size={14} className="text-green-400" />;
        return <Activity size={14} className="text-amber-400" />;
    };

    const getLabel = () => {
        if (type === 'thought') return isThinking ? "Thinking..." : "Thought";
        if (type === 'pending' as any) return "Permission Request";
        const data = getParsedData();
        if (data === 'FILTERED') return null;
        const toolName = (data?.tool || data?.name || '').toUpperCase();
        const actionName = (data?.action || data?.arguments?.action || '').toUpperCase();

        if (actionName && toolName) {
            return `${actionName} ${toolName}`;
        }
        if (toolName) return `${toolName} ACTION`;
        return isThinking ? "Calling Tool..." : "Tool Call";
    };

    const renderContent = () => {
        if (type === 'thought') return content;
        const data = getParsedData();
        if (data === 'FILTERED') return null;
        return data ? JSON.stringify(data, null, 2) : content;
    };

    const data = getParsedData();
    if (data === 'FILTERED') return null;

    return (
        <div className="mb-2 last:mb-4">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-950/40 hover:bg-gray-950 border border-gray-800 rounded-xl text-[11px] font-bold text-gray-500 transition-all group shadow-sm"
            >
                {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {getIcon()}
                <span className="uppercase tracking-widest">{getLabel()}</span>
            </button>
            {isOpen && (
                <div className="mt-2 ml-6 p-3 bg-gray-950/50 border border-gray-800 rounded-xl text-xs font-mono text-gray-500 overflow-x-auto whitespace-pre-wrap animate-in slide-in-from-top-1 duration-200">
                    {renderContent()}
                </div>
            )}
        </div>
    );
};

export default ToolActivity;
