'use client';
import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Paperclip, Image as ImgIcon, Send } from 'lucide-react';
import { useKeyboardInsets } from '@/hooks/useKeyboardInsets';
import clsx from 'clsx';

type Props = {
  value: string;
  setValue: (v: string) => void;
  onSend: () => void;
  onPick: (f: File) => void;
  /** Optional: auto-focus textarea when mounting */
  autoFocus?: boolean;
};

export default function ChatComposer({
  value,
  setValue,
  onSend,
  onPick,
  autoFocus,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [taHeight, setTaHeight] = useState<number>(44);
  const disabled = !value.trim();

  const keyboardInset = useKeyboardInsets();

  // Simple mobile detection
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  // Enhanced send handler that maintains focus on mobile (the aggressive approach that worked)
  const handleSend = () => {
    if (!value.trim()) return;
    
    if (isMobile && taRef.current) {
      // Store reference to textarea before sending
      const textarea = taRef.current;
      const isCurrentlyFocused = document.activeElement === textarea;
      
      // Call send function
      onSend();
      
      // Aggressively maintain focus using multiple strategies (this was working!)
      if (isCurrentlyFocused) {
        // Strategy 1: Immediate focus (synchronous)
        textarea.focus();
        
        // Strategy 2: Force focus after React update
        Promise.resolve().then(() => {
          if (textarea && document.activeElement !== textarea) {
            textarea.focus();
          }
        });
        
        // Strategy 3: Delayed refocus for iOS
        setTimeout(() => {
          if (textarea && document.activeElement !== textarea) {
            textarea.focus();
            // Set cursor to end
            const len = textarea.value.length;
            textarea.setSelectionRange(len, len);
          }
        }, 1);
        
        // Strategy 4: Final attempt
        setTimeout(() => {
          if (textarea && document.activeElement !== textarea) {
            textarea.focus();
          }
        }, 100);
      }
    } else {
      // Desktop behavior - normal send
      onSend();
    }
  };

  // Autosize the textarea up to 9 lines
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = '0px';
    const next = Math.min(ta.scrollHeight, 320);
    ta.style.height = next + 'px';
    setTaHeight(next + 24);
  }, [value]);

  useEffect(() => {
    if (autoFocus && taRef.current) taRef.current.focus();
  }, [autoFocus]);

  // Expose CSS variable for composer height
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--composer-h',
      `${taHeight + 24}px`
    );
  }, [taHeight]);

  return (
    <>
      {/* Spacer ensures last messages aren’t hidden behind the fixed composer */}
      <div
        aria-hidden
        className="md:hidden"
        style={{
          height: `calc(${Math.max(taHeight + 24, 64)}px + env(safe-area-inset-bottom) + ${keyboardInset}px)`,
        }}
      />
      <div
        className={clsx(
          // Mobile: fixed to bottom; Desktop: sticky in the thread pane
          'md:sticky md:bottom-0 md:translate-y-0',
          'fixed inset-x-0 bottom-0 z-40',
          'border-t bg-background/80 backdrop-blur supports-[backdrop-filter]:backdrop-blur'
        )}
        style={{
          paddingBottom: `calc(env(safe-area-inset-bottom) + ${keyboardInset}px)`,
        }}
      >
        <div className="mx-auto w-full px-3 py-2">
          <div className="flex items-end gap-1 rounded-2xl border bg-card/50">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) onPick(f);
                if (fileRef.current) fileRef.current.value = '';
              }}
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Attach">
                  <Paperclip className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  className="gap-2"
                  onClick={() => fileRef.current?.click()}
                >
                  <ImgIcon className="h-4 w-4" /> Image
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Textarea
              ref={taRef}
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="Message"
              className="min-h-0.5 w-full resize-none rounded-2xl px-2 py-2 text-base md:text-sm scrollbar-none"
              rows={1}
              inputMode="text"
              autoCapitalize="sentences"
              autoCorrect="on"
              spellCheck={true}
              dir="auto"
              style={{ 
                unicodeBidi: 'isolate',
                textAlign: 'start',
                fontSize: '16px'
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (isMobile) {
                    // Mobile: Return always creates new line
                    return;
                  } else {
                    // Desktop: Enter sends, Shift+Enter creates new line
                    if (e.shiftKey) {
                      return;
                    } else {
                      e.preventDefault();
                      if (value.trim()) onSend();
                    }
                  }
                }
              }}
              onFocus={() => {
                setTimeout(
                  () => taRef.current?.scrollIntoView({ block: 'nearest' }),
                  0
                );
              }}
            />

            <Button
              disabled={disabled}
              className="rounded-full w-12 h-10"
              aria-label={disabled ? 'Send (disabled)' : 'Send'}
              onMouseDown={(e) => {
                // Prevent button from stealing focus on mobile
                if (isMobile) {
                  e.preventDefault();
                }
              }}
              onClick={handleSend}
            >
              <Send
                className="rotate-45"
                style={{ width: '100%', height: '100%' }}
              />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
