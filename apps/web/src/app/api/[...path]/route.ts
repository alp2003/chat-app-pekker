// apps/web/src/app/api/chat/[...path]/route.ts
import { NextRequest } from "next/server";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path } = await params;

    // Skip auth routes - let them be handled by specific auth route handlers
    if (path[0] === "auth") {
        return new Response("Not Found", { status: 404 });
    }

    const url = `${API}/${path.join("/")}${req.nextUrl.search}`;
    const cookies = req.headers.get("cookie") || "";

    // Only use httpOnly cookies, don't mix with Authorization headers
    const response = await fetch(url, {
        method: "GET",
        headers: {
            // Forward all cookies from the request
            cookie: cookies,
            // Forward user-agent and other relevant headers
            "user-agent": req.headers.get("user-agent") || ""
        }
        // Don't use credentials: 'include' as we're manually forwarding cookies
    });

    // Create a proper response with all headers forwarded
    const responseText = await response.text();
    const nextResponse = new Response(responseText, {
        status: response.status,
        statusText: response.statusText
    });

    // Forward all response headers except set-cookie (which we handle separately)
    response.headers.forEach((value, key) => {
        nextResponse.headers.set(key, value);
    });

    return nextResponse;
}
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path } = await params;

    // Skip auth routes - let them be handled by specific auth route handlers
    if (path[0] === "auth") {
        return new Response("Not Found", { status: 404 });
    }

    const url = `${API}/${path.join("/")}`;
    const cookies = req.headers.get("cookie") || "";

    // Only use httpOnly cookies, don't mix with Authorization headers
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            // Forward all cookies from the request
            cookie: cookies,
            // Forward user-agent and other relevant headers
            "user-agent": req.headers.get("user-agent") || ""
        },
        body: JSON.stringify(await req.json())
        // Don't use credentials: 'include' as we're manually forwarding cookies
    });

    // Create a proper response with all headers forwarded
    const responseText = await response.text();
    const nextResponse = new Response(responseText, {
        status: response.status,
        statusText: response.statusText
    });

    // Forward all response headers
    response.headers.forEach((value, key) => {
        nextResponse.headers.set(key, value);
    });

    return nextResponse;
}
