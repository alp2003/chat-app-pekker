import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Conversation, Message } from '@/lib/types/chat';

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
  reactToMessage: (messageId: string, emoji: string) => Promise<void>;

  // Internal methods (prefixed with _)
  _bootstrapData: () => Promise<void>;
  _loadRoomMessages: (roomId: string) => Promise<void>;
  _syncRoomAfterReconnection: (roomId: string) => Promise<void>;
  _syncAllRoomsAfterBackground: () => Promise<void>;
  _refreshSocketListeners: () => void;
  _handleNewMessage: (message: Message) => void;
  _handleReactionUpdate: (data: {
    messageId: string;
    reactions: Array<{ emoji: string; by: string[]; count: number }>;
  }) => void;
  _handleMessageAck: (payload: {
    clientMsgId: string;
    serverId: string;
  }) => void;
  _handleMessageNack: (payload: {
    clientMsgId: string;
    error: string;
    details?: any;
  }) => void;
  _handleRoomHistory: (payload: { roomId: string; history: Message[] }) => void;
  _handleConversationCreated: (data: {
    conversationId: string;
    participants: string[];
    type: 'dm' | 'group';
    name?: string;
    initiatedBy: string;
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
  _incrementUnreadCount: (roomId: string) => void;
  _clearUnreadCount: (roomId: string) => void;
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
          get()._refreshSocketListeners();
          
          // Listen for reconnection events to refresh listeners
          socket.on('client:reconnected', (data: any) => {
            console.log('🔄 Socket reconnected - refreshing event listeners', data);
            // Small delay to ensure socket is fully ready
            setTimeout(() => {
              console.log('🔄 Executing listener refresh after reconnection');
              get()._refreshSocketListeners();
              
              // Always sync after reconnection - don't depend on activeRoomId
              console.log('🔄 WhatsApp-style: Starting bulk sync after reconnection');
              console.log('🔄 Reconnection trigger:', data.trigger || 'unknown');
              console.log('🔄 Active room ID:', get().activeRoomId || 'none');
              console.log('🔄 Loaded rooms count:', get().loadedRooms.size);
              
              // Force sync regardless of active room state
              get()._syncAllRoomsAfterBackground();
            }, 50);
          });
        }

        // Bootstrap data
        if (initialData) {
          set(
            {
              user: initialData.user,
              conversations: initialData.conversations,
            },
            false,
            'initialize-with-data'
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
          socket.off('msg:new');
          socket.off('msg:ack');
          socket.off('msg:nack');
          socket.off('room:history');
          socket.off('msg:react');
          socket.off('msg:react:ack');
          socket.off('msg:react:nack');
          socket.off('client:reconnected');
          socket = null;
        }
      },

      selectRoom: (roomId: string) => {
        const state = get();

        // Set active room
        state._setActiveRoom(roomId);

        // Clear unread count when selecting a conversation
        state._clearUnreadCount(roomId);

        // Join room if not already joined
        if (!state.joinedRooms.has(roomId) && socket) {
          console.log('🚀 Joining room:', roomId);
          state._addJoinedRoom(roomId);
          socket.emit('room:join', { id: roomId });
        } else {
          console.log(
            '🔵 Room already joined or no socket:',
            roomId,
            'joined:',
            state.joinedRooms.has(roomId),
            'socket:',
            !!socket
          );
        }

        // Load messages if needed
        const hasMessages = (state.messagesByRoom[roomId]?.length ?? 0) > 0;
        const isLoading = state.loadingRooms.has(roomId);
        const alreadyLoaded = state.loadedRooms.has(roomId);

        if (!hasMessages && !isLoading && !alreadyLoaded) {
          state._loadRoomMessages(roomId);
        }
      },

      sendMessage: async (content: string) => {
        const state = get();
        if (!state.activeRoomId || !state.user || !socket) return;

        // Generate proper UUID for clientMsgId (with fallback for older browsers)
        const clientMsgId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? 
          crypto.randomUUID() : 
          'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        const optimisticMessage: Message = {
          id: clientMsgId,
          content,
          userId: state.user.id,
          roomId: state.activeRoomId,
          createdAt: new Date().toISOString(),
          pending: true,
          clientMsgId,
        };

        // Add optimistic message
        state._addOptimisticMessage(optimisticMessage);
        state._triggerScrollToBottom();

        // Update conversation preview immediately for our own messages
        state._updateConversationPreview(state.activeRoomId, content);

        // Send to server with correct field name
        socket.emit('msg:send', {
          roomId: state.activeRoomId, // Changed from conversationId to roomId
          content,
          clientMsgId,
        });
      },

      reactToMessage: async (messageId: string, emoji: string) => {
        const state = get();
        if (!state.activeRoomId || !state.user || !socket) return;

        console.log('🎭 Reacting to message:', messageId, 'with:', emoji);

        // Send reaction to server
        socket.emit('msg:react', {
          messageId,
          emoji,
          roomId: state.activeRoomId,
        });

        // Optimistically update the message locally (WhatsApp behavior: one reaction per user)
        const messages = state.messagesByRoom[state.activeRoomId] || [];
        const messageIndex = messages.findIndex(
          m => m.id === messageId || m.clientMsgId === messageId
        );

        if (messageIndex !== -1) {
          const message = messages[messageIndex];
          if (!message) return;

          const reactions = message.reactions || [];
          const userId = state.user!.id;

          // Remove user's previous reaction (if any)
          let updatedReactions = reactions
            .map(r => ({
              ...r,
              by: r.by?.filter(id => id !== userId) || [],
              count: Math.max(
                0,
                (r.count || 1) - (r.by?.includes(userId) ? 1 : 0)
              ),
            }))
            .filter(r => r.count > 0); // Remove reactions with 0 count

          // Check if user is clicking the same emoji they already reacted with
          const existingReaction = reactions.find(r => r.emoji === emoji);
          const userAlreadyReactedWithThis =
            existingReaction?.by?.includes(userId);

          if (userAlreadyReactedWithThis) {
            // User clicked their own reaction - remove it (already handled above)
            console.log("🎭 Removing user's reaction:", emoji);
          } else {
            // Add user's new reaction
            console.log("🎭 Adding user's new reaction:", emoji);
            const existingEmojiIndex = updatedReactions.findIndex(
              r => r.emoji === emoji
            );

            if (existingEmojiIndex !== -1) {
              // Emoji already exists, add user to it
              const existingEmojiReaction =
                updatedReactions[existingEmojiIndex];
              if (existingEmojiReaction) {
                updatedReactions[existingEmojiIndex] = {
                  emoji: existingEmojiReaction.emoji,
                  by: [...(existingEmojiReaction.by || []), userId],
                  count: (existingEmojiReaction.count || 0) + 1,
                };
              }
            } else {
              // New emoji reaction
              updatedReactions.push({
                emoji,
                by: [userId],
                count: 1,
              });
            }
          }

          // Update the message with new reactions
          const updatedMessages = [...messages];
          updatedMessages[messageIndex] = {
            ...message,
            reactions: updatedReactions,
          };

          state._setMessages(state.activeRoomId, updatedMessages);
        }
      },

      // INTERNAL METHODS - Store uses these internally
      _bootstrapData: async () => {
        try {
          const { getMe, listConversations } = await import('@/lib/api');
          const [user, conversations] = await Promise.all([
            getMe(),
            listConversations(),
          ]);

          set({ user, conversations }, false, 'bootstrap-data');

          if (conversations.length > 0 && conversations[0]) {
            get().selectRoom(conversations[0].id);
          }

          // Load messages for all conversations to ensure proper previews
          // This is important for showing the correct "last received message" in the conversation list
          console.log(
            '🔄 Loading messages for all conversations to update previews'
          );
          for (const conversation of conversations) {
            if (
              !get().loadedRooms.has(conversation.id) &&
              !get().loadingRooms.has(conversation.id)
            ) {
              // Load messages in the background (don't await)
              get()._loadRoomMessages(conversation.id).catch(console.error);
            }
          }
        } catch (error) {
          console.error('Bootstrap failed:', error);
        }
      },

      _syncAllRoomsAfterBackground: async () => {
        console.log('🔄 WhatsApp-style: Syncing all rooms after background period');
        const state = get();
        
        // Get all conversations that the user has (not just loaded rooms)
        const allRoomIds = state.conversations.map(conv => conv.id);
        console.log('🔄 Syncing all user conversations:', allRoomIds.length);
        
        // Sync all conversation rooms concurrently (like WhatsApp bulk sync)
        const syncPromises = allRoomIds.map(roomId => 
          state._syncRoomAfterReconnection(roomId)
        );
        
        try {
          await Promise.all(syncPromises);
          console.log('✅ All rooms synced successfully after background');
        } catch (error) {
          console.error('❌ Error syncing rooms after background:', error);
        }
      },

      _syncRoomAfterReconnection: async (roomId: string) => {
        console.log('🔄 Syncing room after reconnection (bypassing cache):', roomId);
        const state = get();
        state._addLoadingRoom(roomId);

        try {
          const { listMessages } = await import('@/lib/api');

          // Bypass cache by calling listMessages directly without trackRequest
          console.log('📡 Fetching fresh messages from API for room:', roomId);
          const freshMessages = await listMessages(roomId);

          console.log('🔄 Updating room with fresh messages:', {
            roomId,
            oldCount: state.messagesByRoom[roomId]?.length || 0,
            newCount: freshMessages.length,
          });

          state._setMessages(roomId, freshMessages);
          state._addLoadedRoom(roomId);

          // Update conversation previews
          state._updateAllConversationPreviews();

          console.log('✅ Room synced successfully after reconnection:', roomId);
        } catch (error) {
          console.error('❌ Failed to sync room after reconnection:', error);
        } finally {
          state._removeLoadingRoom(roomId);
        }
      },

      _loadRoomMessages: async (roomId: string) => {
        const state = get();
        state._addLoadingRoom(roomId);

        try {
          const { listMessages } = await import('@/lib/api');
          const { trackRequest } = await import('@/lib/request-tracker');

          const messages = await trackRequest(`messages-${roomId}`, () =>
            listMessages(roomId)
          );

          state._setMessages(roomId, messages);
          state._addLoadedRoom(roomId);

          // Update conversation previews after loading messages to show only received messages
          state._updateAllConversationPreviews();

          console.log(
            '✅ Messages loaded and conversation previews updated for room:',
            roomId
          );
        } catch (error) {
          console.error('Failed to load messages:', error);
        } finally {
          state._removeLoadingRoom(roomId);
        }
      },

      _handleNewMessage: async (rawMessage: Message) => {
        console.log('🔵 _handleNewMessage called with:', rawMessage);
        const message = { ...rawMessage } as Message;
        console.log('🔵 Adding message to store for roomId:', message.roomId);
        const currentState = get();
        console.log(
          '🔵 Current messages for room before add:',
          currentState.messagesByRoom[message.roomId]?.length || 0
        );
        get()._addMessage(message);
        const afterState = get();
        console.log(
          '🔵 Current messages for room after add:',
          afterState.messagesByRoom[message.roomId]?.length || 0
        );

        // Only update conversation preview if this message is from someone else (received message)
        const currentUser = afterState.user;
        if (currentUser && message.userId !== currentUser.id) {
          console.log(
            '🔔 Message from someone else - updating conversation preview'
          );

          // Check if conversation exists in local state
          const conversationExists = afterState.conversations.some(
            c => c.id === message.roomId
          );
          console.log(
            '🔍 Conversation exists in local state:',
            conversationExists,
            'for roomId:',
            message.roomId
          );

          if (!conversationExists) {
            console.log(
              '⚠️ Conversation not found in local state - refreshing conversations list...'
            );
            try {
              // Refresh conversations to ensure we have the latest data
              const { listConversations } = await import('@/lib/api');
              const updatedConversations = await listConversations();

              console.log(
                '📋 Refreshed conversations count:',
                updatedConversations.length
              );
              console.log(
                '🔍 Looking for roomId after refresh:',
                message.roomId
              );
              const refreshedConversation = updatedConversations.find(
                c => c.id === message.roomId
              );
              console.log(
                '🔍 Found conversation after refresh:',
                !!refreshedConversation,
                refreshedConversation?.name
              );

              set(
                { conversations: updatedConversations },
                false,
                'refresh-conversations-on-new-message'
              );

              // Auto-join the room if we're not already joined
              if (socket && !get().joinedRooms.has(message.roomId)) {
                console.log(
                  '🚀 Auto-joining room for new message:',
                  message.roomId
                );
                get()._addJoinedRoom(message.roomId);
                socket.emit('room:join', { id: message.roomId });
              }
            } catch (error) {
              console.error('❌ Failed to refresh conversations:', error);
            }
          }

          get()._updateConversationPreview(
            message.roomId,
            message.content || '[File]'
          );

          // Only increment unread count if this is NOT the currently active conversation
          const isActiveConversation = get().activeRoomId === message.roomId;
          console.log('🔍 Unread count check:', {
            messageRoomId: message.roomId,
            activeRoomId: get().activeRoomId,
            isActiveConversation,
            messageFromUserId: message.userId,
            currentUserId: currentUser.id,
          });

          if (!isActiveConversation) {
            console.log(
              '📫 Message for inactive conversation - incrementing unread count for room:',
              message.roomId
            );
            get()._incrementUnreadCount(message.roomId);
          } else {
            console.log(
              '👁️ Message for active conversation - not incrementing unread count (user is viewing)'
            );
          }
        } else {
          console.log(
            '🚫 Message from current user - NOT updating conversation preview or unread count'
          );
        }
        // Don't auto-scroll for incoming messages - let ChatMessageList handle it based on user position
        // get()._triggerScrollToBottom();
      },

      _handleMessageAck: (payload: {
        clientMsgId: string;
        serverId: string;
      }) => {
        console.log('✅ Message acknowledged:', payload);

        const state = get();
        if (!state.activeRoomId) return;

        // Find and update the pending message to mark it as sent
        const messages = state.messagesByRoom[state.activeRoomId] || [];
        const messageIndex = messages.findIndex(
          (m: Message) => m.clientMsgId === payload.clientMsgId
        );

        if (messageIndex !== -1) {
          const updatedMessages = [...messages];
          const originalMessage = updatedMessages[messageIndex];

          // Update the message with the server ID and remove pending status
          updatedMessages[messageIndex] = {
            ...originalMessage,
            id: payload.serverId,
            pending: false, // Mark as no longer pending (sent successfully)
          } as Message;

          set(
            (state: ChatStore) => ({
              ...state,
              messagesByRoom: {
                ...state.messagesByRoom,
                [state.activeRoomId!]: updatedMessages,
              },
            }),
            false,
            'message-ack'
          );

          console.log(
            '📝 Message marked as sent (no longer pending):',
            payload.serverId
          );
        }
      },
      _handleMessageNack: (payload: {
        clientMsgId: string;
        error: string;
        details?: any;
      }) => {
        const state = get();
        if (!state.activeRoomId) return;

        console.error('❌ Message failed to send:', payload);

        // Mark the message as failed
        state._updateMessage(state.activeRoomId, payload.clientMsgId, {
          pending: false,
          error: true,
        });
      },

      _refreshSocketListeners: () => {
        if (!socket) return;

        console.log('🔄 Refreshing socket listeners');
        console.log('🔍 Socket instance:', !!socket);
        console.log('🔍 Socket connected:', socket.connected);
        console.log('🔍 Socket ID:', socket.id);

        const {
          _handleNewMessage,
          _handleMessageAck,
          _handleMessageNack,
          _handleRoomHistory,
          _handleReactionUpdate,
          _handleConversationCreated,
        } = get();

        // Remove existing listeners first to avoid duplicates
        socket.off('msg:new');
        socket.off('msg:ack');
        socket.off('msg:nack');
        socket.off('room:history');
        socket.off('msg:react');
        socket.off('msg:react:ack');
        socket.off('msg:react:nack');
        socket.off('conversation:created');
        socket.off('connect');
        socket.off('disconnect');

        console.log('🟢 Setting up fresh socket listeners');

        // Add debugging listener for all events
        socket.onAny((eventName: string, ...args: any[]) => {
          console.log('🎧 Socket received event:', eventName, args);
        });

        socket.on('msg:new', (data: any) => {
          console.log('🟢 Socket received msg:new event:', data);
          _handleNewMessage(data);
        });
        socket.on('msg:ack', _handleMessageAck);
        socket.on('msg:nack', _handleMessageNack);
        socket.on('room:history', _handleRoomHistory);
        socket.on('msg:react', (data: any) => {
          console.log('🎭 Socket received msg:react event:', data);
          console.log('🔍 Current document visibility:', document.hidden ? 'HIDDEN' : 'VISIBLE');
          console.log('🔍 Current active room:', get().activeRoomId);
          _handleReactionUpdate(data);
        });
        socket.on('msg:react:ack', (data: any) => {
          console.log('🎭 Reaction acknowledged:', data);
        });
        socket.on('msg:react:nack', (data: any) => {
          console.error('🎭 Reaction failed:', data);
        });
        socket.on('conversation:created', (data: any) => {
          console.log('🟢 === WebSocket Event Received ===');
          console.log('🟢 Event type: conversation:created');
          console.log('🟢 Socket connected:', socket.connected);
          console.log('🟢 Socket id:', socket.id);
          console.log('🟢 New conversation created event received:', data);
          console.log(
            '🔍 Event data details:',
            JSON.stringify(data, null, 2)
          );
          _handleConversationCreated(data);
        });

        // Add connection debugging
        socket.on('connect', () => {
          console.log('🟢 Socket connected to:', socket.io.uri);
          console.log('🟢 Socket namespace:', socket.nsp);
          console.log('🟢 Socket id:', socket.id);
        });
        socket.on('disconnect', () => {
          console.log('🔴 Socket disconnected');
        });
        
        console.log('✅ Socket listeners refreshed successfully');
      },

      _handleRoomHistory: (payload: { roomId: string; history: Message[] }) => {
        get()._setMessages(payload.roomId, payload.history);
        // Update conversation previews after loading room history
        get()._updateAllConversationPreviews();
      },

      _handleConversationCreated: async (data: {
        conversationId: string;
        participants: string[];
        type: 'dm' | 'group';
        name?: string;
        initiatedBy: string;
      }) => {
        console.log('🟢 === CONVERSATION CREATED EVENT ===');
        console.log('🟢 Event data:', JSON.stringify(data, null, 2));
        console.log('🔍 Current user ID:', get().user?.id);
        console.log('🔍 Participants:', data.participants);
        console.log('🔍 Conversation type:', data.type);
        console.log('🔍 Conversation name:', data.name);
        console.log('🔍 Initiated by:', data.initiatedBy);
        console.log(
          '🔍 User involved?:',
          data.participants.includes(get().user?.id || '')
        );

        const state = get();

        // Check if the current user is involved in this conversation
        if (!data.participants.includes(state.user?.id || '')) {
          console.log(
            '❌ Current user not involved in this conversation, ignoring'
          );
          return; // This conversation doesn't involve the current user
        }

        console.log('✅ Current user is involved, refreshing conversations...');
        console.log('📊 Current conversations count:', state.conversations.length);
        console.log('📊 Current conversation IDs:', state.conversations.map(c => ({ id: c.id, name: c.name })));
        
        try {
          // Add a small delay to ensure cache invalidation has completed on backend
          await new Promise(resolve => setTimeout(resolve, 100));

          // Refresh the conversations list to include the new conversation
          const { listConversations } = await import('@/lib/api');
          console.log('📡 Fetching updated conversations from API...');
          const updatedConversations = await listConversations();

          console.log(
            '📋 Updated conversations count:',
            updatedConversations.length
          );
          console.log(
            '🔍 All conversation IDs:',
            updatedConversations.map(c => ({ id: c.id, name: c.name }))
          );
          console.log('🔍 Looking for new conversation:', data.conversationId);
          const newConv = updatedConversations.find(
            c => c.id === data.conversationId
          );
          console.log(
            '🔍 New conversation found in list:',
            !!newConv,
            newConv ? { id: newConv.id, name: newConv.name } : 'NOT FOUND'
          );

          set(
            { conversations: updatedConversations },
            false,
            'conversation-created'
          );

          // CRITICAL: All participants must join the room to receive messages
          if (socket && !get().joinedRooms.has(data.conversationId)) {
            console.log(
              '🚀 Auto-joining room for conversation participant:',
              data.conversationId
            );
            console.log('🔍 Socket connected:', socket.connected);
            console.log(
              '🔍 Current joined rooms:',
              Array.from(get().joinedRooms)
            );

            get()._addJoinedRoom(data.conversationId);
            socket.emit('room:join', { id: data.conversationId });

            console.log('✅ Room join event emitted for:', data.conversationId);
            console.log(
              '🔍 Updated joined rooms:',
              Array.from(get().joinedRooms)
            );
          } else {
            console.log(
              '⚠️ Room join skipped - socket:',
              !!socket,
              'already joined:',
              get().joinedRooms.has(data.conversationId)
            );
          }

          // If this user initiated the conversation, auto-select it
          if (data.initiatedBy === state.user?.id) {
            console.log(
              '🎯 Auto-selecting new conversation:',
              data.conversationId
            );
            get().selectRoom(data.conversationId);
          }
        } catch (error) {
          console.error(
            '❌ Failed to refresh conversations after creation:',
            error
          );
        }
      },

      _handleReactionUpdate: (data: {
        messageId: string;
        reactions: Array<{ emoji: string; by: string[]; count: number }>;
      }) => {
        console.log('🎭 Handling reaction update:', data);
        console.log('🔍 Document visible when handling:', !document.hidden);
        console.log('🔍 Current timestamp:', new Date().toISOString());
        const state = get();

        // Find the message across all rooms and update its reactions
        for (const [roomId, messages] of Object.entries(state.messagesByRoom)) {
          const messageIndex = messages.findIndex(
            m => m.id === data.messageId || m.clientMsgId === data.messageId
          );
          if (messageIndex !== -1) {
            console.log(
              '🎭 Found message to update reactions in room:',
              roomId
            );
            const updatedMessages = [...messages];
            const originalMessage = updatedMessages[messageIndex];
            if (originalMessage) {
              updatedMessages[messageIndex] = {
                ...originalMessage,
                reactions: data.reactions,
              };
              state._setMessages(roomId, updatedMessages);
            }
            break;
          }
        }
      },

      // Simple state setters
      _setActiveRoom: (roomId: string) =>
        set({ activeRoomId: roomId }, false, 'setActiveRoom'),

      _addJoinedRoom: (roomId: string) =>
        set(
          state => {
            const newJoinedRooms = new Set(state.joinedRooms);
            newJoinedRooms.add(roomId);
            return { joinedRooms: newJoinedRooms };
          },
          false,
          'addJoinedRoom'
        ),

      _addLoadedRoom: (roomId: string) =>
        set(
          state => {
            const newLoadedRooms = new Set(state.loadedRooms);
            newLoadedRooms.add(roomId);
            return { loadedRooms: newLoadedRooms };
          },
          false,
          'addLoadedRoom'
        ),

      _addLoadingRoom: (roomId: string) =>
        set(
          state => {
            const newLoadingRooms = new Set(state.loadingRooms);
            newLoadingRooms.add(roomId);
            return { loadingRooms: newLoadingRooms };
          },
          false,
          'addLoadingRoom'
        ),

      _removeLoadingRoom: (roomId: string) =>
        set(
          state => {
            const newLoadingRooms = new Set(state.loadingRooms);
            newLoadingRooms.delete(roomId);
            return { loadingRooms: newLoadingRooms };
          },
          false,
          'removeLoadingRoom'
        ),

      _setMessages: (roomId: string, messages: Message[]) =>
        set(
          state => ({
            messagesByRoom: {
              ...state.messagesByRoom,
              [roomId]: messages,
            },
          }),
          false,
          'setMessages'
        ),

      _addMessage: (message: Message) =>
        set(
          state => {
            const roomId = message.roomId;
            const currentMessages = state.messagesByRoom[roomId] || [];

            // Check if we already have a message with this clientMsgId (optimistic message)
            const existingIndex = currentMessages.findIndex(
              m => message.clientMsgId && m.clientMsgId === message.clientMsgId
            );

            let updatedMessages: Message[];
            if (existingIndex !== -1) {
              // Replace the optimistic message with the server version
              updatedMessages = [...currentMessages];
              updatedMessages[existingIndex] = message;
            } else {
              // Check for duplicate by id (for messages without clientMsgId)
              if (currentMessages.some(m => m.id === message.id)) {
                return state;
              }
              // Add new message
              updatedMessages = [...currentMessages, message];
            }

            return {
              messagesByRoom: {
                ...state.messagesByRoom,
                [roomId]: updatedMessages,
              },
            };
          },
          false,
          'addMessage'
        ),

      _updateConversationPreview: (roomId: string, content: string) =>
        set(
          state => {
            console.log(
              '🔄 Before updating conversations. Total conversations:',
              state.conversations.length
            );
            console.log('🔄 Looking for conversation with roomId:', roomId);
            console.log('🔄 Current user:', state.user?.username);
            console.log(
              '🔄 All conversations:',
              state.conversations.map(c => ({
                id: c.id,
                name: c.name,
                last: c.last,
              }))
            );

            // Update conversations array with the latest message preview
            const updatedConversations = state.conversations.map(convo => {
              console.log(
                '🔍 Checking conversation:',
                convo.id,
                convo.name,
                'vs roomId:',
                roomId
              );
              if (convo.id === roomId) {
                console.log(
                  '🔄 Updating conversation preview:',
                  convo.name,
                  'with message:',
                  content
                );
                return {
                  ...convo,
                  last: content,
                  lastMessageAt: new Date().toISOString(), // Add current timestamp for sorting
                };
              }
              return convo;
            });

            // Sort conversations by latest message timestamp (most recent first)
            updatedConversations.sort((a, b) => {
              if (!a.lastMessageAt && !b.lastMessageAt) return 0;
              if (!a.lastMessageAt) return 1;
              if (!b.lastMessageAt) return -1;
              return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
            });

            console.log(
              '🔄 After updating conversations. Changes made:',
              updatedConversations.some(
                (convo, index) =>
                  convo.last !== state.conversations[index]?.last ||
                  convo.lastMessageAt !== state.conversations[index]?.lastMessageAt
              )
            );
            console.log(
              '🔄 Updated conversations:',
              updatedConversations.map(c => ({
                id: c.id,
                name: c.name,
                last: c.last,
              }))
            );

            return {
              conversations: updatedConversations,
            };
          },
          false,
          'updateConversationPreview'
        ),

      _updateAllConversationPreviews: () =>
        set(
          state => {
            if (!state.user) {
              console.log(
                '🔄 No user found, skipping conversation preview update'
              );
              return state;
            }

            console.log(
              '🔄 Updating all conversation previews for user:',
              state.user.username,
              'userId:',
              state.user.id
            );

            const updatedConversations = state.conversations.map(convo => {
              const messages = state.messagesByRoom[convo.id] || [];
              console.log(
                '🔍 Conversation:',
                convo.name,
                'has',
                messages.length,
                'messages'
              );

              // Find the latest message from anyone (including current user)
              const latestMessage = messages
                .slice()
                .reverse() // Start from the latest messages
                .find(msg => msg.content && msg.content.trim() !== ''); // Find first non-empty message

              console.log(
                '🔍 Latest message found:',
                latestMessage?.content,
                'from userId:',
                latestMessage?.userId,
                'current user:',
                state.user!.id,
                'is from me:',
                latestMessage?.userId === state.user!.id
              );

              const newLast = latestMessage?.content || null;
              
              // Just show the message content without sender information
              let formattedLast = newLast;

              console.log(
                '🔄 Conversation:',
                convo.name,
                'old last:',
                convo.last,
                'new last:',
                formattedLast,
                'latest message from userId:',
                latestMessage?.userId
              );

              return {
                ...convo,
                last: formattedLast,
              };
            });

            return {
              conversations: updatedConversations,
            };
          },
          false,
          'updateAllConversationPreviews'
        ),

      _updateMessage: (
        roomId: string,
        messageId: string,
        updates: Partial<Message>
      ) =>
        set(
          state => {
            const messages = state.messagesByRoom[roomId];
            if (!messages) return state;

            const updatedMessages = messages.map(msg =>
              // Search by clientMsgId first (for pending messages), then by id
              msg.clientMsgId === messageId || msg.id === messageId
                ? { ...msg, ...updates }
                : msg
            );

            return {
              messagesByRoom: {
                ...state.messagesByRoom,
                [roomId]: updatedMessages,
              },
            };
          },
          false,
          'updateMessage'
        ),

      _addOptimisticMessage: (message: Message) =>
        set(
          state => {
            const roomId = message.roomId;
            const currentMessages = state.messagesByRoom[roomId] || [];

            return {
              messagesByRoom: {
                ...state.messagesByRoom,
                [roomId]: [...currentMessages, message],
              },
            };
          },
          false,
          'addOptimisticMessage'
        ),

      _incrementUnreadCount: (roomId: string) =>
        set(
          state => {
            console.log('📫 _incrementUnreadCount called for roomId:', roomId);
            console.log(
              '📫 Available conversations:',
              state.conversations.map(c => ({
                id: c.id,
                name: c.name,
                unread: c.unread,
              }))
            );

            const targetConversation = state.conversations.find(
              convo => convo.id === roomId
            );
            if (!targetConversation) {
              console.warn(
                '⚠️ Cannot increment unread count - conversation not found in store:',
                roomId
              );
              console.warn(
                '📋 Current conversations:',
                state.conversations.map(c => c.id)
              );
              console.warn(
                '🔄 This might be a timing issue - conversation may not be loaded yet'
              );
              return state; // Return unchanged state if conversation doesn't exist
            }

            const updatedConversations = state.conversations.map(convo => {
              if (convo.id === roomId) {
                const currentUnread = convo.unread || 0;
                console.log(
                  '📫 Incrementing unread count for:',
                  convo.name,
                  'from',
                  currentUnread,
                  'to',
                  currentUnread + 1
                );
                return {
                  ...convo,
                  unread: currentUnread + 1,
                };
              }
              return convo;
            });

            console.log(
              '✅ Unread count incremented successfully for:',
              roomId
            );
            return {
              conversations: updatedConversations,
            };
          },
          false,
          'incrementUnreadCount'
        ),

      _clearUnreadCount: (roomId: string) =>
        set(
          state => {
            const updatedConversations = state.conversations.map(convo => {
              if (convo.id === roomId && convo.unread) {
                console.log(
                  '📬 Clearing unread count for:',
                  convo.name,
                  'was',
                  convo.unread
                );
                return {
                  ...convo,
                  unread: 0,
                };
              }
              return convo;
            });

            return {
              conversations: updatedConversations,
            };
          },
          false,
          'clearUnreadCount'
        ),

      _triggerScrollToBottom: () =>
        set(
          state => ({
            forceScrollToBottom: state.forceScrollToBottom + 1,
          }),
          false,
          'triggerScrollToBottom'
        ),
    }),
    {
      name: 'chat-store',
    }
  )
);

export default useChatStore;
