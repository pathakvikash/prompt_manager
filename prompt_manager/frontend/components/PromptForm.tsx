"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

interface PromptFormProps {
    initialData?: {
        name: string;
        content: string;
        category: string;
        tags: string[];
    };
    isEdit?: boolean;
}

const PromptForm = ({ initialData, isEdit = false }: PromptFormProps) => {
    const router = useRouter();
    const [formData, setFormData] = useState({
        name: '',
        content: '',
        category: 'Uncategorized',
        tags: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                content: initialData.content,
                category: initialData.category,
                tags: initialData.tags.join(', ')
            });
        }
    }, [initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Assuming Backend runs on port 5000
            const apiUrl = 'http://localhost:5000';
            const endpoint = (isEdit ? `/edit/${encodeURIComponent(initialData!.name)}` : '/add_prompt') + '?json=true';

            const payload = {
                name: formData.name,
                content: formData.content,
                category: formData.category,
                tags: formData.tags
            };

            await axios.post(`${apiUrl}${endpoint}`, payload, {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest', // Important for Flask to treat as API
                    'Content-Type': 'application/json'
                }
            });

            router.push('/');
            router.refresh();
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700 max-w-2xl mx-auto">
            {error && (
                <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-2 rounded mb-4">
                    {error}
                </div>
            )}

            <div className="mb-4">
                <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="name">
                    Name
                </label>
                <input
                    className="bg-gray-700 border border-gray-600 rounded w-full py-2 px-3 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                    id="name"
                    name="name"
                    type="text"
                    placeholder="Prompt Name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    disabled={isEdit} // Name is primary key, usually not editable or handled differently
                />
            </div>

            <div className="mb-4">
                <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="category">
                    Category
                </label>
                <input
                    className="bg-gray-700 border border-gray-600 rounded w-full py-2 px-3 text-white focus:outline-none focus:border-blue-500"
                    id="category"
                    name="category"
                    type="text"
                    placeholder="e.g., Coding, Writing"
                    value={formData.category}
                    onChange={handleChange}
                />
            </div>

            <div className="mb-4">
                <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="tags">
                    Tags (comma separated)
                </label>
                <input
                    className="bg-gray-700 border border-gray-600 rounded w-full py-2 px-3 text-white focus:outline-none focus:border-blue-500"
                    id="tags"
                    name="tags"
                    type="text"
                    placeholder="tag1, tag2"
                    value={formData.tags}
                    onChange={handleChange}
                />
            </div>

            <div className="mb-6">
                <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="content">
                    Content
                </label>
                <textarea
                    className="bg-gray-700 border border-gray-600 rounded w-full py-2 px-3 text-white h-48 focus:outline-none focus:border-blue-500 font-mono"
                    id="content"
                    name="content"
                    placeholder="Entry prompt content here..."
                    value={formData.content}
                    onChange={handleChange}
                    required
                />
            </div>

            <div className="flex items-center justify-end">
                <button
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded focus:outline-none focus:shadow-outline transition-colors disabled:opacity-50"
                    type="submit"
                    disabled={loading}
                >
                    {loading ? 'Saving...' : (isEdit ? 'Update Prompt' : 'Create Prompt')}
                </button>
            </div>
        </form>
    );
};

export default PromptForm;
