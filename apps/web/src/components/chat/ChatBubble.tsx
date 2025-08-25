'use client';
import { useMemo, useState } from 'react';
import { Message } from '@/lib/types/chat';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, CheckCheck, RefreshCw } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Reply, Copy, SmilePlus, Trash2 } from 'lucide-react';
import { cn, themeUtils } from '@/lib/theme';

type BubbleProps = {
  m: Message;
  mine: boolean;
  me?: string; // Add current user ID for reaction checking
  avatar?: string | null;
  name?: string;
  isGroup?: boolean; // Add flag to indicate if this is a group chat
  // optional callbacks
  onReply?: (m: Message) => void;
  onReact?: (m: Message, emoji: string) => void;
  onDelete?: (m: Message) => void;
  onRetry?: (m: Message) => void;
};

export default function ChatBubble({
  m,
  mine,
  me,
  avatar,
  name,
  isGroup,
  onReply,
  onReact,
  onDelete,
  onRetry,
}: BubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);

  const t = useMemo(
    () =>
      new Date(m.createdAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    [m.createdAt]
  );

  // --- helpers ---
  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(m.content ?? '');
    } catch {}
  };

  // naive autolink + code styling; keep it simple
  const renderContent = (text?: string) => {
    if (!text) return null;
    // highlight code blocks ```...```
    const parts = text.split(/```([\s\S]*?)```/g);
    return (
      <div className="space-y-2">
        {parts.map((chunk, i) =>
          i % 2 === 1 ? (
            <pre
              key={i}
              className="whitespace-pre-wrap break-words rounded-lg bg-black/10 px-2 py-1 text-[12px] dark:bg-white/10"
            >
              <code>{chunk}</code>
            </pre>
          ) : (
            <p key={i} className="whitespace-pre-wrap break-words text-sm">
              {chunk.split(/(\s+)/).map((w, j) =>
                urlRe.test(w) ? (
                  <a
                    key={j}
                    href={w}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    {w}
                  </a>
                ) : (
                  <span key={j}>{w}</span>
                )
              )}
            </p>
          )
        )}
      </div>
    );
  };

  return (
    <div
      className={`mb-1 flex gap-2 ${mine ? 'justify-end' : 'justify-start'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowReactions(false);
      }}
    >
      {!mine && (
        <Avatar className="mt-5 h-7 w-7 shrink-0">
          {avatar ? (
            <AvatarImage src={avatar} />
          ) : (
            <AvatarFallback>
              {(name ?? 'U').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          )}
        </Avatar>
      )}

      <div className="group relative max-w-[75%] overflow-visible">
        {/* Username for group chats (non-mine messages only) */}
        {isGroup && !mine && name && (
          <div className="mb-1 ml-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
            {name}
          </div>
        )}
        
        {/* Reply preview (if quoting) */}
        {m.replyToId && m.replyTo && (
          <div
            className={`mb-1 rounded-lg border px-2 py-1 text-xs ${
              mine ? 'border-white/30' : 'border-black/10 dark:border-white/10'
            }`}
          >
            <div className="line-clamp-2 opacity-70">
              {m.replyTo.content || 'Attachment'}
            </div>
          </div>
        )}

        {/* Bubble */}
        <div
          className={cn(
            'rounded-2xl px-3 py-2 shadow-sm',
            themeUtils.radius.lg,
            mine
              ? cn(themeUtils.chat.myMessage, 'rounded-br-md')
              : cn(themeUtils.chat.theirMessage, 'rounded-bl-md')
          )}
        >
          {/* Attachment preview */}
          {m.fileUrl && (
            <img
              src={m.fileUrl}
              alt="image"
              className="mb-2 max-h-72 w-full rounded-lg object-cover"
            />
          )}

          {/* Text */}
          {renderContent(m.content)}

          {/* Footer row: time • ticks • states */}
          <div
            className={`mt-1 flex items-center gap-1 text-[10px] opacity-70 ${
              mine ? 'justify-end' : 'justify-start'
            }`}
          >
            <span>{t}</span>
            {mine &&
              (m.read ? (
                <CheckCheck className="h-3 w-3" />
              ) : (
                <Check className="h-3 w-3" />
              ))}
            {m.pending && <span className="italic">sending…</span>}
            {m.error && (
              <span className="ml-1 text-red-500">
                failed
                {onRetry && (
                  <button
                    onClick={() => onRetry?.(m)}
                    className="ml-1 inline-flex items-center gap-1 underline"
                    title="Retry"
                  >
                    <RefreshCw className="h-3 w-3" /> retry
                  </button>
                )}
              </span>
            )}
            {m.edited && <span className="ml-1 italic">edited</span>}
          </div>
        </div>

        {/* Hover actions */}
        <TooltipProvider>
          {/* Action bar: shows on hover (desktop), is stable for clicks */}
          <div
            className={`pointer-events-none absolute -top-3 ${
              mine ? 'right-2' : 'left-2'
            } z-20 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100`}
          >
            {/* Reply */}

            <button
              className={cn(
                'pointer-events-auto px-2 py-1 text-xs shadow',
                themeUtils.radius.md,
                'bg-background/90 hover:bg-accent transition-colors'
              )}
              onClick={() => onReply?.(m)}
            >
              <span className="inline-flex items-center gap-1">
                <Reply className="h-3 w-3" /> Reply
              </span>
            </button>

            {/* Copy */}
          
                <button
                  className={cn(
                    'pointer-events-auto px-2 py-1 text-xs shadow',
                    themeUtils.radius.md,
                    'bg-background/90 hover:bg-accent transition-colors'
                  )}
                  onClick={copyText}
                >
                  
                  <span className="inline-flex items-center gap-1">
                    <Copy className="h-3 w-3" /> Copy
                  </span>
                </button>
           

            {/* React (stable popover) */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    'pointer-events-auto px-2 py-1 text-xs shadow',
                    themeUtils.radius.md,
                    'bg-background/90 hover:bg-accent transition-colors'
                  )}
                  title="React"
                >
                  <span className="inline-flex items-center gap-1">
                    <SmilePlus className="h-3 w-3" /> React
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                side={mine ? 'bottom' : 'bottom'}
                align={mine ? 'end' : 'start'}
                className="z-30 w-auto max-w-max whitespace-nowrap border p-1 shadow rounded-xl"
              >
                {['👍', '❤️', '😂', '😮', '🙏'].map(e => (
                  <button
                    key={e}
                    onClick={() => onReact?.(m, e)}
                    className={cn(
                      'px-2 py-1 text-base transition-colors',
                      themeUtils.radius.lg,
                      'hover:bg-muted'
                    )}
                  >
                    {e}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Delete (owner only) */}
            {mine && onDelete && !m.pending && !m.error && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      'pointer-events-auto px-2 py-1 text-xs shadow',
                      themeUtils.radius.md,
                      'bg-background/90 hover:bg-destructive hover:text-destructive-foreground transition-colors'
                    )}
                    onClick={() => onDelete?.(m)}
                  >
                    <span className="inline-flex items-center gap-1">
                      <Trash2 className="h-3 w-3" /> Delete
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>

        {/* Reactions picker (tiny & simple) */}

        {/* Render existing reactions (if any) */}
        {!!m.reactions?.length && (
          <div
            className={`mt-1 flex flex-wrap items-center gap-1 text-xs ${
              mine ? 'justify-end' : 'justify-start'
            }`}
          >
            {m.reactions.map((r, i) => {
              // Check if current user has reacted with this emoji
              const userReacted = me ? r.by?.includes(me) || false : false;

              return (
                <button
                  key={i}
                  onClick={() => onReact?.(m, r.emoji)}
                  className={cn(
                    'border px-2 py-[2px] transition-colors',
                    themeUtils.radius.full,
                    'hover:bg-muted/50',
                    userReacted
                      ? 'bg-primary/20 border-primary/50 text-primary'
                      : 'bg-background/60 hover:bg-background/80'
                  )}
                  title={r.by?.join(', ')}
                >
                  {r.emoji} {r.count ?? 1}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const urlRe = /^(https?:\/\/[\w.-]+\.[a-z]{2,}(?:[^\s]*)$)/i;
