"use client";

import { Edit, Trash2, Copy, Check, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PromptVariableModal from './PromptVariableModal';

interface Prompt {
    name: string;
    content: string;
    category: string;
    tags: string[];
}

interface PromptCardProps {
    prompt: Prompt;
    onDelete: (name: string) => void;
}

const PromptCard = ({ prompt, onDelete }: PromptCardProps) => {
    const [copied, setCopied] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [variables, setVariables] = useState<string[]>([]);
    const router = useRouter();

    const handleCopy = () => {
        navigator.clipboard.writeText(prompt.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const detectVariables = () => {
        const regex = /\[\[(.*?)\]\]/g;
        const matches = [...prompt.content.matchAll(regex)];
        const uniqueVars = Array.from(new Set(matches.map(m => m[1])));
        return uniqueVars;
    };

    const handleChatClick = () => {
        const foundVars = detectVariables();
        if (foundVars.length > 0) {
            setVariables(foundVars);
            setIsModalOpen(true);
        } else {
            setVariables(foundVars);
            setIsModalOpen(true);
        }
    };

    const sendToChat = (finalContent: string, target: 'system' | 'input') => {
        localStorage.setItem('pending_prompt', finalContent);
        localStorage.setItem('pending_target', target);
        router.push('/chat');
    };

    const handleModalConfirm = (values: Record<string, string>, target: 'system' | 'input') => {
        let substitutedContent = prompt.content;
        Object.entries(values).forEach(([key, value]) => {
            const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\[\\[${escapedKey}\\]\\]`, 'g');
            substitutedContent = substitutedContent.replace(regex, value);
        });
        sendToChat(substitutedContent, target);
    };

    return (
        <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-700 hover:border-blue-500 transition-all group">
            <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-white truncate max-w-[200px]">{prompt.name}</h3>
                    <span className="text-[10px] uppercase font-black bg-blue-600/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded tracking-wider">{prompt.category}</span>
                </div>

                <p className="text-gray-400 text-sm mb-4 line-clamp-3 h-[60px] leading-relaxed">
                    {prompt.content}
                </p>

                <div className="flex flex-wrap gap-1 mb-4 h-[24px] overflow-hidden">
                    {prompt.tags.map(tag => (
                        <span key={tag} className="text-[10px] bg-gray-700/50 text-gray-400 px-1.5 py-0.5 rounded border border-gray-600/30">#{tag}</span>
                    ))}
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-gray-700">
                    <div className="flex gap-4">
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                        >
                            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                            <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
                        </button>

                        <button
                            onClick={handleChatClick}
                            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-bold transition-all hover:scale-105"
                        >
                            <MessageSquare size={14} fill="currentColor" className="fill-blue-400/20" />
                            <span>Chat</span>
                        </button>
                    </div>

                    <div className="flex gap-3">
                        <Link href={`/edit/${encodeURIComponent(prompt.name)}`} className="text-gray-400 hover:text-blue-400 transition-colors">
                            <Edit size={16} />
                        </Link>
                        <button
                            onClick={() => onDelete(prompt.name)}
                            className="text-gray-400 hover:text-red-400 transition-colors"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            </div>

            <PromptVariableModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                variables={variables}
                onConfirm={handleModalConfirm}
                promptName={prompt.name}
            />
        </div>
    );
};

export default PromptCard;
