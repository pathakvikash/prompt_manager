"use client";

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import CodeBlock to avoid SSR issues and native module crashes during build
const CodeBlock = dynamic(() => import('./CodeBlock'), { ssr: false });

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

const MarkdownRenderer = ({ content, className = '' }: MarkdownRendererProps) => {
    return (
        <div className={`prose prose-invert max-w-none ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');

                        if (!inline && match) {
                            return (
                                <CodeBlock language={match[1]}>
                                    {String(children)}
                                </CodeBlock>
                            );
                        }

                        return (
                            <code className={`${className} bg-gray-800/50 px-1.5 py-0.5 rounded text-blue-400 font-mono text-sm border border-gray-700/50`} {...props}>
                                {children}
                            </code>
                        );
                    },
                    table({ children }) {
                        return (
                            <div className="overflow-x-auto my-6 border border-gray-800 rounded-2xl shadow-xl">
                                <table className="w-full text-sm text-left border-collapse bg-gray-900/40 backdrop-blur-sm">
                                    {children}
                                </table>
                            </div>
                        );
                    },
                    thead({ children }) {
                        return <thead className="bg-gray-800/50 border-b border-gray-700">{children}</thead>;
                    },
                    th({ children }) {
                        return <th className="px-6 py-4 font-black uppercase tracking-widest text-gray-400 text-[10px]">{children}</th>;
                    },
                    td({ children }) {
                        return <td className="px-6 py-4 border-b border-gray-800/50 text-gray-300 font-medium">{children}</td>;
                    },
                    blockquote({ children }) {
                        return (
                            <blockquote className="border-l-4 border-blue-600 bg-blue-600/5 px-6 py-4 my-6 rounded-r-2xl italic text-gray-400">
                                {children}
                            </blockquote>
                        );
                    },
                    ul({ children }) {
                        return <ul className="list-disc list-inside space-y-2 my-4 text-gray-300">{children}</ul>;
                    },
                    ol({ children }) {
                        return <ol className="list-decimal list-inside space-y-2 my-4 text-gray-300">{children}</ol>;
                    },
                    h1({ children }) {
                        return <h1 className="text-2xl font-black text-white mt-8 mb-4 tracking-tight border-b border-gray-800 pb-2">{children}</h1>;
                    },
                    h2({ children }) {
                        return <h2 className="text-xl font-bold text-white mt-6 mb-3 tracking-tight">{children}</h2>;
                    },
                    h3({ children }) {
                        return <h3 className="text-lg font-bold text-blue-400 mt-4 mb-2">{children}</h3>;
                    },
                    p({ children }) {
                        return <p className="mb-4 last:mb-0 leading-relaxed text-[15px] font-medium text-gray-300">{children}</p>;
                    },
                    a({ children, href }) {
                        return <a href={href} className="text-blue-400 hover:text-blue-300 underline underline-offset-4 transition-colors" target="_blank" rel="noopener noreferrer">{children}</a>;
                    }
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};

export default MarkdownRenderer;
