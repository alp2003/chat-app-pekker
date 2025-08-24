'use client';

import { useState, useRef, useEffect } from 'react';
import { User, LogOut, Palette, Settings, ChevronDown, ChevronRight } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useLogout } from '@/hooks/useLogout';
import { telegramThemes, applyTheme, type TelegramTheme } from '@/lib/theme';

interface ProfileDropdownProps {
  user: {
    username: string;
    displayName?: string;
  };
  onProfileSettings?: () => void;
}

export default function ProfileDropdown({ 
  user, 
  onProfileSettings 
}: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { logout, isLoggingOut } = useLogout();
  const { theme, setTheme } = useTheme();
  const [customTheme, setCustomTheme] = useState<TelegramTheme>('system');
  const [mounted, setMounted] = useState(false);

  // Initialize theme from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('telegram-theme') as TelegramTheme;
    if (savedTheme && telegramThemes[savedTheme]) {
      setCustomTheme(savedTheme);
      // Apply the saved theme
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
    
    // Save to localStorage for persistence
    localStorage.setItem('telegram-theme', themeName);
    
    if (themeName === 'system') {
      setTheme('system');
      // Clear any custom colors for system theme
      const root = document.documentElement;
      const theme = telegramThemes['day-classic']; // fallback
      Object.keys(theme.colors).forEach(property => {
        root.style.removeProperty(property);
      });
    } else {
      applyTheme(themeName);
    }
  };

  const handleProfileSettings = () => {
    setIsOpen(false);
    onProfileSettings?.();
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

  const displayName = user.displayName || user.username;
  const initials = getInitials(displayName);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-2 rounded-full bg-card hover:bg-accent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background border border-border"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent via-primary to-accent/80 flex items-center justify-center text-accent-foreground text-sm font-semibold shadow-sm">
          {initials}
        </div>
        
        {/* Username (hidden on mobile) */}
        <span className="hidden sm:block text-sm font-medium text-foreground">
          {displayName}
        </span>
        
        {/* Chevron */}
        <ChevronDown 
          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
            isOpen ? 'transform rotate-180' : ''
          }`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-popover rounded-lg shadow-lg border border-border z-50">
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent via-primary to-accent/80 flex items-center justify-center text-accent-foreground font-semibold shadow-sm">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-popover-foreground truncate">
                  {displayName}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  @{user.username}
                </p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            {/* Profile Settings */}
            <button
              onClick={handleProfileSettings}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors duration-150"
            >
              <Settings className="w-4 h-4" />
              Profile Settings
            </button>

            {/* Theme Toggle */}
            <div className="relative">
              <button
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                className="flex items-center justify-between w-full px-4 py-2 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors duration-150"
              >
                <div className="flex items-center gap-3">
                  <Palette className="w-4 h-4" />
                  Themes
                </div>
                <ChevronRight 
                  className={`w-4 h-4 transition-transform duration-200 ${
                    showThemeMenu ? 'transform rotate-90' : ''
                  }`} 
                />
              </button>

              {/* Theme Submenu */}
              {showThemeMenu && (
                <div className="ml-6 mt-1 space-y-1">
                  {Object.entries(telegramThemes).map(([key, themeData]) => (
                    <button
                      key={key}
                      onClick={() => handleThemeSelect(key as TelegramTheme)}
                      className={`flex items-center justify-between w-full px-4 py-1.5 text-xs transition-colors duration-150 rounded ${
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
            <div className="h-px bg-border my-1" />

            {/* Logout */}
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogOut className={`w-4 h-4 ${isLoggingOut ? 'animate-spin' : ''}`} />
              {isLoggingOut ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
