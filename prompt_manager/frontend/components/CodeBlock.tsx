"use client";

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface CodeBlockProps {
    language: string;
    children: string;
}

export default function CodeBlock({ language, children }: CodeBlockProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        const codeString = children.replace(/\n$/, '');
        navigator.clipboard.writeText(codeString);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative group/code my-4">
            <div className="absolute right-3 top-3 z-10 opacity-0 group-hover/code:opacity-100 transition-opacity">
                <button
                    onClick={handleCopy}
                    className="p-2 bg-gray-800/80 hover:bg-gray-700 rounded-lg border border-gray-600/50 text-gray-400 hover:text-white transition-all backdrop-blur-sm"
                    title="Copy code"
                >
                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                </button>
            </div>
            <SyntaxHighlighter
                style={oneDark}
                language={language}
                PreTag="div"
                className="rounded-2xl !bg-gray-950 !p-6 border border-gray-800 shadow-2xl font-mono text-sm leading-relaxed"
            >
                {children}
            </SyntaxHighlighter>
        </div>
    );
}
