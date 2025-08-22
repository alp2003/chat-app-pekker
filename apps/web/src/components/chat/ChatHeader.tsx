'use client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info, Phone, Video } from 'lucide-react';

export default function ChatHeader({
  name,
  online,
  avatar,
  rightSlot, // e.g. <LogoutBtn />
}: {
  name: string;
  online?: boolean;
  avatar?: string | null;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/70 px-3 py-2 backdrop-blur">
      <Avatar className="h-8 w-8">
        {avatar ? (
          <AvatarImage src={avatar} />
        ) : (
          <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
        )}
      </Avatar>
      <div className="mr-auto leading-tight">
        <div className="text-sm font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">
          {online ? 'online' : 'last seen recently'}
          <span
            className={`ml-2 inline-block h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-zinc-400'}`}
          />
        </div>
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon">
              <Phone className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Voice</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon">
              <Video className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Video</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon">
              <Info className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Chat info</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {rightSlot}
    </div>
  );
}
