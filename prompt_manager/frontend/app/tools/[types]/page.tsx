"use client";

import { use } from 'react';
import { useAuth } from '@/components/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import ToolInterface from '@/components/ToolInterface';
import { Loader2 } from 'lucide-react';

export default function ToolPage({ params }: { params: Promise<{ type: string }> }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const { type } = use(params);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading || (!user)) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="animate-spin text-blue-500" size={48} />
            </div>
        );
    }

    if (!['improve', 'evaluate', 'refactor'].includes(type)) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <h1 className="text-4xl font-black text-red-500 uppercase tracking-tighter">404</h1>
                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Tool Not Found</p>
                <button
                    onClick={() => router.push('/')}
                    className="mt-8 px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-all font-bold text-xs uppercase"
                >
                    Back to Home
                </button>
            </div>
        );
    }

    return (
        <div className="py-4">
            <ToolInterface type={type as 'improve' | 'evaluate' | 'refactor'} />
        </div>
    );
}
