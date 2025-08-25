'use client';

import { useState, useRef, useEffect } from 'react';
import { User, LogOut, Palette, Settings, ChevronUp } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useLogout } from '@/hooks/useLogout';
import { telegramThemes, applyTheme, type TelegramTheme } from '@/lib/theme';

interface SidebarFooterProps {
  currentUser?: {
    username: string;
    displayName?: string;
  };
}

export function SidebarFooter({ currentUser }: SidebarFooterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { logout, isLoggingOut } = useLogout();
  const { theme, setTheme } = useTheme();
  const [customTheme, setCustomTheme] = useState<TelegramTheme>('system');
  const [mounted, setMounted] = useState(false);

  // Debug logging
  console.log('🦶 SidebarFooter rendering with currentUser:', currentUser);

  // Initialize theme from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('telegram-theme') as TelegramTheme;
    if (savedTheme && telegramThemes[savedTheme]) {
      setCustomTheme(savedTheme);
      if (savedTheme !== 'system') {
        setTimeout(() => applyTheme(savedTheme), 100);
      }
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowThemeMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setShowThemeMenu(false);
      }
    }

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, []);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
  };

  const handleThemeSelect = (themeName: TelegramTheme) => {
    setCustomTheme(themeName);
    setShowThemeMenu(false);
    
    localStorage.setItem('telegram-theme', themeName);
    
    if (themeName === 'system') {
      setTheme('system');
      const root = document.documentElement;
      const theme = telegramThemes['day-classic'];
      Object.keys(theme.colors).forEach(property => {
        root.style.removeProperty(property);
      });
    } else {
      applyTheme(themeName);
    }
  };

  const handleProfileSettings = () => {
    setIsOpen(false);
    console.log('Profile settings clicked from sidebar');
  };

  // Generate avatar from username initials
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!currentUser) {
    return null;
  }

  const displayName = currentUser.displayName || currentUser.username;
  const initials = getInitials(displayName);

  return (
    <div className="relative bg-background" ref={dropdownRef}>
      {/* Dropdown Menu - positioned above the footer */}
      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover rounded-t-lg shadow-xl border border-border z-[9999] min-h-[44px] max-h-[400px] overflow-hidden">
          {/* Profile Settings */}
          <div className="p-2">
            <button
              onClick={handleProfileSettings}
              className="flex items-center gap-3 w-full px-3 py-2 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors duration-150 rounded-md"
            >
              <Settings className="w-4 h-4" />
              Profile Settings
            </button>

            {/* Theme Toggle */}
            <div className="relative">
              <button
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                className="flex items-center justify-between w-full px-3 py-2 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors duration-150 rounded-md"
              >
                <div className="flex items-center gap-3">
                  <Palette className="w-4 h-4" />
                  Themes
                </div>
                <ChevronUp 
                  className={`w-4 h-4 transition-transform duration-200 ${
                    showThemeMenu ? 'transform rotate-180' : ''
                  }`} 
                />
              </button>

              {/* Theme Submenu */}
              {showThemeMenu && (
                <div className="ml-6 mt-1 space-y-1 max-h-48 overflow-y-auto">
                  {Object.entries(telegramThemes).map(([key, themeData]) => (
                    <button
                      key={key}
                      onClick={() => handleThemeSelect(key as TelegramTheme)}
                      className={`flex items-center justify-between w-full px-3 py-1.5 text-xs transition-colors duration-150 rounded-md ${
                        customTheme === key
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full border"
                          style={{ 
                            backgroundColor: key !== 'system' ? 
                              (themeData.colors as any)['--background'] || 'hsl(var(--muted))' : 
                              undefined,
                            borderColor: 'hsl(var(--border))'
                          }}
                        />
                        {themeData.name}
                      </span>
                      {customTheme === key && (
                        <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="h-px bg-border my-2" />

            {/* Logout */}
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center gap-3 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
            >
              <LogOut className={`w-4 h-4 ${isLoggingOut ? 'animate-spin' : ''}`} />
              {isLoggingOut ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </div>
      )}

      {/* Footer Button - same height as message input */}
      <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-2 py-2">
        <button
          onClick={() => {
            console.log('🔘 Profile button clicked, isOpen:', isOpen);
            setIsOpen(!isOpen);
          }}
          className="flex items-center gap-3 w-full px-4 py-1 min-h-[42px] bg-card hover:bg-accent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset border-l-0 border-l-primary/20 rounded-2xl"
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent via-primary to-accent/80 flex items-center justify-center text-accent-foreground text-sm font-semibold shadow-sm flex-shrink-0">
            {initials}
          </div>
          
          {/* User info */}
          <div className="flex-1 min-w-0 text-left">
            <div className="text-sm font-medium text-foreground truncate">
              {displayName}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              @{currentUser.username}
            </div>
          </div>
          
          {/* Chevron */}
          <ChevronUp 
            className={`w-4 h-4 text-muted-foreground transition-transform duration-200 flex-shrink-0 ${
              isOpen ? 'transform rotate-180' : ''
            }`} 
          />
        </button>
      </div>
    </div>
  );
}
