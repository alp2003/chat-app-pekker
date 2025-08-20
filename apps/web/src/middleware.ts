// middleware.ts
import { ACCESS_COOKIE } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
    const { pathname, search } = req.nextUrl;
    const token = req.cookies.get(ACCESS_COOKIE)?.value;
    const refreshToken = req.cookies.get("refresh")?.value;
    const isAuth =
        pathname.startsWith("/login") || pathname.startsWith("/register");
    const isProtected = pathname === "/" || pathname.startsWith("/chat");

    if (isProtected) {
        // Allow access if we have either access token OR refresh token
        // The client-side code will handle token refresh if needed
        if (token || refreshToken) {
            return NextResponse.next();
        }

        // No tokens at all, redirect to login
        const url = new URL("/login", req.url);
        url.searchParams.set("next", pathname + (search || ""));
        return NextResponse.redirect(url);
    }

    if (isAuth && (token || refreshToken)) {
        return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
}

export const config = { matcher: ["/", "/chat/:path*", "/login", "/register"] };
