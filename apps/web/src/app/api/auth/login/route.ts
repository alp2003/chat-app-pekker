import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function POST(req: NextRequest) {
    // Get the request body
    const body = await req.text();

    console.log("🔑 Login request - forwarding to backend...");

    // Forward the login request to the backend
    const response = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            // Forward cookies from the request (in case of any existing session)
            cookie: req.headers.get("cookie") || "",
            // Forward user-agent and IP for login tracking
            "user-agent": req.headers.get("user-agent") || "",
            "x-forwarded-for":
                req.headers.get("x-forwarded-for") ||
                req.headers.get("x-real-ip") ||
                "127.0.0.1"
        },
        body
    });

    console.log(
        "🔑 Backend login response:",
        response.status,
        response.statusText
    );

    // Get the response data
    const responseData = await response.text();

    // Create the response to send back
    const nextResponse = new NextResponse(responseData, {
        status: response.status,
        statusText: response.statusText
    });

    // Forward all headers from the backend response
    response.headers.forEach((value, key) => {
        // Skip the set-cookie header, we'll handle it manually
        if (key.toLowerCase() !== "set-cookie") {
            nextResponse.headers.set(key, value);
        }
    });

    // Handle cookies manually to also set the non-httpOnly cookie for Socket.io
    if (response.ok) {
        const setCookieHeaders = response.headers.getSetCookie();
        console.log("🍪 Backend set-cookie headers:", setCookieHeaders);

        // Forward all Set-Cookie headers from backend
        setCookieHeaders.forEach((cookieHeader) => {
            console.log("🍪 Forwarding cookie:", cookieHeader);
            nextResponse.headers.append("Set-Cookie", cookieHeader);
        });

        // Extract the access token and also set a non-httpOnly version for Socket.io
        const accessCookie = setCookieHeaders.find((cookie) =>
            cookie.startsWith("access=")
        );
        if (accessCookie) {
            const tokenMatch = accessCookie.match(/access=([^;]+)/);
            const accessToken = tokenMatch?.[1];

            if (accessToken) {
                console.log(
                    "🍪 Setting non-httpOnly access token for Socket.io"
                );
                // Set a non-httpOnly version for Socket.io (shorter name to avoid conflicts)
                nextResponse.cookies.set("u_token", accessToken, {
                    maxAge: 300, // 5 minutes for testing to eliminate race conditions
                    path: "/",
                    sameSite: "lax",
                    secure: process.env.NODE_ENV === "production"
                });
            }
        }

        console.log("✅ Login successful - cookies set");
    } else {
        console.log("❌ Login failed:", responseData);
    }

    return nextResponse;
}
