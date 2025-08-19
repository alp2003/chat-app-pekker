// apps/web/src/app/api/chat/[...path]/route.ts
import { NextRequest } from "next/server";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path } = await params;
    const token = req.cookies.get("access")?.value;
    const url = `${API}/${path.join("/")}${req.nextUrl.search}`;
    console.log(`url: ${url}`);
    return fetch(url, {
        method: "GET",
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        credentials: "include" as any
    });
}
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path } = await params;
    const url = `${API}/${path.join("/")}`;
    const token = req.cookies.get("access")?.value;
    return fetch(url, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: await req.text(),
        credentials: "include" as any
    });
}
