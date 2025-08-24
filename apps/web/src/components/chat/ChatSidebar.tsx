'use client';
import { useState, useMemo } from 'react';
import { Conversation } from '@/lib/types/chat';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Search, Menu, X } from 'lucide-react';
import { SidebarFooter } from './SidebarFooter';

function ConversationItem({
  c,
  active,
  onClick,
  searchQuery = '',
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
      `(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
      'gi'
    );
    const parts = text.split(regex);

    return parts.map((part, i) => {
      const isMatch = regex.test(part);
      return (
        <span
          key={i}
          className={
            isMatch
              ? 'bg-yellow-200 dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-200 px-0.5 rounded-sm font-medium'
              : ''
          }
        >
          {part}
        </span>
      );
    });
  };

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-3 py-3 text-left transition border-b border-border/20
      ${active ? 'bg-accent' : 'hover:bg-accent/50'} last:border-b-0`}
    >
      <Avatar>
        {c.avatar ? (
          <AvatarImage src={c.avatar} />
        ) : (
          <AvatarFallback>{c.name.slice(0, 2).toUpperCase()}</AvatarFallback>
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
          {c.last ? highlightMatch(c.last, searchQuery) : ''}
        </div>
      </div>
    </button>
  );
}

export function DesktopSidebar({
  convos,
  activeId,
  setActive,
  topSlot,
  currentUser,
  forceVisible = false, // New prop to override hidden state for mobile drawer
}: {
  convos: Conversation[];
  activeId?: string;
  setActive: (id: string) => void;
  topSlot?: React.ReactNode; // e.g. new chat button
  currentUser?: { username: string; displayName?: string };
  forceVisible?: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState('');

  // Debug conversations updates
  console.log(
    '🎨 DesktopSidebar rendering with convos:',
    convos.map(c => ({
      id: c.id,
      name: c.name,
      last: c.last,
    }))
  );

  // Additional mobile debugging
  console.log('🔍 DesktopSidebar debug:', {
    convosLength: convos.length,
    activeId,
    topSlot: !!topSlot,
    searchQuery,
  });

  // Filter and group conversations based on search query and unread status
  const { filteredConvos, groupedConvos } = useMemo(() => {
    let filtered = convos;
    
    // Apply search filter if there's a search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = convos.filter(convo => {
        // Search in conversation name
        const nameMatch = convo.name.toLowerCase().includes(query);

        // Search in last message
        const messageMatch = convo.last?.toLowerCase().includes(query) ?? false;

        return nameMatch || messageMatch;
      });
    }

    // Sort by latest message timestamp first
    const sortByTimestamp = (conversations: typeof filtered) => {
      return [...conversations].sort((a, b) => {
        // Conversations without messages go to the bottom
        if (!a.lastMessageAt && !b.lastMessageAt) return 0;
        if (!a.lastMessageAt) return 1;
        if (!b.lastMessageAt) return -1;
        
        // Sort by timestamp descending (newest first)
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      });
    };

    // Group conversations by unread status
    const unreadConvos = sortByTimestamp(filtered.filter(c => c.unread && c.unread > 0));
    const recentConvos = sortByTimestamp(filtered.filter(c => !c.unread || c.unread === 0));

    return {
      filteredConvos: filtered,
      groupedConvos: {
        unread: unreadConvos,
        recent: recentConvos,
      },
    };
  }, [convos, searchQuery]);

  return (
    <div className={`w-[320px] shrink-0 flex-col border-r ${forceVisible ? 'flex' : 'hidden md:flex'}`}>
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search chats"
            className="pl-8 pr-8"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            suppressHydrationWarning
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
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
        <div className="space-y-0">
          {filteredConvos.length > 0 ? (
            searchQuery.trim() ? (
              // When searching, show flat list without separators
              filteredConvos.map(c => (
                <ConversationItem
                  key={c.id}
                  c={c}
                  active={c.id === activeId}
                  onClick={() => setActive(c.id)}
                  searchQuery={searchQuery}
                />
              ))
            ) : (
              // When not searching, show grouped conversations with separators
              <>
                {groupedConvos.unread.length > 0 && (
                  <>
                    <div className="px-2 py-3 bg-muted/20 border-b border-border/10">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Unread ({groupedConvos.unread.length})
                      </h3>
                    </div>
                    <div className="border-b border-border/10">
                      {groupedConvos.unread.map(c => (
                        <ConversationItem
                          key={c.id}
                          c={c}
                          active={c.id === activeId}
                          onClick={() => setActive(c.id)}
                          searchQuery={searchQuery}
                        />
                      ))}
                    </div>
                  </>
                )}

                {groupedConvos.recent.length > 0 && (
                  <>
                    {groupedConvos.unread.length > 0 && (
                      <div className="px-2 py-3 bg-muted/20 border-b border-border/10 mt-2">
                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Recent ({groupedConvos.recent.length})
                        </h3>
                      </div>
                    )}
                    <div className="border-b border-border/10">
                      {groupedConvos.recent.map(c => (
                        <ConversationItem
                          key={c.id}
                          c={c}
                          active={c.id === activeId}
                          onClick={() => setActive(c.id)}
                          searchQuery={searchQuery}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            )
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
      <SidebarFooter currentUser={currentUser} />
    </div>
  );
}

export function MobileSidebar({
  convos,
  activeId,
  setActive,
  currentUser,
}: {
  convos: Conversation[];
  activeId?: string;
  setActive: (id: string) => void;
  currentUser?: { username: string; displayName?: string };
}) {
  const [searchQuery, setSearchQuery] = useState('');

  // Debug conversations updates for mobile
  console.log(
    '📱 MobileSidebar rendering with convos:',
    convos.map(c => ({
      id: c.id,
      name: c.name,
      last: c.last,
    }))
  );

  // Filter and group conversations based on search query and unread status
  const { filteredConvos, groupedConvos } = useMemo(() => {
    let filtered = convos;
    
    // Apply search filter if there's a search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = convos.filter(convo => {
        // Search in conversation name
        const nameMatch = convo.name.toLowerCase().includes(query);

        // Search in last message
        const messageMatch = convo.last?.toLowerCase().includes(query) ?? false;

        return nameMatch || messageMatch;
      });
    }

    // Sort by latest message timestamp first
    const sortByTimestamp = (conversations: typeof filtered) => {
      return [...conversations].sort((a, b) => {
        // Conversations without messages go to the bottom
        if (!a.lastMessageAt && !b.lastMessageAt) return 0;
        if (!a.lastMessageAt) return 1;
        if (!b.lastMessageAt) return -1;
        
        // Sort by timestamp descending (newest first)
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      });
    };

    // Group conversations by unread status
    const unreadConvos = sortByTimestamp(filtered.filter(c => c.unread && c.unread > 0));
    const recentConvos = sortByTimestamp(filtered.filter(c => !c.unread || c.unread === 0));

    return {
      filteredConvos: filtered,
      groupedConvos: {
        unread: unreadConvos,
        recent: recentConvos,
      },
    };
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
              onChange={e => setSearchQuery(e.target.value)}
              suppressHydrationWarning
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <Separator />
        <ScrollArea className="h-[calc(100dvh-80px)] p-2">
          <div className="space-y-0">
            {filteredConvos.length > 0 ? (
              searchQuery.trim() ? (
                // When searching, show flat list without separators
                filteredConvos.map(c => (
                  <ConversationItem
                    key={c.id}
                    c={c}
                    active={c.id === activeId}
                    onClick={() => setActive(c.id)}
                    searchQuery={searchQuery}
                  />
                ))
              ) : (
                // When not searching, show grouped conversations with separators
                <>
                  {groupedConvos.unread.length > 0 && (
                    <>
                      <div className="px-2 py-3 bg-muted/20 border-b border-border/10">
                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Unread ({groupedConvos.unread.length})
                        </h3>
                      </div>
                      <div className="border-b border-border/10">
                        {groupedConvos.unread.map(c => (
                          <ConversationItem
                            key={c.id}
                            c={c}
                            active={c.id === activeId}
                            onClick={() => setActive(c.id)}
                            searchQuery={searchQuery}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {groupedConvos.recent.length > 0 && (
                    <>
                      {groupedConvos.unread.length > 0 && (
                        <div className="px-2 py-3 bg-muted/20 border-b border-border/10 mt-2">
                          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Recent ({groupedConvos.recent.length})
                          </h3>
                        </div>
                      )}
                      <div className="border-b border-border/10">
                        {groupedConvos.recent.map(c => (
                          <ConversationItem
                            key={c.id}
                            c={c}
                            active={c.id === activeId}
                            onClick={() => setActive(c.id)}
                            searchQuery={searchQuery}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              )
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
        <SidebarFooter currentUser={currentUser} />
      </SheetContent>
    </Sheet>
  );
}
