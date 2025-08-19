"use client";
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
import { Search, Menu } from "lucide-react";

function ConversationItem({
    c,
    active,
    onClick
}: {
    c: Conversation;
    active?: boolean;
    onClick: () => void;
}) {
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
                        {c.name}
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
                    {c.last ?? ""}
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
    return (
        <div className="hidden w-[320px] shrink-0 flex-col border-r md:flex">
            <div className="p-3">
                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search" className="pl-8" />
                </div>
                {topSlot && <div className="mt-2">{topSlot}</div>}
            </div>
            <Separator />
            <ScrollArea className="h-[calc(100dvh-64px)] p-2">
                <div className="space-y-1">
                    {convos.map((c) => (
                        <ConversationItem
                            key={c.id}
                            c={c}
                            active={c.id === activeId}
                            onClick={() => setActive(c.id)}
                        />
                    ))}
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
                    <Input placeholder="Search" />
                </div>
                <Separator />
                <ScrollArea className="h-[calc(100dvh-80px)] p-2">
                    <div className="space-y-1">
                        {convos.map((c) => (
                            <ConversationItem
                                key={c.id}
                                c={c}
                                active={c.id === activeId}
                                onClick={() => setActive(c.id)}
                            />
                        ))}
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}
