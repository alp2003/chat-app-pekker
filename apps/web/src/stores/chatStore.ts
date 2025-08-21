import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Conversation, Message } from "@/lib/types/chat";

interface User {
    id: string;
    username: string;
}

interface ChatState {
    // Data
    user: User | null;
    conversations: Conversation[];
    messagesByRoom: Record<string, Message[]>;
    activeRoomId: string | undefined;

    // UI State
    loadingOlder: boolean;
    forceScrollToBottom: number;

    // Tracking state
    joinedRooms: Set<string>;
    loadedRooms: Set<string>;
    loadingRooms: Set<string>;
}

interface ChatActions {
    // MAIN ACTIONS - What components call
    initialize: (
        socket: any,
        initialData?: { user: User; conversations: Conversation[] }
    ) => void;
    cleanup: () => void;
    selectRoom: (roomId: string) => void;
    sendMessage: (content: string) => Promise<void>;

    // Internal methods (prefixed with _)
    _bootstrapData: () => Promise<void>;
    _loadRoomMessages: (roomId: string) => Promise<void>;
    _handleNewMessage: (message: Message) => void;
    _handleMessageAck: (payload: {
        clientMsgId: string;
        serverId: string;
    }) => void;
    _handleMessageNack: (payload: {
        clientMsgId: string;
        error: string;
        details?: any;
    }) => void;
    _handleRoomHistory: (payload: {
        roomId: string;
        history: Message[];
    }) => void;
    _setActiveRoom: (roomId: string) => void;
    _addJoinedRoom: (roomId: string) => void;
    _addLoadedRoom: (roomId: string) => void;
    _addLoadingRoom: (roomId: string) => void;
    _removeLoadingRoom: (roomId: string) => void;
    _setMessages: (roomId: string, messages: Message[]) => void;
    _addMessage: (message: Message) => void;
    _updateConversationPreview: (roomId: string, content: string) => void;
    _updateAllConversationPreviews: () => void;
    _updateMessage: (
        roomId: string,
        messageId: string,
        updates: Partial<Message>
    ) => void;
    _addOptimisticMessage: (message: Message) => void;
    _triggerScrollToBottom: () => void;
}

type ChatStore = ChatState & ChatActions;

let socket: any = null;

const useChatStore = create<ChatStore>()(
    devtools(
        (set, get) => ({
            // Initial state
            user: null,
            conversations: [],
            messagesByRoom: {},
            activeRoomId: undefined,
            loadingOlder: false,
            forceScrollToBottom: 0,
            joinedRooms: new Set(),
            loadedRooms: new Set(),
            loadingRooms: new Set(),

            // MAIN ACTIONS - Components only call these
            initialize: async (
                socketInstance: any,
                initialData?: { user: User; conversations: Conversation[] }
            ) => {
                socket = socketInstance;

                // Set up socket listeners
                if (socket) {
                    const {
                        _handleNewMessage,
                        _handleMessageAck,
                        _handleMessageNack,
                        _handleRoomHistory
                    } = get();

                    console.log("🟢 Setting up socket listeners");
                    socket.on("msg:new", (data: any) => {
                        console.log("🟢 Socket received msg:new event:", data);
                        _handleNewMessage(data);
                    });
                    socket.on("msg:ack", _handleMessageAck);
                    socket.on("msg:nack", _handleMessageNack);
                    socket.on("room:history", _handleRoomHistory);

                    // Add connection debugging
                    socket.on("connect", () => {
                        console.log("🟢 Socket connected");
                    });
                    socket.on("disconnect", () => {
                        console.log("🔴 Socket disconnected");
                    });
                }

                // Bootstrap data
                if (initialData) {
                    set(
                        {
                            user: initialData.user,
                            conversations: initialData.conversations
                        },
                        false,
                        "initialize-with-data"
                    );

                    // Auto-select first conversation
                    if (
                        initialData.conversations.length > 0 &&
                        initialData.conversations[0]
                    ) {
                        get().selectRoom(initialData.conversations[0].id);
                    }
                } else {
                    // Client-side bootstrap
                    await get()._bootstrapData();
                }
            },

            cleanup: () => {
                if (socket) {
                    socket.off("msg:new");
                    socket.off("msg:ack");
                    socket.off("msg:nack");
                    socket.off("room:history");
                    socket = null;
                }
            },

            selectRoom: (roomId: string) => {
                const state = get();

                // Set active room
                state._setActiveRoom(roomId);

                // Join room if not already joined
                if (!state.joinedRooms.has(roomId) && socket) {
                    console.log("🚀 Joining room:", roomId);
                    state._addJoinedRoom(roomId);
                    socket.emit("room:join", { roomId });
                } else {
                    console.log(
                        "🔵 Room already joined or no socket:",
                        roomId,
                        "joined:",
                        state.joinedRooms.has(roomId),
                        "socket:",
                        !!socket
                    );
                }

                // Load messages if needed
                const hasMessages =
                    (state.messagesByRoom[roomId]?.length ?? 0) > 0;
                const isLoading = state.loadingRooms.has(roomId);
                const alreadyLoaded = state.loadedRooms.has(roomId);

                if (!hasMessages && !isLoading && !alreadyLoaded) {
                    state._loadRoomMessages(roomId);
                }
            },

            sendMessage: async (content: string) => {
                const state = get();
                if (!state.activeRoomId || !state.user || !socket) return;

                // Generate proper UUID for clientMsgId
                const clientMsgId = crypto.randomUUID();
                const optimisticMessage: Message = {
                    id: clientMsgId,
                    content,
                    userId: state.user.id,
                    roomId: state.activeRoomId,
                    createdAt: new Date().toISOString(),
                    pending: true,
                    clientMsgId
                };

                // Add optimistic message
                state._addOptimisticMessage(optimisticMessage);
                state._triggerScrollToBottom();

                // Send to server with correct field name
                socket.emit("msg:send", {
                    roomId: state.activeRoomId, // Changed from conversationId to roomId
                    content,
                    clientMsgId
                });
            },

            // INTERNAL METHODS - Store uses these internally
            _bootstrapData: async () => {
                try {
                    const { getMe, listConversations } = await import(
                        "@/lib/api"
                    );
                    const [user, conversations] = await Promise.all([
                        getMe(),
                        listConversations()
                    ]);

                    set({ user, conversations }, false, "bootstrap-data");

                    if (conversations.length > 0 && conversations[0]) {
                        get().selectRoom(conversations[0].id);
                    }
                } catch (error) {
                    console.error("Bootstrap failed:", error);
                }
            },

            _loadRoomMessages: async (roomId: string) => {
                const state = get();
                state._addLoadingRoom(roomId);

                try {
                    const { listMessages } = await import("@/lib/api");
                    const { trackRequest } = await import(
                        "@/lib/request-tracker"
                    );

                    const messages = await trackRequest(
                        `messages-${roomId}`,
                        () => listMessages(roomId)
                    );

                    state._setMessages(roomId, messages);
                    state._addLoadedRoom(roomId);

                    // Update conversation previews after loading messages to show only received messages
                    state._updateAllConversationPreviews();
                } catch (error) {
                    console.error("Failed to load messages:", error);
                } finally {
                    state._removeLoadingRoom(roomId);
                }
            },

            _handleNewMessage: (rawMessage: Message) => {
                console.log("🔵 _handleNewMessage called with:", rawMessage);
                const message = { ...rawMessage } as Message;
                console.log(
                    "🔵 Adding message to store for roomId:",
                    message.roomId
                );
                const currentState = get();
                console.log(
                    "🔵 Current messages for room before add:",
                    currentState.messagesByRoom[message.roomId]?.length || 0
                );
                get()._addMessage(message);
                const afterState = get();
                console.log(
                    "🔵 Current messages for room after add:",
                    afterState.messagesByRoom[message.roomId]?.length || 0
                );

                // Only update conversation preview if this message is from someone else (received message)
                const currentUser = afterState.user;
                if (currentUser && message.userId !== currentUser.id) {
                    console.log(
                        "🔔 Message from someone else - updating conversation preview"
                    );
                    get()._updateConversationPreview(
                        message.roomId,
                        message.content || "[File]"
                    );
                } else {
                    console.log(
                        "🚫 Message from current user - NOT updating conversation preview"
                    );
                }
                // Don't auto-scroll for incoming messages - let ChatMessageList handle it based on user position
                // get()._triggerScrollToBottom();
            },

            _handleMessageAck: (payload: {
                clientMsgId: string;
                serverId: string;
            }) => {
                // Message replacement is now handled in _addMessage when server broadcasts msg:new
                // This acknowledgment just confirms the message was processed
                console.log("✅ Message acknowledged:", payload);
            },

            _handleMessageNack: (payload: {
                clientMsgId: string;
                error: string;
                details?: any;
            }) => {
                const state = get();
                if (!state.activeRoomId) return;

                console.error("❌ Message failed to send:", payload);

                // Mark the message as failed
                state._updateMessage(state.activeRoomId, payload.clientMsgId, {
                    pending: false,
                    error: true
                });
            },

            _handleRoomHistory: (payload: {
                roomId: string;
                history: Message[];
            }) => {
                get()._setMessages(payload.roomId, payload.history);
                // Update conversation previews after loading room history
                get()._updateAllConversationPreviews();
            },

            // Simple state setters
            _setActiveRoom: (roomId: string) =>
                set({ activeRoomId: roomId }, false, "setActiveRoom"),

            _addJoinedRoom: (roomId: string) =>
                set(
                    (state) => {
                        const newJoinedRooms = new Set(state.joinedRooms);
                        newJoinedRooms.add(roomId);
                        return { joinedRooms: newJoinedRooms };
                    },
                    false,
                    "addJoinedRoom"
                ),

            _addLoadedRoom: (roomId: string) =>
                set(
                    (state) => {
                        const newLoadedRooms = new Set(state.loadedRooms);
                        newLoadedRooms.add(roomId);
                        return { loadedRooms: newLoadedRooms };
                    },
                    false,
                    "addLoadedRoom"
                ),

            _addLoadingRoom: (roomId: string) =>
                set(
                    (state) => {
                        const newLoadingRooms = new Set(state.loadingRooms);
                        newLoadingRooms.add(roomId);
                        return { loadingRooms: newLoadingRooms };
                    },
                    false,
                    "addLoadingRoom"
                ),

            _removeLoadingRoom: (roomId: string) =>
                set(
                    (state) => {
                        const newLoadingRooms = new Set(state.loadingRooms);
                        newLoadingRooms.delete(roomId);
                        return { loadingRooms: newLoadingRooms };
                    },
                    false,
                    "removeLoadingRoom"
                ),

            _setMessages: (roomId: string, messages: Message[]) =>
                set(
                    (state) => ({
                        messagesByRoom: {
                            ...state.messagesByRoom,
                            [roomId]: messages
                        }
                    }),
                    false,
                    "setMessages"
                ),

            _addMessage: (message: Message) =>
                set(
                    (state) => {
                        const roomId = message.roomId;
                        const currentMessages =
                            state.messagesByRoom[roomId] || [];

                        // Check if we already have a message with this clientMsgId (optimistic message)
                        const existingIndex = currentMessages.findIndex(
                            (m) =>
                                message.clientMsgId &&
                                m.clientMsgId === message.clientMsgId
                        );

                        let updatedMessages: Message[];
                        if (existingIndex !== -1) {
                            // Replace the optimistic message with the server version
                            updatedMessages = [...currentMessages];
                            updatedMessages[existingIndex] = message;
                        } else {
                            // Check for duplicate by id (for messages without clientMsgId)
                            if (
                                currentMessages.some((m) => m.id === message.id)
                            ) {
                                return state;
                            }
                            // Add new message
                            updatedMessages = [...currentMessages, message];
                        }

                        return {
                            messagesByRoom: {
                                ...state.messagesByRoom,
                                [roomId]: updatedMessages
                            }
                        };
                    },
                    false,
                    "addMessage"
                ),

            _updateConversationPreview: (roomId: string, content: string) =>
                set(
                    (state) => {
                        console.log(
                            "🔄 Before updating conversations. Total conversations:",
                            state.conversations.length
                        );
                        console.log(
                            "🔄 Looking for conversation with roomId:",
                            roomId
                        );
                        console.log("🔄 Current user:", state.user?.username);
                        console.log(
                            "🔄 All conversations:",
                            state.conversations.map((c) => ({
                                id: c.id,
                                name: c.name,
                                last: c.last
                            }))
                        );

                        // Update conversations array with the latest message preview
                        const updatedConversations = state.conversations.map(
                            (convo) => {
                                console.log(
                                    "🔍 Checking conversation:",
                                    convo.id,
                                    convo.name,
                                    "vs roomId:",
                                    roomId
                                );
                                if (convo.id === roomId) {
                                    console.log(
                                        "🔄 Updating conversation preview:",
                                        convo.name,
                                        "with message:",
                                        content
                                    );
                                    return {
                                        ...convo,
                                        last: content
                                    };
                                }
                                return convo;
                            }
                        );

                        console.log(
                            "🔄 After updating conversations. Changes made:",
                            updatedConversations.some(
                                (convo, index) =>
                                    convo.last !==
                                    state.conversations[index]?.last
                            )
                        );
                        console.log(
                            "🔄 Updated conversations:",
                            updatedConversations.map((c) => ({
                                id: c.id,
                                name: c.name,
                                last: c.last
                            }))
                        );

                        return {
                            conversations: updatedConversations
                        };
                    },
                    false,
                    "updateConversationPreview"
                ),

            _updateAllConversationPreviews: () =>
                set(
                    (state) => {
                        if (!state.user) {
                            console.log(
                                "🔄 No user found, skipping conversation preview update"
                            );
                            return state;
                        }

                        console.log(
                            "🔄 Updating all conversation previews for user:",
                            state.user.username,
                            "userId:",
                            state.user.id
                        );

                        const updatedConversations = state.conversations.map(
                            (convo) => {
                                const messages =
                                    state.messagesByRoom[convo.id] || [];
                                console.log(
                                    "🔍 Conversation:",
                                    convo.name,
                                    "has",
                                    messages.length,
                                    "messages"
                                );

                                // Find the latest message that was NOT sent by the current user
                                const latestReceivedMessage = messages
                                    .slice()
                                    .reverse() // Start from the latest messages
                                    .find((msg) => {
                                        console.log(
                                            "🔍 Checking message:",
                                            msg.content,
                                            "from userId:",
                                            msg.userId,
                                            "vs current user:",
                                            state.user!.id,
                                            "match:",
                                            msg.userId === state.user!.id
                                        );
                                        return msg.userId !== state.user!.id;
                                    });

                                const newLast =
                                    latestReceivedMessage?.content || null;

                                console.log(
                                    "🔄 Conversation:",
                                    convo.name,
                                    "old last:",
                                    convo.last,
                                    "new last:",
                                    newLast,
                                    "latest received from userId:",
                                    latestReceivedMessage?.userId
                                );

                                return {
                                    ...convo,
                                    last: newLast
                                };
                            }
                        );

                        return {
                            conversations: updatedConversations
                        };
                    },
                    false,
                    "updateAllConversationPreviews"
                ),

            _updateMessage: (
                roomId: string,
                messageId: string,
                updates: Partial<Message>
            ) =>
                set(
                    (state) => {
                        const messages = state.messagesByRoom[roomId];
                        if (!messages) return state;

                        const updatedMessages = messages.map((msg) =>
                            // Search by clientMsgId first (for pending messages), then by id
                            msg.clientMsgId === messageId ||
                            msg.id === messageId
                                ? { ...msg, ...updates }
                                : msg
                        );

                        return {
                            messagesByRoom: {
                                ...state.messagesByRoom,
                                [roomId]: updatedMessages
                            }
                        };
                    },
                    false,
                    "updateMessage"
                ),

            _addOptimisticMessage: (message: Message) =>
                set(
                    (state) => {
                        const roomId = message.roomId;
                        const currentMessages =
                            state.messagesByRoom[roomId] || [];

                        return {
                            messagesByRoom: {
                                ...state.messagesByRoom,
                                [roomId]: [...currentMessages, message]
                            }
                        };
                    },
                    false,
                    "addOptimisticMessage"
                ),

            _triggerScrollToBottom: () =>
                set(
                    (state) => ({
                        forceScrollToBottom: state.forceScrollToBottom + 1
                    }),
                    false,
                    "triggerScrollToBottom"
                )
        }),
        {
            name: "chat-store"
        }
    )
);

export default useChatStore;
