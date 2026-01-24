"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Play, Copy, Check, Wand2, SearchCode, Binary, Sparkles, RefreshCcw } from 'lucide-react';
import { useAuth } from './AuthContext';
import MarkdownRenderer from './MarkdownRenderer';

interface ToolInterfaceProps {
    type: 'improve' | 'evaluate' | 'refactor';
}

const ToolInterface = ({ type }: ToolInterfaceProps) => {
    const { user } = useAuth();
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');
    const [loading, setLoading] = useState(false);
    const [models, setModels] = useState<{ model: string, name: string }[]>([]);
    const [selectedModel, setSelectedModel] = useState('llama3.1:latest');
    const [concise, setConcise] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const fetchModels = async () => {
            try {
                const res = await axios.get('http://localhost:5000/ollama_models?json=true');
                setModels(res.data.models || []);
            } catch (error) {
                console.error("Error fetching models:", error);
            }
        };
        fetchModels();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        setOutput('');
        setLoading(true);

        const endpoint = `http://localhost:5000/api/tools/${type}`;
        const payload: any = {
            model: selectedModel,
            [type === 'refactor' ? 'code' : 'prompt']: input
        };

        if (type === 'improve') {
            payload.concise = concise;
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(payload)
            });

            if (!response.body) throw new Error('No response body');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                setOutput(prev => prev + chunk);
            }

        } catch (error) {
            console.error(`${type} failed:`, error);
            setOutput(`Error: Failed to process request.`);
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(output);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getToolConfig = () => {
        switch (type) {
            case 'improve':
                return {
                    title: 'Improve Prompt',
                    description: 'Transform your basic prompt into a high-quality, structured instruction.',
                    icon: <Wand2 className="text-blue-400" size={24} />,
                    placeholder: 'Enter the prompt you want to improve...',
                    buttonText: 'Improve Prompt',
                    accentColor: 'blue'
                };
            case 'evaluate':
                return {
                    title: 'Evaluate Prompt',
                    description: 'Get a critical analysis and scoring of your prompt\'s effectiveness.',
                    icon: <SearchCode className="text-yellow-400" size={24} />,
                    placeholder: 'Enter the prompt you want to evaluate...',
                    buttonText: 'Evaluate Prompt',
                    accentColor: 'yellow'
                };
            case 'refactor':
                return {
                    title: 'Refactor Code',
                    description: 'Optimize your Python code for readability, performance, and best practices.',
                    icon: <Binary className="text-green-400" size={24} />,
                    placeholder: '# Paste your Python code here...\ndef slow_function(x):\n    return x*x',
                    buttonText: 'Refactor Code',
                    accentColor: 'green'
                };
        }
    };

    const config = getToolConfig();

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4 mb-2">
                <div className={`p-3 bg-${config.accentColor}-600/20 rounded-2xl border border-${config.accentColor}-500/30 shadow-lg`}>
                    {config.icon}
                </div>
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">{config.title}</h1>
                    <p className="text-gray-400 mt-1">{config.description}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Section */}
                <div className="flex flex-col space-y-4">
                    <div className="bg-gray-800 rounded-3xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col h-[500px]">
                        <div className="bg-gray-900/50 px-6 py-4 border-b border-gray-700 flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Input {type === 'refactor' ? 'Code' : 'Prompt'}</span>
                            <div className="flex items-center gap-4">
                                {type === 'improve' && (
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={concise}
                                            onChange={(e) => setConcise(e.target.checked)}
                                            className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500 transition-all"
                                        />
                                        <span className="text-xs font-bold text-gray-400 group-hover:text-blue-400 transition-colors">Be Concise</span>
                                    </label>
                                )}
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Model:</span>
                                    <select
                                        value={selectedModel}
                                        onChange={(e) => setSelectedModel(e.target.value)}
                                        className="bg-gray-800 text-white rounded-lg px-2 py-1 text-[10px] font-bold border border-gray-700 focus:border-blue-500 outline-none transition-colors"
                                    >
                                        {models.length > 0 ? (
                                            models.map(m => <option key={m.model} value={m.model}>{m.name}</option>)
                                        ) : (
                                            <option value="llama3.1:latest">llama3.1:latest</option>
                                        )}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={config.placeholder}
                            className={`flex-grow bg-transparent text-gray-100 p-6 focus:outline-none resize-none font-mono text-sm leading-relaxed custom-scrollbar`}
                        />
                        <div className="p-4 bg-gray-900/30 border-t border-gray-700">
                            <button
                                onClick={handleSubmit}
                                disabled={!input.trim() || loading}
                                className={`w-full bg-${config.accentColor === 'blue' ? 'blue' : config.accentColor === 'yellow' ? 'yellow-600' : 'green-600'} hover:scale-[1.02] active:scale-[0.98] text-white rounded-2xl py-4 font-black uppercase tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale`}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        <span>Processing...</span>
                                    </>
                                ) : (
                                    <>
                                        <Play size={18} fill="currentColor" />
                                        <span>{config.buttonText}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Output Section */}
                <div className="flex flex-col space-y-4">
                    <div className="bg-gray-850 rounded-3xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col h-[500px] relative group/output">
                        <div className="bg-gray-900/50 px-6 py-4 border-b border-gray-700 flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
                                <Sparkles size={12} className="text-yellow-400" /> Output
                            </span>
                            {output && (
                                <button
                                    onClick={handleCopy}
                                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
                                >
                                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                    {copied ? "Copied" : "Copy"}
                                </button>
                            )}
                        </div>
                        <div className="flex-grow p-6 overflow-y-auto custom-scrollbar bg-gray-950/30">
                            {loading && !output ? (
                                <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-50">
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin"></div>
                                        <RefreshCcw className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-500/40" size={16} />
                                    </div>
                                    <p className="text-[10px] uppercase font-black tracking-widest text-gray-600">Summoning Intelligence...</p>
                                </div>
                            ) : output ? (
                                <MarkdownRenderer content={output} />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full opacity-20 filter grayscale">
                                    {config.icon}
                                    <p className="text-xs font-bold mt-4 uppercase tracking-[0.2em]">Awaiting Creation</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ToolInterface;
