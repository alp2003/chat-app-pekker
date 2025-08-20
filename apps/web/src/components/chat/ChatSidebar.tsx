"use client";
import { useState, useMemo } from "react";
import { Conversation } from "@/lib/types/chat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger
} from "@/components/ui/sheet";
import { Search, Menu, X } from "lucide-react";

function ConversationItem({
    c,
    active,
    onClick,
    searchQuery = ""
}: {
    c: Conversation;
    active?: boolean;
    onClick: () => void;
    searchQuery?: string;
}) {
    // Function to highlight search matches like WhatsApp
    const highlightMatch = (text: string, query: string) => {
        if (!query.trim()) return text;

        const regex = new RegExp(
            `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
            "gi"
        );
        const parts = text.split(regex);

        return parts.map((part, index) => {
            const isMatch = regex.test(part);
            return isMatch ? (
                <span
                    key={index}
                    className="bg-yellow-200 dark:bg-yellow-800/50 text-foreground"
                >
                    {part}
                </span>
            ) : (
                part
            );
        });
    };

    return (
        <button
            onClick={onClick}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition
      ${active ? "bg-accent" : "hover:bg-accent/50"}`}
        >
            <Avatar>
                {c.avatar ? (
                    <AvatarImage src={c.avatar} />
                ) : (
                    <AvatarFallback>
                        {c.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                )}
            </Avatar>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                        {highlightMatch(c.name, searchQuery)}
                    </span>
                    {c.online && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    )}
                    {c.unread ? (
                        <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                            {c.unread}
                        </span>
                    ) : null}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                    {c.last ? highlightMatch(c.last, searchQuery) : ""}
                </div>
            </div>
        </button>
    );
}

export function DesktopSidebar({
    convos,
    activeId,
    setActive,
    topSlot
}: {
    convos: Conversation[];
    activeId?: string;
    setActive: (id: string) => void;
    topSlot?: React.ReactNode; // e.g. new chat button
}) {
    const [searchQuery, setSearchQuery] = useState("");

    // Filter conversations based on search query (like WhatsApp)
    const filteredConvos = useMemo(() => {
        if (!searchQuery.trim()) return convos;

        const query = searchQuery.toLowerCase().trim();
        return convos.filter((convo) => {
            // Search in conversation name
            const nameMatch = convo.name.toLowerCase().includes(query);

            // Search in last message
            const messageMatch =
                convo.last?.toLowerCase().includes(query) ?? false;

            return nameMatch || messageMatch;
        });
    }, [convos, searchQuery]);

    return (
        <div className="hidden w-[320px] shrink-0 flex-col border-r md:flex">
            <div className="p-3">
                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search chats"
                        className="pl-8 pr-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
                {topSlot && <div className="mt-2">{topSlot}</div>}
            </div>
            <Separator />
            <ScrollArea className="h-[calc(100dvh-64px)] p-2">
                <div className="space-y-1">
                    {filteredConvos.length > 0 ? (
                        filteredConvos.map((c) => (
                            <ConversationItem
                                key={c.id}
                                c={c}
                                active={c.id === activeId}
                                onClick={() => setActive(c.id)}
                                searchQuery={searchQuery}
                            />
                        ))
                    ) : searchQuery ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Search className="h-12 w-12 text-muted-foreground mb-3" />
                            <p className="text-sm font-medium text-muted-foreground">
                                No chats found
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Try searching for something else
                            </p>
                        </div>
                    ) : null}
                </div>
            </ScrollArea>
        </div>
    );
}

export function MobileSidebar({
    convos,
    activeId,
    setActive
}: {
    convos: Conversation[];
    activeId?: string;
    setActive: (id: string) => void;
}) {
    const [searchQuery, setSearchQuery] = useState("");

    // Filter conversations based on search query (like WhatsApp)
    const filteredConvos = useMemo(() => {
        if (!searchQuery.trim()) return convos;

        const query = searchQuery.toLowerCase().trim();
        return convos.filter((convo) => {
            // Search in conversation name
            const nameMatch = convo.name.toLowerCase().includes(query);

            // Search in last message
            const messageMatch =
                convo.last?.toLowerCase().includes(query) ?? false;

            return nameMatch || messageMatch;
        });
    }, [convos, searchQuery]);

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[320px] p-0">
                <SheetHeader className="px-3 py-2">
                    <SheetTitle>Chats</SheetTitle>
                </SheetHeader>
                <div className="px-3 pb-2">
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search chats"
                            className="pl-8 pr-8"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
                <Separator />
                <ScrollArea className="h-[calc(100dvh-80px)] p-2">
                    <div className="space-y-1">
                        {filteredConvos.length > 0 ? (
                            filteredConvos.map((c) => (
                                <ConversationItem
                                    key={c.id}
                                    c={c}
                                    active={c.id === activeId}
                                    onClick={() => setActive(c.id)}
                                    searchQuery={searchQuery}
                                />
                            ))
                        ) : searchQuery ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <Search className="h-12 w-12 text-muted-foreground mb-3" />
                                <p className="text-sm font-medium text-muted-foreground">
                                    No chats found
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Try searching for something else
                                </p>
                            </div>
                        ) : null}
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}
