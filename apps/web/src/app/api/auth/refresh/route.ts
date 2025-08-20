import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function POST(req: NextRequest) {
    // Forward the refresh request to the backend
    const response = await fetch(`${API}/auth/refresh`, {
        method: "POST",
        credentials: "include" as any,
        headers: {
            // Forward cookies from the request
            cookie: req.headers.get("cookie") || ""
        }
    });

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

        // Forward all Set-Cookie headers
        setCookieHeaders.forEach((cookieHeader) => {
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
                // Set a non-httpOnly cookie for client-side access (Socket.io authentication)
                nextResponse.cookies.set(ACCESS_COOKIE, accessToken, {
                    httpOnly: false,
                    sameSite: "lax",
                    secure: process.env.NODE_ENV === "production",
                    path: "/",
                    maxAge: 3600 // 1 hour for better UX
                });
            }
        }
    }

    return nextResponse;
}
