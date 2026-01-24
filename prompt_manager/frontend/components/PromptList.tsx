"use client";

import { useState } from 'react';
import PromptCard from './PromptCard';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

interface Prompt {
    name: string;
    content: string;
    category: string;
    tags: string[];
}

interface PromptListProps {
    initialPrompts: Prompt[];
}

const PromptList = ({ initialPrompts }: PromptListProps) => {
    const [prompts, setPrompts] = useState<Prompt[]>(initialPrompts);
    const [searchQuery, setSearchQuery] = useState('');
    const router = useRouter();

    const handleDelete = async (name: string) => {
        if (confirm(`Are you sure you want to delete prompt "${name}"?`)) {
            try {
                await axios.post(`http://localhost:5000/delete/${encodeURIComponent(name)}?json=true`, {}, {
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });

                // Refresh list locally or via router
                setPrompts(prompts.filter(p => p.name !== name));
                router.refresh();
            } catch (error) {
                console.error("Failed to delete prompt", error);
                alert("Failed to delete prompt");
            }
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Using the backend search API directly or filtering client side? 
            // Implementation plan says "dashboard (Search + List)". 
            // Let's use backend search for scalability as per original app.

            // Note: backend expects query param 'query' on index route '/'
            // But we are in Next.js. We can call the backend API.
            // Wait, the backend index route returns HTML unless X-Requested-With is XMLHttpRequest.

            const response = await axios.get(`http://localhost:5000/?query=${encodeURIComponent(searchQuery)}&json=true`, {
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            // The backend returns HTML fragment usually for AJAX... wait.
            // Let's check web_ui.py.
            // Line 63: return render_template('_prompt_list.html', ...)
            // Ah, the original app returns HTML fragments because it was Server Side Rendered with Jinja.
            // We need it to return JSON for our Next.js app.

            // I need to update web_ui.py to return JSON if it detects a JSON request or we should add a specific API endpoint.
            // However, looking at web_ui.py, line 55: prompts = manager.search_prompts(search_query).
            // It then renders the template.

            // Workaround for now: client side filtering if we have all prompts? 
            // Or better: update web_ui.py to return JSON. I updated it to support CORS but I didn't change the return type of index route.

            // Let's filter client side for now if we assume initialPrompts is all prompts, 
            // BUT initialPrompts might just be the initial load.

            // Actually, for a proper React app, I should fetch data from an API.
            // I'll stick to client side filtering for the MVP if the list is small, 
            // OR I will refactor web_ui.py in a subsequent step to return JSON for index/search.

            // For now, let's filter client-side to keep momentum, and I'll add a task to "API-ify" the search endpoint fully.

            const lowerQuery = searchQuery.toLowerCase();
            const filtered = initialPrompts.filter(p =>
                p.name.toLowerCase().includes(lowerQuery) ||
                p.content.toLowerCase().includes(lowerQuery) ||
                p.category.toLowerCase().includes(lowerQuery) ||
                p.tags.some(t => t.toLowerCase().includes(lowerQuery))
            );
            setPrompts(filtered);

        } catch (error) {
            console.error("Search failed", error);
        }
    };

    // Effect to reset filters if query is empty
    const filteredPrompts = searchQuery.length > 0
        ? prompts.filter(p =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        : prompts;

    return (
        <div>
            <div className="mb-6">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search prompts..."
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg py-3 px-4 pl-10 text-white focus:outline-none focus:border-blue-500"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Search className="absolute left-3 top-3.5 text-gray-400" size={20} />
                </div>
            </div>

            {filteredPrompts.length === 0 ? (
                <div className="text-center text-gray-500 py-10">
                    No prompts found.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPrompts.map(prompt => (
                        <PromptCard key={prompt.name} prompt={prompt} onDelete={handleDelete} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default PromptList;
