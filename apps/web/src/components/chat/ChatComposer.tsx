"use client";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Paperclip, Image as ImgIcon, Send } from "lucide-react";

export default function ChatComposer({
    value,
    setValue,
    onSend,
    onPick
}: {
    value: string;
    setValue: (v: string) => void;
    onSend: () => void;
    onPick: (f: File) => void;
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const disabled = !value.trim();

    return (
        <div className="w-full border-t bg-background/60 p-3">
            <div className="flex items-end gap-2">
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onPick(f);
                    }}
                />
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
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
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Message"
                    className="min-h-[44px] max-h-36 w-full resize-none rounded-2xl px-4 py-3"
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            onSend();
                        }
                    }}
                />
                <Button
                    disabled={disabled}
                    className="rounded-2xl"
                    onClick={onSend}
                >
                    <Send className="mr-1 h-4 w-4" /> Send
                </Button>
            </div>
        </div>
    );
}
