import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Telegram-inspired theme system
export const telegramThemes = {
  'day-classic': {
    name: 'Day Classic',
    type: 'light',
    colors: {
      '--background': 'oklch(0.98 0.002 240)',
      '--foreground': 'oklch(0.15 0.002 240)',
      '--card': 'oklch(1 0 0)',
      '--card-foreground': 'oklch(0.15 0.002 240)',
      '--popover': 'oklch(1 0 0)',
      '--popover-foreground': 'oklch(0.15 0.002 240)',
      '--primary': 'oklch(0.6 0.25 250)',
      '--primary-foreground': 'oklch(0.98 0.002 240)',
      '--secondary': 'oklch(0.95 0.01 240)',
      '--secondary-foreground': 'oklch(0.15 0.002 240)',
      '--muted': 'oklch(0.95 0.01 240)',
      '--muted-foreground': 'oklch(0.5 0.02 240)',
      '--accent': 'oklch(0.92 0.02 240)',
      '--accent-foreground': 'oklch(0.15 0.002 240)',
      '--destructive': 'oklch(0.65 0.2 25)',
      '--border': 'oklch(0.92 0.02 240)',
      '--input': 'oklch(0.92 0.02 240)',
      '--ring': 'oklch(0.6 0.25 250)',
    }
  },
  'day': {
    name: 'Day',
    type: 'light',
    colors: {
      '--background': 'oklch(1 0 0)',
      '--foreground': 'oklch(0.1 0.01 240)',
      '--card': 'oklch(1 0 0)',
      '--card-foreground': 'oklch(0.1 0.01 240)',
      '--popover': 'oklch(1 0 0)',
      '--popover-foreground': 'oklch(0.1 0.01 240)',
      '--primary': 'oklch(0.55 0.22 250)',
      '--primary-foreground': 'oklch(0.98 0.002 240)',
      '--secondary': 'oklch(0.96 0.005 240)',
      '--secondary-foreground': 'oklch(0.2 0.01 240)',
      '--muted': 'oklch(0.96 0.005 240)',
      '--muted-foreground': 'oklch(0.45 0.02 240)',
      '--accent': 'oklch(0.94 0.01 240)',
      '--accent-foreground': 'oklch(0.2 0.01 240)',
      '--destructive': 'oklch(0.6 0.22 25)',
      '--border': 'oklch(0.94 0.01 240)',
      '--input': 'oklch(0.94 0.01 240)',
      '--ring': 'oklch(0.55 0.22 250)',
    }
  },
  'night-accent': {
    name: 'Night Accent',
    type: 'dark' as const,
    colors: {
      // Main backgrounds - custom dark blue from rgb(27, 34, 44)
      '--background': 'rgb(27, 34, 44)', // Your specific background color
      '--foreground': 'oklch(0.98 0.01 220)', // Pure white text
      
      // Card and surface colors - slightly lighter than background
      '--card': 'rgb(32, 40, 52)', // Slightly lighter than background
      '--card-foreground': 'oklch(0.98 0.01 220)',
      '--popover': 'rgb(32, 40, 52)',
      '--popover-foreground': 'oklch(0.98 0.01 220)',
      
      // Primary colors - blue for sent messages (right side)
      '--primary': 'oklch(0.58 0.15 240)', // Blue like your sent messages
      '--primary-foreground': 'oklch(0.98 0.01 240)',
      
      // Secondary colors - dark gray for received messages (left side)
      '--secondary': 'oklch(0.25 0.02 220)', // Dark gray like received messages
      '--secondary-foreground': 'oklch(0.95 0.01 220)',
      
      // Muted colors
      '--muted': 'rgb(38, 48, 63)', // Custom color for received message bubbles (left side)
      '--muted-foreground': 'oklch(0.95 0.01 220)', // White text on received messages
      
      // Accent colors - bright blue selection for active conversation (like in your Telegram image)
      '--accent': 'oklch(0.65 0.15 240)', // Bright blue accent for active conversation selection
      '--accent-foreground': 'oklch(0.98 0.01 240)',
      
      // Destructive
      '--destructive': 'oklch(0.60 0.20 25)', // Red
      '--destructive-foreground': 'oklch(0.98 0.01 25)',
      
      // Borders and inputs
      '--border': 'oklch(0.22 0.02 220)', // Subtle border
      '--input': 'oklch(0.22 0.02 220)', // Input background
      '--ring': 'oklch(0.58 0.15 240)', // Focus ring blue
    }
  },
  'system': {
    name: 'System',
    type: 'system',
    colors: {} // Will inherit from system preference
  }
} as const

export type TelegramTheme = keyof typeof telegramThemes

// Chat-specific utilities that work with all themes
export const themeUtils = {
  // Message bubbles - will adapt to theme
  chat: {
    myMessage: 'bg-primary text-primary-foreground',
    theirMessage: 'bg-muted text-muted-foreground',
    
    // Online/offline status
    online: 'bg-green-500',
    offline: 'bg-muted-foreground',
    
    // Unread count badge
    unreadBadge: 'bg-destructive text-destructive-foreground',
    
    // Sidebar active state
    sidebarActive: 'bg-accent text-accent-foreground',
    sidebarHover: 'hover:bg-accent/50',
  },
  
  // Animation classes
  animations: {
    fadeIn: 'animate-in fade-in-0 duration-200',
    slideIn: 'animate-in slide-in-from-left-2 duration-200',
    scaleIn: 'animate-in zoom-in-95 duration-200',
  },
  
  // Consistent border radius
  radius: {
    sm: 'rounded-sm',
    md: 'rounded-md', 
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    full: 'rounded-full',
  },
  
  // Shadow utilities
  shadows: {
    soft: 'shadow-sm',
    medium: 'shadow-md',
    strong: 'shadow-lg',
  }
}

// Helper to get theme-aware colors
export function getThemeColor(colorKey: keyof typeof themeUtils.chat) {
  return themeUtils.chat[colorKey]
}

// Apply theme colors to CSS variables
export function applyTheme(themeName: TelegramTheme) {
  const theme = telegramThemes[themeName]
  if (!theme.colors || Object.keys(theme.colors).length === 0) return
  
  const root = document.documentElement
  Object.entries(theme.colors).forEach(([property, value]) => {
    // Property is already in CSS custom property format (e.g. '--background')
    root.style.setProperty(property, value)
    // Debug logging
    console.log(`Setting ${property}: ${value}`)
  })
}
