// providers/SocketProvider.clean.tsx
"use client";

import { Socket } from "socket.io-client";
import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useRef
} from "react";
import { SocketManager } from "./SocketManager";
import { getCookie } from "@/lib/cookie";

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

export default function CleanSocketProvider({
    token,
    cookieName = process.env.NEXT_PUBLIC_AUTH_COOKIE || "access",
    onAuthExpired,
    children
}: {
    token?: string;
    cookieName?: string;
    onAuthExpired?: () => Promise<void> | void;
    children: React.ReactNode;
}) {
    const [connected, setConnected] = useState(false);
    const [socket, setSocket] = useState<Socket | null>(null);
    const managerRef = useRef<SocketManager | null>(null);

    // SINGLE useEffect - just initialize everything
    useEffect(() => {
        const manager = new SocketManager();
        managerRef.current = manager;

        const socketInstance = manager.initialize({
            token,
            cookieName,
            onAuthExpired,
            onStatusChange: (isConnected: boolean) => {
                setConnected(isConnected);
            }
        });

        setSocket(socketInstance);

        // Handle prop token updates
        if (token) {
            manager.updateToken(token);
        }

        return () => {
            manager.cleanup();
            managerRef.current = null;
        };
    }, [token, cookieName, onAuthExpired]);

    if (!socket) {
        return <div>Connecting...</div>;
    }

    return (
        <SocketCtx.Provider value={{ socket, connected }}>
            {children}
        </SocketCtx.Provider>
    );
}
