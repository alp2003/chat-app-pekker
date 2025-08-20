"use client";

import { useEffect, useState } from "react";
import { apiGet, apiGetData } from "./api";

export interface User {
    id: string;
    username: string;
    displayName?: string;
}

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        const checkAuth = async (retryCount = 0) => {
            try {
                const userData = await apiGetData<User>("/auth/check");
                if (mounted) {
                    setUser(userData);
                    setError(null);
                }
            } catch (err: any) {
                if (mounted) {
                    // If authentication fails, user needs to log in again
                    setUser(null);
                    setError(err.message || "Authentication failed");
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        checkAuth();

        return () => {
            mounted = false;
        };
    }, []);

    const logout = async () => {
        try {
            await apiGet("/auth/logout");
            setUser(null);
            setError(null);
        } catch (err: any) {
            setError(err.message || "Logout failed");
        }
    };

    return {
        user,
        loading,
        error,
        isAuthenticated: !!user,
        logout
    };
}
