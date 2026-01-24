"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface AuthContextType {
    user: string | null;
    login: (username: string) => Promise<void>;
    logout: () => Promise<void>;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Set global axios defaults for credentials
axios.defaults.withCredentials = true;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const checkUser = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/me', { 
                withCredentials: true,
                timeout: 5000 // 5 second timeout to prevent hanging
            });
            if (res.data.user_id && res.data.user_id !== 'anonymous') {
                setUser(res.data.user_id);
            } else {
                setUser(null);
            }
        } catch (error: any) {
            // Silently handle auth errors - backend might not be running or user not logged in
            // Only log if it's not a network error (which is expected if backend is down)
            if (error.code !== 'ECONNREFUSED' && error.code !== 'ERR_NETWORK') {
                console.error("Auth check failed:", error.message || error);
            }
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkUser();
    }, []);

    const login = async (username: string) => {
        try {
            await axios.post('http://localhost:5000/login', { user_id: username }, {
                withCredentials: true,
                timeout: 5000
            });
            setUser(username);
        } catch (error: any) {
            console.error("Login failed:", error.message || error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            await axios.post('http://localhost:5000/logout', {}, {
                withCredentials: true,
                timeout: 5000
            });
            setUser(null);
        } catch (error: any) {
            // Even if logout fails, clear local user state
            setUser(null);
            if (error.code !== 'ECONNREFUSED' && error.code !== 'ERR_NETWORK') {
                console.error("Logout failed:", error.message || error);
            }
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
