'use client';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
} from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import type { Message } from '@/lib/types/chat';
import ChatBubble from './ChatBubble';

// Message item types for the virtualized list
type MessageItem =
  | { type: 'message'; message: Message; index: number }
  | { type: 'dateSeparator'; date: string };

// Utility functions for date formatting
function formatDateSeparator(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Reset time for accurate comparison
  const messageDate = new Date(date);
  messageDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  yesterday.setHours(0, 0, 0, 0);

  if (messageDate.getTime() === today.getTime()) {
    return 'Today';
  } else if (messageDate.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  } else {
    // Format as "Monday, December 25, 2024"
    return messageDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function groupMessagesByDay(messages: Message[]): MessageItem[] {
  if (messages.length === 0) return [];

  const items: MessageItem[] = [];
  let currentDate: Date | null = null;

  messages.forEach((message, index) => {
    const messageDate = new Date(message.createdAt);

    // Add date separator if this is a new day
    if (!currentDate || !isSameDay(currentDate, messageDate)) {
      items.push({
        type: 'dateSeparator',
        date: formatDateSeparator(messageDate),
      });
      currentDate = messageDate;
    }

    // Add the message
    items.push({
      type: 'message',
      message,
      index,
    });
  });

  return items;
}

export default function ChatMessageList({
  messages, // oldest -> newest
  me,
  conversationKey, // active room id
  getPeer,
  onStartReached,
  onReact,
  forceScrollToBottom, // Add this prop to force scrolling
  isGroup, // Add this prop to indicate if it's a group chat
}: {
  messages: Message[];
  me: string;
  conversationKey?: string;
  getPeer?: (
    userId: string
  ) => { name?: string; avatar?: string | null } | undefined;
  onStartReached?: () => void;
  onReact?: (message: Message, emoji: string) => void;
  forceScrollToBottom?: number; // timestamp to force scroll
  isGroup?: boolean; // Add this prop type
}) {
  const vRef = useRef<VirtuosoHandle | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [unseen, setUnseen] = useState(0);
  const lastCountRef = useRef(0);
  const lastConversationKeyRef = useRef<string | undefined>(undefined);
  const hasScrolledForCurrentConversation = useRef(false);
  const lastForceScrollRef = useRef<number>(0);

  // Group messages by day
  const messageItems = useMemo(() => groupMessagesByDay(messages), [messages]);

  // Function to perform the scroll
  const performScrollToBottom = (reason: string) => {
    console.log(
      `� SCROLL TRIGGERED: ${reason} for conversation:`,
      conversationKey
    );
    console.log('📍 vRef.current exists:', !!vRef.current);
    console.log(
      '📍 messageItems.length:',
      messageItems.length,
      'messages.length:',
      messages.length
    );

    // Try multiple approaches to ensure scrolling works
    const scrollToBottom = () => {
      if (vRef.current && messageItems.length > 0) {
        console.log('📍 Primary scroll with scrollTo (reliable method)');
        // Use scrollTo as primary method - this is more reliable for getting to the absolute bottom
        vRef.current.scrollTo({ top: 1e9, behavior: 'auto' });

        // Backup: try scrollToIndex to the last message item after a delay
        setTimeout(() => {
          if (vRef.current && messageItems.length > 0) {
            const lastIndex = messageItems.length - 1;
            console.log(
              '📍 Backup scroll with scrollToIndex to index:',
              lastIndex
            );
            vRef.current.scrollToIndex({
              index: lastIndex,
              behavior: 'auto',
              align: 'start', // Try align: "start" to ensure we see the full message
            });
          }
        }, 50);
      } else {
        console.log(
          '📍 vRef.current or messageItems not ready, retrying in 100ms...'
        );
        setTimeout(() => {
          if (vRef.current) {
            console.log('📍 Retry scroll with scrollTo');
            vRef.current.scrollTo({ top: 1e9, behavior: 'auto' });
          }
        }, 100);
      }
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    });
  };

  // Handle forced scrolling
  useLayoutEffect(() => {
    if (
      forceScrollToBottom &&
      forceScrollToBottom !== lastForceScrollRef.current
    ) {
      lastForceScrollRef.current = forceScrollToBottom;
      if (messages.length > 0) {
        console.log('🚨 FORCE SCROLL triggered!', forceScrollToBottom);
        performScrollToBottom('Force scroll');
      }
    }
  }, [forceScrollToBottom, messages.length, messageItems.length]);

  // Snap to absolute bottom on conversation change
  useLayoutEffect(() => {
    const conversationChanged =
      lastConversationKeyRef.current !== conversationKey;
    lastConversationKeyRef.current = conversationKey;

    console.log('🔄 ChatMessageList conversation useLayoutEffect:', {
      conversationKey,
      conversationChanged,
      hasScrolledForCurrentConversation:
        hasScrolledForCurrentConversation.current,
      messagesLength: messages.length,
      willScroll: conversationChanged && messages.length > 0,
    });

    if (conversationChanged) {
      hasScrolledForCurrentConversation.current = false;
      lastCountRef.current = messages.length;
      setUnseen(0);

      // Always scroll to bottom when conversation changes (user clicked on conversation)
      if (messages.length > 0) {
        console.log('🚨 CONVERSATION CHANGE - scrolling to latest message');
        hasScrolledForCurrentConversation.current = true;
        performScrollToBottom('Conversation selection scroll');
      }
    } else if (
      !hasScrolledForCurrentConversation.current &&
      messages.length > 0
    ) {
      // First time loading messages for this conversation
      console.log('🚨 INITIAL CONVERSATION LOAD - scrolling to latest message');
      hasScrolledForCurrentConversation.current = true;
      performScrollToBottom('Initial conversation scroll');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationKey, messages.length]); // Added messages.length back to ensure scroll happens when messages load

  // Auto-scroll on new messages
  useEffect(() => {
    const prev = lastCountRef.current;
    const curr = messages.length;
    if (curr <= prev) return;

    const last = messages[curr - 1];
    const mine = last?.userId === me;

    console.log('📨 New message detected:', {
      mine,
      atBottom,
      unseen,
      messageContent: last?.content?.substring(0, 20) + '...',
      shouldAutoScroll: mine || atBottom,
      willShowJumpButton: !mine && !atBottom,
      userId: last?.userId,
      myId: me,
    });

    // Auto-scroll for your own messages OR when you're at bottom
    // Jump button only shows for other users' messages when you're scrolled up
    if (mine || atBottom) {
      console.log(
        '🔄 Auto-scrolling to new message - Reason:',
        mine ? 'MY MESSAGE' : 'AT BOTTOM'
      );
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // ↓ reliably reach the last bubble
          vRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' });
        });
      });
      setUnseen(0);
    } else {
      // Other user's message while you're scrolled up - show jump button
      console.log('🔔 Showing jump button for new message');
      setUnseen(u => u + (curr - prev));
    }

    lastCountRef.current = curr;
  }, [messages, me, atBottom]);

  // Clear pill when user is back at bottom
  useEffect(() => {
    if (atBottom && unseen) setUnseen(0);
  }, [atBottom, unseen]);

  // Custom scroller to hide native scrollbar inside the list
  const Scroller = useMemo(
    () =>
      forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
        function Scroller({ className, ...props }, ref) {
          return (
            <div
              ref={ref}
              {...props}
              className={`h-full overflow-y-auto scrollbar-none ${className ?? ''}`}
            />
          );
        }
      ),
    []
  );

  return (
    <div className="relative h-full overflow-hidden">
      <Virtuoso
        ref={vRef}
        data={messageItems}
        className="h-full"
        components={{ Scroller }}
        alignToBottom
        followOutput={false} // we do the jumps ourselves
        atBottomStateChange={setAtBottom}
        startReached={onStartReached}
        increaseViewportBy={{ top: 200, bottom: 400 }}
        computeItemKey={(i, item) => {
          if (item.type === 'dateSeparator') {
            return `date-${item.date}`;
          }
          // Use clientMsgId for stable React keys (prevents duplicate key errors)
          return (
            item.message.clientMsgId ?? item.message.id ?? String(item.index)
          );
        }}
        itemContent={(i, item) => {
          if (item.type === 'dateSeparator') {
            return (
              <div className="flex justify-center py-4">
                <div className="rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs text-gray-600 dark:text-gray-400">
                  {item.date}
                </div>
              </div>
            );
          }

          const m = item.message;
          const mine = m.userId === me;
          const peer = !mine && getPeer ? getPeer(m.userId) : undefined;
          return (
            <ChatBubble
              m={m}
              mine={mine}
              me={me}
              name={peer?.name}
              avatar={peer?.avatar}
              isGroup={isGroup}
              onReact={onReact}
            />
          );
        }}
      />

      {/* Jump button - only shows when new messages arrive while scrolled up */}
      {unseen > 0 && !atBottom && (
        <button
          onClick={() => {
            // Jump to the new messages
            vRef.current?.scrollTo({
              top: 1e9,
              behavior: 'smooth',
            });
            setUnseen(0);
          }}
          className="pointer-events-auto absolute bottom-16 left-1/2 -translate-x-1/2 rounded-full
                     bg-blue-500 px-3 py-1.5 text-sm text-white shadow-lg hover:bg-blue-600 transition-all duration-200"
          title="Jump to new messages"
        >
          {unseen} new message{unseen > 1 ? 's' : ''} • Jump
        </button>
      )}
    </div>
  );
}
