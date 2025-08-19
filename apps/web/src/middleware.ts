// middleware.ts
import { ACCESS_COOKIE } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
    const { pathname, search } = req.nextUrl;
    const token = req.cookies.get(ACCESS_COOKIE)?.value;
    const isAuth =
        pathname.startsWith("/login") || pathname.startsWith("/register");
    const isProtected = pathname === "/" || pathname.startsWith("/chat");

    if (isProtected && !token) {
        const url = new URL("/login", req.url);
        url.searchParams.set("next", pathname + (search || ""));
        return NextResponse.redirect(url);
    }
    if (isAuth && token) {
        return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
}

export const config = { matcher: ["/", "/chat/:path*", "/login", "/register"] };
