"use client";

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/components/AuthContext';
import { useRouter } from 'next/navigation';
import ChatInterface from "@/components/ChatInterface";
import axios from 'axios';
import { Loader2 } from 'lucide-react';

interface UserSettings {
    default_model: string;
    temperature: number;
    num_ctx: number;
    top_p: number;
    top_k: number;
    repeat_penalty: number;
}

export default function ChatPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [models, setModels] = useState<{ model: string, name: string }[]>([]);
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [fetching, setFetching] = useState(true);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    useEffect(() => {
        const fetchModels = async () => {
            if (!user) return;
            setFetching(true);
            try {
                const [modelRes, settingsRes] = await Promise.all([
                    axios.get('http://localhost:5000/ollama_models?json=true', { withCredentials: true }),
                    axios.get('http://localhost:5000/api/settings', { withCredentials: true })
                ]);
                setModels(modelRes.data.models || []);
                setSettings(settingsRes.data);
            } catch (error) {
                console.error("Error fetching chat data:", error);
            } finally {
                setFetching(false);
            }
        };

        if (user) {
            fetchModels();
        }
    }, [user]);

    // Filter out embedding models and sort preferred models to top - memoized to prevent recalculation
    // Must be called before any conditional returns to follow Rules of Hooks
    const availableModels = useMemo(() => {
        const filteredModels = models.filter((m: { name: string }) =>
            !m.name.includes('minilm') &&
            !m.name.includes('embed') &&
            !m.name.includes('bert')
        );

        const preferredOrder = ['llama3.1:latest', 'gemma', 'llama', 'mistral', 'mixtral'];

        const sortedModels = [...filteredModels].sort((a: { name: string }, b: { name: string }) => {
            const aIndex = preferredOrder.findIndex(p => a.name.toLowerCase().includes(p));
            const bIndex = preferredOrder.findIndex(p => b.name.toLowerCase().includes(p));

            if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
            if (aIndex !== -1) return -1;
            if (bIndex !== -1) return 1;
            return a.name.localeCompare(b.name);
        });

        return sortedModels.length > 0 ? sortedModels : [
            { model: 'llama3.1:latest', name: 'llama3.1:latest (Default)' },
            { model: 'llama3', name: 'llama3' }
        ];
    }, [models]);

    if (loading || (!user && !fetching)) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="animate-spin text-blue-500" size={48} />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="space-y-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-white mb-2">AI Chat</h1>
                <p className="text-gray-400">
                    Interact with your local LLMs via Ollama as <span className="text-blue-400 font-semibold">{user}</span>.
                </p>
            </div>

            {fetching ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="animate-spin text-blue-500" size={48} />
                </div>
            ) : (
                <ChatInterface
                    initialModels={availableModels}
                    defaultModel={settings?.default_model}
                />
            )}
        </div>
    );
}
