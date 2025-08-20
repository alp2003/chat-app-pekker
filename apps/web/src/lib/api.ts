import { Conversation, Message } from "./types/chat";

const BASE = "/api"; // goes through Next BFF: /app/api/[...path]/route.ts

type Json = Record<string, any> | any[];

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshToken(): Promise<boolean> {
    try {
        const response = await fetch("/api/auth/refresh", {
            method: "POST",
            credentials: "include"
        });
        return response.ok;
    } catch (error) {
        console.error("Token refresh failed:", error);
        return false;
    }
}

async function apiFetch<T = any>(
    path: string,
    options: RequestInit = {}
): Promise<Response> {
    const makeRequest = () =>
        fetch(`/api${path}`, {
            credentials: "include", // Important for httpOnly cookies
            ...options
        });

    let res = await makeRequest();

    // If we get 401 and it's not the refresh endpoint, try to refresh the token
    if (res.status === 401 && !path.includes("/auth/refresh")) {
        if (!isRefreshing) {
            isRefreshing = true;
            refreshPromise = refreshToken();
        }

        if (refreshPromise) {
            const refreshSuccess = await refreshPromise;
            isRefreshing = false;
            refreshPromise = null;

            if (refreshSuccess) {
                // Wait for cookies to be properly set by the browser
                await new Promise((resolve) => setTimeout(resolve, 150));

                // Make a completely fresh request with new credentials
                res = await fetch(`/api${path}`, {
                    credentials: "include",
                    ...options
                });
            }
        }
    }

    // Some endpoints may return 204/empty
    const text = await res.text();
    const contentType = res.headers.get("content-type") || "";

    if (text.length === 0 || res.status === 204) {
        return res;
    }

    if (contentType.includes("application/json")) {
        // Create a new response with the parsed JSON
        return new Response(text, {
            status: res.status,
            statusText: res.statusText,
            headers: res.headers
        });
    }

    return res;
}

export function apiGet<T>(path: string, init?: RequestInit) {
    return apiFetch<T>(path, { method: "GET", ...(init || {}) });
}

export function apiPost<T>(path: string, data?: Json, init?: RequestInit) {
    return apiFetch<T>(path, {
        method: "POST",
        body: data !== undefined ? JSON.stringify(data) : undefined,
        headers: {
            "content-type": "application/json",
            ...(init?.headers || {})
        },
        ...(init || {})
    });
}

export function apiPut<T>(path: string, data?: Json, init?: RequestInit) {
    return apiFetch<T>(path, {
        method: "PUT",
        body: data !== undefined ? JSON.stringify(data) : undefined,
        headers: {
            "content-type": "application/json",
            ...(init?.headers || {})
        },
        ...(init || {})
    });
}

export function apiPatch<T>(path: string, data?: Json, init?: RequestInit) {
    return apiFetch<T>(path, {
        method: "PATCH",
        body: data !== undefined ? JSON.stringify(data) : undefined,
        headers: {
            "content-type": "application/json",
            ...(init?.headers || {})
        },
        ...(init || {})
    });
}

export function apiDelete<T>(path: string, init?: RequestInit) {
    return apiFetch<T>(path, { method: "DELETE", ...(init || {}) });
}

// Helper function to parse JSON responses and handle errors
async function parseApiResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    if (response.status === 204) {
        return null as T;
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        return await response.json();
    }

    throw new Error("Response is not JSON");
}

// Helper functions that return parsed data instead of Response objects
export async function apiGetData<T>(
    path: string,
    init?: RequestInit
): Promise<T> {
    const response = await apiGet<T>(path, init);
    return parseApiResponse<T>(response);
}

export async function apiPostData<T>(
    path: string,
    data?: Json,
    init?: RequestInit
): Promise<T> {
    const response = await apiPost<T>(path, data, init);
    return parseApiResponse<T>(response);
}

export const getMe = () =>
    apiGetData<{ id: string; username: string }>("/users/me");

export const listConversations = () =>
    apiGetData<Conversation[]>("/chat/conversations");

export const listMessages = (roomId: string) =>
    apiGetData<Message[]>(`/chat/rooms/${roomId}/messages`);

export const startDm = (username: string) =>
    apiPostData<{ id: string }>("/chat/dm/start", { username });

export const createGroup = (name: string, memberIds: string[]) =>
    apiPostData<{ id: string }>("/chat/groups", { name, memberIds });

export const searchUsers = (q: string) =>
    apiGetData<Array<{ id: string; username: string; displayName?: string }>>(
        `/users/search?q=${encodeURIComponent(q)}`
    );
