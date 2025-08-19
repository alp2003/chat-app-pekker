import { Conversation, Message } from "./types/chat";

const BASE = "/api"; // goes through Next BFF: /app/api/[...path]/route.ts

type Json = Record<string, any> | any[];

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        // Send cookies; useful if you ever move BFF to a different subdomain
        credentials: "include",
        // Let caller override anything
        ...init,
        // merge headers safely
        headers: {
            ...(init.headers || {})
        },
        cache: "no-store"
    });

    // Some endpoints may return 204/empty
    const text = await res.text();
    const contentType = res.headers.get("content-type") || "";
    const body = text
        ? contentType.includes("application/json")
            ? (JSON.parse(text) as T)
            : (text as unknown as T)
        : (undefined as unknown as T);

    if (!res.ok) {
        // Bubble up richer error
        const err: any =
            body && typeof body === "object"
                ? body
                : { message: text || res.statusText };
        err.status = res.status;
        throw err;
    }

    return body;
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

export const getMe = () =>
    apiGet<{ id: string; username: string }>("/users/me");

export const listConversations = () =>
    apiGet<Conversation[]>("/chat/conversations");

export const listMessages = (roomId: string) =>
    apiGet<Message[]>(`/chat/rooms/${roomId}/messages`);

export const startDm = (username: string) =>
    apiPost<{ id: string }>("/chat/dm/start", { username });

export const createGroup = (name: string, memberIds: string[]) =>
    apiPost<{ id: string }>("/chat/groups", { name, memberIds });

export const searchUsers = (q: string) =>
    apiGet<Array<{ id: string; username: string; displayName?: string }>>(
        `/users/search?q=${encodeURIComponent(q)}`
    );
