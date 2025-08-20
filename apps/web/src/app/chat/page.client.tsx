// apps/web/src/app/page.client.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSocket } from "@/providers/SocketProvider";
import type { Conversation, Message } from "@/lib/types/chat";
import { getMe, listConversations, listMessages, startDm } from "@/lib/api";
import ChatView from "@/components/chat/ChatView";

export default function HomePageClient() {
    const socket = useSocket();

    const [me, setMe] = useState<{ id: string; username: string } | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeId, setActiveId] = useState<string | undefined>(undefined);
    const [messagesByRoom, setMessagesByRoom] = useState<
        Record<string, Message[]>
    >({});
    const [loadingOlder, setLoadingOlder] = useState(false);

    // track what we already joined / loaded
    const joinedRoomsRef = useRef<Set<string>>(new Set());
    const loadedRoomsRef = useRef<Set<string>>(new Set());
    const activeIdRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        activeIdRef.current = activeId;
    }, [activeId]);
    // ---------- bootstrap ----------
    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                const user = await getMe(); // if 401, your route should redirect
                if (ignore) return;
                setMe(user);

                const convs = await listConversations();
                if (ignore) return;
                setConversations(convs);

                if (!activeId && convs.length) {
                    setActiveId(convs[0]!.id);
                }
            } catch (e) {
                console.error("bootstrap error:", e);
            }
        })();
        return () => {
            ignore = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socket]);

    // ---------- socket listeners ----------
    useEffect(() => {
        function onNew(raw: any) {
            const msg: Message = {
                ...raw,
                userId: raw.userId ?? raw.senderId,
                pending: false
            };

            setMessagesByRoom((m) => {
                const list = m[msg.roomId] ?? [];

                // Replace optimistic by clientMsgId
                const byClient = msg.clientMsgId
                    ? list.findIndex((x) => x.clientMsgId === msg.clientMsgId)
                    : -1;
                if (byClient >= 0) {
                    const next = [...list];
                    next[byClient] = {
                        ...next[byClient],
                        ...msg,
                        pending: false
                    };
                    return { ...m, [msg.roomId]: next };
                }

                // Replace by server id
                const byId = list.findIndex((x) => x.id === msg.id);
                if (byId >= 0) {
                    const next = [...list];
                    next[byId] = { ...next[byId], ...msg, pending: false };
                    return { ...m, [msg.roomId]: next };
                }

                // Otherwise append
                return {
                    ...m,
                    [msg.roomId]: [...list, { ...msg, pending: false }]
                };
            });
            setConversations((cs) =>
                cs.map((c) =>
                    c.id === msg.roomId ? { ...c, last: msg.content } : c
                )
            );
        }

        function onAck(payload: { clientMsgId: string; serverId: string }) {
            const { clientMsgId, serverId } = payload;
            setMessagesByRoom((m) => {
                const roomId = Object.keys(m).find((rid) =>
                    (m[rid] ?? []).some((x) => x.clientMsgId === clientMsgId)
                );
                if (!roomId) return m;

                const list = m[roomId] ?? [];
                const idx = list.findIndex(
                    (x) => x.clientMsgId === clientMsgId
                );
                if (idx < 0) return m;

                const next = [...list];
                next[idx] = { ...next[idx]!, id: serverId, pending: false };
                return { ...m, [roomId]: next };
            });
        }

        function onHistory(payload: { roomId: string; history: any[] }) {
            // Case A: { roomId, history: [...] }
            if (payload && payload.roomId && Array.isArray(payload.history)) {
                if (loadedRoomsRef.current.has(payload.roomId)) return;
                loadedRoomsRef.current.add(payload.roomId);

                const normalized = payload.history.map((h: any) => ({
                    ...h,
                    userId: h.userId ?? h.senderId,
                    pending: false
                })) as Message[];

                setMessagesByRoom((m) => ({
                    ...m,
                    [payload.roomId]: normalized
                }));
                return;
            }

            // Case B: just an array [...]
            if (Array.isArray(payload)) {
                const rid = activeIdRef.current;
                if (!rid) return;
                if (loadedRoomsRef.current.has(rid)) return;
                loadedRoomsRef.current.add(rid);

                const normalized = payload.map((h: any) => ({
                    ...h,
                    userId: h.userId ?? h.senderId,
                    pending: false
                })) as Message[];

                setMessagesByRoom((m) => ({ ...m, [rid]: normalized }));
            }
        }

        socket.on("msg:new", onNew);
        socket.on("msg:ack", onAck);
        socket.on("room:history", onHistory);
        return () => {
            socket.off("msg:new", onNew);
            socket.off("msg:ack", onAck);
            socket.off("room:history", onHistory);
        };
    }, [socket]);

    // ---------- when switching conversations ----------
    useEffect(() => {
        if (!activeId) return;

        // join only once
        if (!joinedRoomsRef.current.has(activeId)) {
            joinedRoomsRef.current.add(activeId);
            socket.emit("room:join", { roomId: activeId });
        }

        // Load messages for this conversation if we don't have them
        const hasMessages =
            messagesByRoom[activeId] && messagesByRoom[activeId].length > 0;
        if (!hasMessages) {
            listMessages(activeId)
                .then((messages) => {
                    setMessagesByRoom((m) => ({
                        ...m,
                        [activeId]: messages
                    }));
                })
                .catch((error) => {
                    console.error(
                        "Failed to load messages for room:",
                        activeId,
                        error
                    );
                });
        }
    }, [activeId, socket]);

    // ---------- handlers for ChatView ----------
    async function onSendText(text: string) {
        if (!activeId || !text.trim() || !me) return;
        const clientMsgId = crypto.randomUUID();
        const optimistic: Message = {
            id: clientMsgId,
            roomId: activeId,
            userId: me.id,
            content: text.trim(),
            clientMsgId,
            createdAt: new Date().toISOString(),
            pending: true
        };
        setMessagesByRoom((m) => ({
            ...m,
            [activeId]: [...(m[activeId] ?? []), optimistic]
        }));
        socket.emit("msg:send", {
            roomId: activeId,
            content: text.trim(),
            clientMsgId
        });
    }

    async function onPickImage(file: File) {
        if (!activeId || !me) return;
        const url = URL.createObjectURL(file);
        const optimistic: Message = {
            id: crypto.randomUUID(),
            roomId: activeId,
            userId: me.id,
            content: "",
            createdAt: new Date().toISOString(),
            fileUrl: url,
            pending: true
        };
        setMessagesByRoom((m) => ({
            ...m,
            [activeId]: [...(m[activeId] ?? []), optimistic]
        }));
    }

    async function onLoadOlder() {
        if (!activeId || loadingOlder) return;
        setLoadingOlder(true);
        try {
            // Load more messages using REST API with higher limit
            const olderMessages = await listMessages(activeId);
            setMessagesByRoom((m) => ({
                ...m,
                [activeId]: olderMessages
            }));
        } catch (error) {
            console.error("Failed to load older messages:", error);
        } finally {
            setLoadingOlder(false);
        }
    }

    async function startDmByUsername(username: string) {
        const { id } = await startDm(username);
        const convs = await listConversations();
        setConversations(convs);
        setActiveId(id);
        socket.emit("room:join", { roomId: id });
    }

    // ---------- derived props for ChatView ----------
    const active = useMemo(
        () => conversations.find((c) => c.id === activeId),
        [conversations, activeId]
    );

    const activeHeader = useMemo(() => {
        if (!active) return { name: "" };
        return {
            name: active.name,
            online: active.online,
            avatar: active.avatar ?? null
        };
    }, [active]);

    const activeMessages = useMemo(
        () => (activeId ? (messagesByRoom[activeId] ?? []) : []),
        [activeId, messagesByRoom]
    );

    return (
        <div className="flex h-screen w-screen overflow-hidden">
            <ChatView
                me={me?.id ?? ""}
                conversations={conversations}
                activeId={activeId}
                onSelectConversation={(id) => setActiveId(id)}
                activeHeader={activeHeader}
                messages={activeMessages}
                onLoadOlder={onLoadOlder}
                onSendText={onSendText}
                onPickImage={onPickImage}
                sidebarTopSlot={
                    <button
                        className="w-full rounded-md bg-primary px-3 py-2 text-primary-foreground"
                        onClick={() => {
                            const u = prompt("Start DM with username:");
                            if (u) startDmByUsername(u);
                        }}
                    >
                        New chat
                    </button>
                }
            />
        </div>
    );
}
