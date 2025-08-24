'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Plus, MessageCircle, Users, X } from 'lucide-react';
import { startDm, createGroup, searchUsers } from '@/lib/api';

interface User {
  id: string;
  username: string;
  displayName?: string;
}

export default function NewChatButton({
  onConversationCreated,
}: {
  onConversationCreated: (conversationId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dm' | 'group'>('dm');

  // DM tab state
  const [dmUsername, setDmUsername] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Group tab state
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<User[]>([]);

  const handleSearchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const users = await searchUsers(query);
      setSearchResults(users);
    } catch (error) {
      console.error('Failed to search users:', error);
      alert('Failed to search users');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleStartDm = async (username: string) => {
    setLoading(true);
    try {
      const result = await startDm(username);
      alert(`Started chat with ${username}`);
      onConversationCreated(result.id);
      setOpen(false);
      setDmUsername('');
      setSearchResults([]);
    } catch (error) {
      console.error('Failed to start DM:', error);
      alert('Failed to start conversation');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedMembers.length === 0) {
      alert('Please enter a group name and select at least one member');
      return;
    }

    setLoading(true);
    try {
      const memberIds = selectedMembers.map(m => m.id);
      const result = await createGroup(groupName, memberIds);
      alert(`Created group "${groupName}"`);
      onConversationCreated(result.id);
      setOpen(false);
      setGroupName('');
      setSelectedMembers([]);
      setSearchResults([]);
    } catch (error) {
      console.error('Failed to create group:', error);
      alert('Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const toggleMemberSelection = (user: User) => {
    setSelectedMembers(prev =>
      prev.find(m => m.id === user.id)
        ? prev.filter(m => m.id !== user.id)
        : [...prev, user]
    );
  };

  const resetState = () => {
    setDmUsername('');
    setGroupName('');
    setSelectedMembers([]);
    setSearchResults([]);
    setActiveTab('dm');
  };

  return (
    <Sheet
      open={open}
      onOpenChange={newOpen => {
        setOpen(newOpen);
        if (!newOpen) resetState();
      }}
    >
      <SheetTrigger asChild>
        <Button className="w-full" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Start a New Chat</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Tab Selector */}
          <div className="flex space-x-1 rounded-lg bg-muted p-1">
            <button
              onClick={() => setActiveTab('dm')}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'dm'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <MessageCircle className="mr-2 inline h-4 w-4" />
              Direct Message
            </button>
            <button
              onClick={() => setActiveTab('group')}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'group'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="mr-2 inline h-4 w-4" />
              Group Chat
            </button>
          </div>

          {/* DM Tab */}
          {activeTab === 'dm' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="Enter username to chat with..."
                  value={dmUsername}
                  onChange={e => {
                    setDmUsername(e.target.value);
                    handleSearchUsers(e.target.value);
                  }}
                  suppressHydrationWarning
                />
              </div>

              {searchLoading && (
                <div className="text-sm text-muted-foreground">
                  Searching...
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {searchResults.map(user => (
                    <button
                      key={user.id}
                      onClick={() => handleStartDm(user.username)}
                      disabled={loading}
                      className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className="font-medium">
                        {user.displayName || user.username}
                      </div>
                      {user.displayName && (
                        <div className="text-sm text-muted-foreground">
                          @{user.username}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Group Tab */}
          {activeTab === 'group' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="groupName">Group Name</Label>
                <Input
                  id="groupName"
                  placeholder="Enter group name..."
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  suppressHydrationWarning
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="memberSearch">Add Members</Label>
                <Input
                  id="memberSearch"
                  placeholder="Search users to add..."
                  onChange={e => handleSearchUsers(e.target.value)}
                  suppressHydrationWarning
                />
              </div>

              {selectedMembers.length > 0 && (
                <div className="space-y-2">
                  <Label>Selected Members ({selectedMembers.length})</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedMembers.map(member => (
                      <span
                        key={member.id}
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-primary text-primary-foreground"
                      >
                        {member.displayName || member.username}
                        <button
                          onClick={() => toggleMemberSelection(member)}
                          className="ml-2 h-4 w-4 rounded-full bg-primary-foreground/20 hover:bg-primary-foreground/40 flex items-center justify-center"
                        >
                          <X className="h-2 w-2" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {searchResults.map(user => (
                    <button
                      key={user.id}
                      onClick={() => toggleMemberSelection(user)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedMembers.find(m => m.id === user.id)
                          ? 'bg-primary/10 border border-primary'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className="font-medium">
                        {user.displayName || user.username}
                      </div>
                      {user.displayName && (
                        <div className="text-sm text-muted-foreground">
                          @{user.username}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <Separator />

              <Button
                onClick={handleCreateGroup}
                disabled={
                  loading || !groupName.trim() || selectedMembers.length === 0
                }
                className="w-full"
              >
                {loading ? 'Creating...' : 'Create Group'}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
