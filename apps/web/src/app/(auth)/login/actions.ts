"use server";

import { API, ACCESS_COOKIE } from "@/lib/auth";
import { cookies } from "next/headers";

export async function loginAction(data: {
    username: string;
    password: string;
}) {
    const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
        // important: include so Nest can set both access and refresh HttpOnly cookies
        credentials: "include" as any
    });

    if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "login_failed");
    }

    const json = await res.json(); // { user } (access token now comes via Set-Cookie)

    // The backend already sets the access token as an httpOnly cookie
    // But we also need a non-httpOnly cookie for socket.io authentication
    const setCookieHeaders = res.headers.getSetCookie();
    const accessCookie = setCookieHeaders.find((cookie) =>
        cookie.startsWith("access=")
    );

    if (accessCookie) {
        // Extract the token value from the Set-Cookie header
        const tokenMatch = accessCookie.match(/access=([^;]+)/);
        const accessToken = tokenMatch?.[1];

        if (accessToken) {
            // Set a non-httpOnly cookie for client-side access (Socket.io authentication)
            const c = await cookies();
            c.set(ACCESS_COOKIE, accessToken, {
                httpOnly: false, // readable by client (SocketProvider)
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
                path: "/",
                maxAge: 60 * 60 // 1 hour (longer than JWT so middleware can detect login state)
            });
        }
    }

    // Store lightweight user context (non-sensitive)
    const c = await cookies();
    c.set("u_name", json.user?.username ?? "", { path: "/", sameSite: "lax" });

    return { ok: true };
}
