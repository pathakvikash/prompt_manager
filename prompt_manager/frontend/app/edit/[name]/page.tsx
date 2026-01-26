"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import PromptForm from "@/components/PromptForm";
import axios from 'axios';
import { Loader2 } from 'lucide-react';

export default function EditPromptPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const [prompt, setPrompt] = useState<{ name: string, content: string, category: string, tags: string[] } | undefined>(undefined);
    const [fetching, setFetching] = useState(false);

    const name = params?.name as string;

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    useEffect(() => {
        const fetchPrompt = async () => {
            if (!user || !name) return;
            setFetching(true);
            try {
                const decodedName = decodeURIComponent(name);
                const res = await axios.get(`http://localhost:5000/edit/${encodeURIComponent(decodedName)}?json=true`);
                setPrompt(res.data);
            } catch (error) {
                console.error("Error fetching prompt:", error);
            } finally {
                setFetching(false);
            }
        };

        if (user && name) {
            fetchPrompt();
        }
    }, [user, name]);

    if (loading || (fetching && !prompt)) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="animate-spin text-blue-500" size={48} />
            </div>
        );
    }

    if (!user) return null;

    if (!prompt && !fetching && name) {
        return (
            <div className="text-red-500 text-center py-20">
                <h1 className="text-2xl font-bold">Prompt not found</h1>
                <p>The prompt could not be found or you don't have access.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-white mb-2">Edit Prompt</h1>
                <p className="text-gray-400">Updating prompt for <span className="text-blue-400">{user}</span></p>
            </div>

            {prompt && <PromptForm initialData={prompt} isEdit={true} />}
        </div>
    );
}
