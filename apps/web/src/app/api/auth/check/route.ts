import { NextRequest, NextResponse } from "next/server";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function GET(req: NextRequest) {
    try {
        // Try to get user info with existing cookies
        const userResponse = await fetch(`${API}/users/me`, {
            method: "GET",
            headers: {
                cookie: req.headers.get("cookie") || ""
            }
        });

        if (userResponse.ok) {
            // User is authenticated, return user data
            const userData = await userResponse.json();
            return NextResponse.json(userData);
        }

        // If 401, try to refresh the token
        if (userResponse.status === 401) {
            const refreshResponse = await fetch(`${API}/auth/refresh`, {
                method: "POST",
                headers: {
                    cookie: req.headers.get("cookie") || ""
                }
            });

            if (refreshResponse.ok) {
                // Refresh successful, try getting user data again
                const retryUserResponse = await fetch(`${API}/users/me`, {
                    method: "GET",
                    headers: {
                        cookie: req.headers.get("cookie") || ""
                    }
                });

                if (retryUserResponse.ok) {
                    const userData = await retryUserResponse.json();
                    const response = NextResponse.json(userData);

                    // Forward any Set-Cookie headers from the refresh
                    const setCookieHeaders =
                        refreshResponse.headers.getSetCookie();
                    setCookieHeaders.forEach((cookieHeader) => {
                        response.headers.append("Set-Cookie", cookieHeader);
                    });

                    return response;
                }
            }
        }

        // Authentication failed
        return new NextResponse("Unauthorized", { status: 401 });
    } catch (error) {
        console.error("Auth check error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
