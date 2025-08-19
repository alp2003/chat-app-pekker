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
        // important: include so Nest can set the HttpOnly refresh cookie
        credentials: "include" as any
    });

    console.log(`================================`);
    console.log({ res });

    if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "login_failed");
    }

    console.log(`================================`);
    console.log({ res });

    const json = await res.json(); // { access, user }
    if (!json?.access) throw new Error("no_access_token");

    // Store short-lived access token in a readable cookie for the client (Socket handshake)
    const c = await cookies();
    c.set(ACCESS_COOKIE, json.access, {
        httpOnly: false, // readable by client (SocketProvider)
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 // 1 hour (match API access TTL)
    });

    // Optionally store lightweight user context (non-sensitive)
    c.set("u_name", json.user?.username ?? "", { path: "/", sameSite: "lax" });

    return { ok: true };
}
