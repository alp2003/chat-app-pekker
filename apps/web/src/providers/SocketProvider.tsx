// providers/SocketProvider.tsx
"use client";

import { io, Socket } from "socket.io-client";
import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

type Ctx = { socket: Socket; connected: boolean };
const SocketCtx = createContext<Ctx | null>(null);

export function useSocket(): Socket {
    const c = useContext(SocketCtx);
    if (!c) throw new Error("No socket context");
    return c.socket;
}
export function useSocketStatus() {
    const c = useContext(SocketCtx);
    if (!c) throw new Error("No socket context");
    return c.connected;
}

// ---------- Optional: dev/HMR singleton (prevents duplicate sockets in Next dev)
let _socketSingleton: Socket | null = null;
// ----------------------------------------------------------

function getCookie(name: string) {
    if (typeof document === "undefined") return "";
    const m = document.cookie.match(
        new RegExp(
            "(^| )" + name.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&") + "=([^;]+)"
        )
    );
    return m ? decodeURIComponent(m[2]!) : "";
}

export default function SocketProvider({
    token, // optional; if not provided, we read access cookie on the client
    cookieName = process.env.NEXT_PUBLIC_AUTH_COOKIE || "access",
    onAuthExpired, // optional: called when the server says "unauthorized"
    children
}: {
    token?: string;
    cookieName?: string;
    onAuthExpired?: () => Promise<void> | void;
    children: React.ReactNode;
}) {
    // pull token from cookie on first client render if prop missing
    const initialToken =
        typeof window !== "undefined"
            ? token || getCookie(cookieName)
            : token || "";
    const [authToken, setAuthToken] = useState(initialToken);
    const prevTokenRef = useRef(authToken);

    // if the prop token appears later (SSR → CSR), sync once
    useEffect(() => {
        if (token && token !== authToken) setAuthToken(token);
    }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

    const url =
        (process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001") +
        "/chat";

    const socket = useMemo(() => {
        // Dev HMR: reuse singleton to avoid multi-connect storms
        if (process.env.NODE_ENV !== "production" && _socketSingleton) {
            _socketSingleton.auth = { token: authToken };
            return _socketSingleton;
        }

        const s = io(url, {
            autoConnect: false,
            transports: ["websocket"], // prefer WS
            withCredentials: true, // only needed if you rely on cookies server-side
            auth: { token: authToken },
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 600,
            reconnectionDelayMax: 4000
        });

        // Dev logs
        if (process.env.NODE_ENV !== "production") {
            s.onAny((ev, ...args) => console.log("[socket:any]", ev, ...args));
            s.on("connect_error", (err) =>
                console.warn("[socket] connect_error", err?.message || err)
            );
            s.on("disconnect", (reason) =>
                console.log("[socket] disconnected:", reason)
            );
            s.on("connect", () => console.log("[socket] connected:", s.id));
            s.on("reconnect", (n) => console.log("[socket] reconnected", n));
        }

        if (process.env.NODE_ENV !== "production") _socketSingleton = s;
        return s;
        // only create when URL changes; token handling is below
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url]);

    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const onConnect = () => setConnected(true);
        const onDisconnect = () => setConnected(false);

        // Handle unauthorized (expired or invalid access token)
        const onConnectError = async (err: any) => {
            const msg = (err?.message || "").toLowerCase();
            if (
                msg.includes("unauthorized") ||
                msg.includes("jwt") ||
                err?.data === "unauthorized"
            ) {
                // allow app to refresh the token (client or server action)
                if (onAuthExpired) await onAuthExpired();
                // grab new cookie token and retry once
                const fresh = getCookie(cookieName);
                if (fresh && fresh !== authToken) {
                    socket.auth = { token: fresh };
                    prevTokenRef.current = fresh;
                    setAuthToken(fresh);
                    if (!socket.connected) socket.connect();
                }
            }
        };

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.on("connect_error", onConnectError);

        // initial connect
        if (!socket.connected) socket.connect();

        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.off("connect_error", onConnectError);
            if (process.env.NODE_ENV === "production") {
                socket.disconnect();
            } else {
                socket.emit("app:leaving");
            }
        };
    }, [socket, authToken, cookieName, onAuthExpired]);

    // Re-auth only when the token value actually changes
    useEffect(() => {
        const prev = prevTokenRef.current;
        if (authToken && authToken !== prev) {
            socket.auth = { token: authToken };
            // only reconnect if already connected (prevents double connect on mount)
            if (socket.connected) {
                socket.disconnect();
                socket.connect();
            }
            prevTokenRef.current = authToken;
        }
    }, [authToken, socket]);

    return (
        <SocketCtx.Provider value={{ socket, connected }}>
            {children}
        </SocketCtx.Provider>
    );
}
