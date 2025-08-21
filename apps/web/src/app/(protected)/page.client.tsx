"use client";

import { useEffect, useState } from "react";
import { useSocket } from "@/providers/SocketProvider";
import useChatStore from "@/stores/chatStore";
import ChatView from "@/components/chat/ChatView";
import type { Conversation } from "@/lib/types/chat";

interface User {
    id: string;
    username: string;
}

interface ChatPageClientProps {
    initialData?: {
        user: User;
        conversations: Conversation[];
    } | null;
}

export default function CleanProtectedPageClient({
    initialData
}: ChatPageClientProps) {
    const socket = useSocket();

    // All state and logic comes from Zustand
    const {
        user,
        conversations,
        messagesByRoom,
        activeRoomId,
        forceScrollToBottom,
        // Actions - these handle ALL the complexity
        initialize,
        cleanup,
        selectRoom,
        sendMessage
    } = useChatStore();

    // SINGLE useEffect - just initialize everything
    useEffect(() => {
        if (socket) {
            initialize(socket, initialData || undefined);
        }

        return () => {
            cleanup();
        };
    }, [socket, initialData, initialize, cleanup]);

    // Event handlers - just call store actions
    const handleSendMessage = async (content: string) => {
        if (!content.trim()) return;
        await sendMessage(content.trim());
    };

    const handleConversationSelect = (id: string) => {
        selectRoom(id);
    };

    const messages = activeRoomId ? messagesByRoom[activeRoomId] || [] : [];

    // Get active conversation details for header
    const activeConversation = conversations.find((c) => c.id === activeRoomId);
    const activeHeader = activeConversation
        ? {
              name: activeConversation.name || "Chat",
              online: false, // TODO: Add online status
              avatar: null // TODO: Add avatar support
          }
        : undefined;

    return (
        <ChatView
            me={user?.id || ""}
            conversations={conversations}
            activeId={activeRoomId}
            onSelectConversation={handleConversationSelect}
            activeHeader={activeHeader}
            messages={messages}
            onSendText={handleSendMessage}
            onPickImage={() => {}} // TODO: Implement file upload
            forceScrollToBottom={forceScrollToBottom}
        />
    );
}
