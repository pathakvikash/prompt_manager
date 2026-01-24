"use client";

import Link from 'next/link';
import { Home, PlusCircle, MessageSquare, LogIn, LogOut, User, Sparkles, History as HistoryIcon, Wrench, ChevronDown, Wand2, SearchCode, Binary, Settings } from 'lucide-react';
import { useAuth } from '@/components/AuthContext';
import { useRouter } from 'next/navigation';

const Header = () => {
    const { user, logout } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        await logout();
        router.push('/login');
    };

    return (
        <header className="bg-gray-800 border-b border-gray-700 p-4 sticky top-0 z-50 shadow-md">
            <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                <Link href="/" className="flex items-center gap-2 group">
                    <div className="bg-blue-600 p-1.5 rounded-lg group-hover:bg-blue-500 transition-colors">
                        <MessageSquare className="text-white" size={24} />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-white group-hover:text-blue-400 transition-colors flex items-center gap-2">
                        Prompt Manager
                        <Sparkles size={16} className="text-yellow-400 animate-pulse" />
                    </span>
                </Link>

                <nav className="flex items-center gap-1">
                    <Link href="/" className="flex items-center gap-2 px-4 py-2 hover:bg-gray-700/50 rounded-lg transition-colors text-gray-300 hover:text-white">
                        <Home size={18} />
                        <span className="hidden sm:inline">Home</span>
                    </Link>
                    <Link href="/add" className="flex items-center gap-2 px-4 py-2 hover:bg-gray-700/50 rounded-lg transition-colors text-gray-300 hover:text-white">
                        <PlusCircle size={18} />
                        <span className="hidden sm:inline">Add</span>
                    </Link>
                    <Link href="/chat" className="flex items-center gap-2 px-4 py-2 hover:bg-gray-700/50 rounded-lg transition-colors text-gray-300 hover:text-white">
                        <MessageSquare size={18} />
                        <span className="hidden sm:inline">Chat</span>
                    </Link>
                    <Link href="/history" className="flex items-center gap-2 px-4 py-2 hover:bg-gray-700/50 rounded-lg transition-colors text-gray-300 hover:text-white">
                        <HistoryIcon size={18} />
                        <span className="hidden sm:inline">History</span>
                    </Link>

                    {/* Tools Dropdown */}
                    <div className="relative group/dropdown">
                        <button className="flex items-center gap-2 px-4 py-2 hover:bg-gray-700/50 rounded-lg transition-colors text-gray-300 hover:text-white">
                            <Wrench size={18} />
                            <span className="hidden sm:inline">Tools</span>
                            <ChevronDown size={14} className="group-hover/dropdown:rotate-180 transition-transform duration-200" />
                        </button>
                        <div className="absolute top-full left-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl opacity-0 invisible group-hover/dropdown:opacity-100 group-hover/dropdown:visible transition-all duration-200 z-[60] overflow-hidden">
                            <Link href="/tools/improve" className="flex items-center gap-3 px-4 py-3 hover:bg-blue-600/10 text-gray-300 hover:text-blue-400 transition-colors border-b border-gray-700/50">
                                <Wand2 size={16} />
                                <span className="text-sm font-medium">Improve Prompt</span>
                            </Link>
                            <Link href="/tools/evaluate" className="flex items-center gap-3 px-4 py-3 hover:bg-blue-600/10 text-gray-300 hover:text-blue-400 transition-colors border-b border-gray-700/50">
                                <SearchCode size={16} />
                                <span className="text-sm font-medium">Evaluate Prompt</span>
                            </Link>
                            <Link href="/tools/refactor" className="flex items-center gap-3 px-4 py-3 hover:bg-blue-600/10 text-gray-300 hover:text-blue-400 transition-colors">
                                <Binary size={16} />
                                <span className="text-sm font-medium">Refactor Code</span>
                            </Link>
                        </div>
                    </div>

                    <Link href="/settings" className="flex items-center gap-2 px-4 py-2 hover:bg-gray-700/50 rounded-lg transition-colors text-gray-300 hover:text-white">
                        <Settings size={18} />
                        <span className="hidden sm:inline">Settings</span>
                    </Link>

                    <div className="ml-2 pl-2 border-l border-gray-700 flex items-center gap-4">
                        {user ? (
                            <>
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/10 text-blue-400 rounded-full border border-blue-500/20 text-sm font-medium">
                                    <User size={14} />
                                    <span>{user}</span>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                                    title="Logout"
                                >
                                    <LogOut size={18} />
                                </button>
                            </>
                        ) : (
                            <Link href="/login" className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all font-medium">
                                <LogIn size={18} />
                                <span>Sign In</span>
                            </Link>
                        )}
                    </div>
                </nav>
            </div>
        </header>
    );
};

export default Header;
