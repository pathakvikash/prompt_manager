"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { useRouter } from 'next/navigation';
import PromptList from "@/components/PromptList";
import axios from 'axios';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [prompts, setPrompts] = useState([]);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchPrompts = async () => {
      if (!user) return;
      setFetching(true);
      try {
        const res = await axios.get('http://localhost:5000/?json=true');
        setPrompts(res.data);
      } catch (error) {
        console.error("Error fetching prompts:", error);
      } finally {
        setFetching(false);
      }
    };

    if (user) {
      fetchPrompts();
    }
  }, [user]);

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">My Prompts</h1>
          <p className="text-gray-400">Manage, organize, and optimize your LLM prompts for <span className="text-blue-400 font-semibold">{user}</span>.</p>
        </div>
      </div>

      {fetching ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
      ) : (
        <PromptList initialPrompts={prompts} />
      )}
    </div>
  );
}
