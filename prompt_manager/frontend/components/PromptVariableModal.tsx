"use client";

import { useState } from 'react';
import { X, Play, MessageSquare, ShieldCheck } from 'lucide-react';

interface PromptVariableModalProps {
    isOpen: boolean;
    onClose: () => void;
    variables: string[];
    onConfirm: (values: Record<string, string>, target: 'system' | 'input') => void;
    promptName: string;
}

const PromptVariableModal = ({ isOpen, onClose, variables, onConfirm, promptName }: PromptVariableModalProps) => {
    const [values, setValues] = useState<Record<string, string>>(
        variables.reduce((acc, v) => ({ ...acc, [v]: '' }), {})
    );
    const [target, setTarget] = useState<'system' | 'input'>('system');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(values, target);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-4 border-b border-gray-700">
                    <h2 className="text-lg font-bold text-white uppercase tracking-tight">Configure: {promptName}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-6">
                        {variables.length > 0 && (
                            <div className="space-y-4">
                                <p className="text-sm text-gray-400">This prompt contains dynamic variables. Please fill them in:</p>
                                {variables.map(variable => (
                                    <div key={variable}>
                                        <label className="block text-xs font-semibold text-blue-400 mb-1 uppercase">
                                            {variable}
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                            placeholder={`Enter value for ${variable}...`}
                                            value={values[variable] || ''}
                                            onChange={(e) => setValues({ ...values, [variable]: e.target.value })}
                                            required
                                            autoFocus
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="pt-2">
                            <label className="block text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">
                                Choose Insertion Target
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setTarget('system')}
                                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${target === 'system'
                                            ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                                            : 'bg-gray-700/50 border-gray-600 text-gray-400 hover:border-gray-500'
                                        }`}
                                >
                                    <ShieldCheck size={20} />
                                    <span className="text-xs font-bold">System Prompt</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTarget('input')}
                                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${target === 'input'
                                            ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                                            : 'bg-gray-700/50 border-gray-600 text-gray-400 hover:border-gray-500'
                                        }`}
                                >
                                    <MessageSquare size={20} />
                                    <span className="text-xs font-bold">User Message</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-gray-900/50 rounded-b-xl border-t border-gray-700 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95"
                        >
                            <Play size={16} fill="currentColor" />
                            Send to Chat
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PromptVariableModal;
