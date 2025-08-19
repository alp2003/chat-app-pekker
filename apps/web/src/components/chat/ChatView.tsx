"use client";

import { useState } from "react";
import ChatHeader from "./ChatHeader";
import { DesktopSidebar } from "./ChatSidebar"; // we embed our own mobile drawer below
import ChatMessageList from "./ChatMessageList";
import ChatComposer from "./ChatComposer";
import type { Conversation, Message } from "@/lib/types/chat";

export default function ChatView({
    me,
    conversations,
    activeId,
    onSelectConversation,
    activeHeader, // { name, online, avatar }
    messages, // oldest -> newest
    onLoadOlder,
    onSendText,
    onPickImage,
    rightHeaderSlot,
    sidebarTopSlot
}: {
    me: string;
    conversations: Conversation[];
    activeId?: string;
    onSelectConversation: (id: string) => void;
    activeHeader?: { name: string; online?: boolean; avatar?: string | null };
    messages: Message[];
    onLoadOlder?: () => void;
    onSendText: (text: string) => void;
    onPickImage: (file: File) => void;
    rightHeaderSlot?: React.ReactNode;
    sidebarTopSlot?: React.ReactNode;
}) {
    const [text, setText] = useState("");
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Wrap selection so the mobile drawer closes after choosing a chat
    const handleSelectConversation = (id: string) => {
        onSelectConversation(id);
        setDrawerOpen(false);
    };

    return (
        <div className="flex h-dvh w-full bg-background text-foreground">
            {/* Desktop / Tablet sidebar */}
            <aside className="hidden md:block w-80 shrink-0 border-r bg-background">
                <DesktopSidebar
                    convos={conversations}
                    activeId={activeId}
                    setActive={handleSelectConversation}
                    topSlot={sidebarTopSlot}
                />
            </aside>

            {/* Main column */}
            <div className="flex min-w-0 flex-1 flex-col">
                {/* Header */}
                <div className="flex items-center gap-2 border-b px-2 py-2 md:px-3">
                    {/* Mobile hamburger */}
                    <button
                        type="button"
                        aria-label="Open sidebar"
                        className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"
                        onClick={() => setDrawerOpen(true)}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            className="h-5 w-5"
                            fill="currentColor"
                        >
                            <path
                                d="M4 6h16M4 12h16M4 18h16"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                            />
                        </svg>
                    </button>

                    <ChatHeader
                        name={activeHeader?.name ?? ""}
                        online={activeHeader?.online}
                        avatar={activeHeader?.avatar}
                        rightSlot={rightHeaderSlot}
                    />
                </div>

                {/* Message list + composer */}
                <div className="flex h-0 flex-1 flex-col">
                    <div className="flex-1 overflow-hidden">
                        <ChatMessageList
                            messages={messages}
                            me={me}
                            onStartReached={onLoadOlder}
                            conversationKey={activeId}
                            getPeer={(uid) => {
                                const convo = conversations.find(
                                    (c) => c.id === activeId
                                );
                                const member = convo?.members?.find(
                                    (p) => p.id === uid
                                );
                                if (!member) return undefined;
                                return {
                                    name:
                                        member?.username ?? member?.displayName,
                                    avatar: member?.avatar
                                };
                            }}
                        />
                    </div>

                    <ChatComposer
                        value={text}
                        setValue={setText}
                        onSend={() => {
                            const t = text.trim();
                            if (!t) return;
                            onSendText(t);
                            setText("");
                        }}
                        onPick={onPickImage}
                    />
                </div>
            </div>

            {/* Mobile slide-in sidebar */}
            {drawerOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40 bg-black/40 md:hidden"
                        onClick={() => setDrawerOpen(false)}
                    />
                    <div className="fixed inset-y-0 left-0 z-50 w-80 border-r bg-background shadow-lg md:hidden">
                        <DesktopSidebar
                            convos={conversations}
                            activeId={activeId}
                            setActive={handleSelectConversation}
                            topSlot={sidebarTopSlot}
                        />
                    </div>
                </>
            )}
        </div>
    );
}
