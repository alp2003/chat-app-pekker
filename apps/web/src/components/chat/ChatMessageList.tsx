"use client";
import {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    forwardRef
} from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import type { Message } from "@/lib/types/chat";
import ChatBubble from "./ChatBubble";

export default function ChatMessageList({
    messages, // oldest -> newest
    me,
    conversationKey, // active room id
    getPeer,
    onStartReached
}: {
    messages: Message[];
    me: string;
    conversationKey?: string;
    getPeer?: (
        userId: string
    ) => { name?: string; avatar?: string | null } | undefined;
    onStartReached?: () => void;
}) {
    const vRef = useRef<VirtuosoHandle | null>(null);
    const [atBottom, setAtBottom] = useState(true);
    const [unseen, setUnseen] = useState(0);
    const lastCountRef = useRef(0);

    // Snap to absolute bottom on conversation change
    useLayoutEffect(() => {
        lastCountRef.current = messages.length;
        setUnseen(0);
        if (messages.length === 0) return;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                // ↓ hard jump to bottom (avoid align:'end' off-by-a-few-px)
                vRef.current?.scrollTo({ top: 1e9, behavior: "auto" });
            });
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversationKey]);

    // Auto-scroll on new messages
    useEffect(() => {
        const prev = lastCountRef.current;
        const curr = messages.length;
        if (curr <= prev) return;

        const last = messages[curr - 1];
        const mine = last?.userId === me;

        if (mine || atBottom) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    // ↓ reliably reach the last bubble
                    vRef.current?.scrollTo({ top: 1e9, behavior: "smooth" });
                });
            });
            setUnseen(0);
        } else {
            setUnseen((u) => u + (curr - prev));
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
                            className={`h-full overflow-y-auto scrollbar-none ${className ?? ""}`}
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
                data={messages}
                className="h-full"
                components={{ Scroller }}
                alignToBottom
                followOutput={false} // we do the jumps ourselves
                atBottomStateChange={setAtBottom}
                startReached={onStartReached}
                increaseViewportBy={{ top: 200, bottom: 400 }}
                computeItemKey={(i, m) => m.id ?? String(i)}
                itemContent={(i, m) => {
                    const mine = m.userId === me;
                    const peer =
                        !mine && getPeer ? getPeer(m.userId) : undefined;
                    return (
                        <ChatBubble
                            m={m}
                            mine={mine}
                            name={peer?.name}
                            avatar={peer?.avatar}
                        />
                    );
                }}
            />

            {unseen > 0 && !atBottom && (
                <button
                    onClick={() => {
                        // ↓ same hard jump
                        vRef.current?.scrollTo({
                            top: 1e9,
                            behavior: "instant"
                        });
                        setUnseen(0);
                    }}
                    className="pointer-events-auto absolute bottom-16 left-1/2 -translate-x-1/2 rounded-full
                     bg-slate-400 px-3 py-1 text-xs text-white shadow hover:bg-slate-500 transition"
                >
                    {unseen} new message{unseen > 1 ? "s" : ""} • Jump
                </button>
            )}
        </div>
    );
}
