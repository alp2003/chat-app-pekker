'use client'

import * as React from 'react'
import { Check, Palette } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { telegramThemes, applyTheme, type TelegramTheme } from '@/lib/theme'

export function TelegramThemePicker() {
  const { theme, setTheme } = useTheme()
  const [customTheme, setCustomTheme] = React.useState<TelegramTheme>('system')
  const [mounted, setMounted] = React.useState(false)

  // Initialize theme from localStorage on mount
  React.useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem('telegram-theme') as TelegramTheme
    if (savedTheme && telegramThemes[savedTheme]) {
      setCustomTheme(savedTheme)
      // Apply the saved theme
      if (savedTheme !== 'system') {
        setTimeout(() => applyTheme(savedTheme), 100)
      }
    }
  }, [])

  // Apply Telegram theme on selection
  const handleThemeSelect = (themeName: TelegramTheme) => {
    setCustomTheme(themeName)
    
    // Save to localStorage for persistence
    localStorage.setItem('telegram-theme', themeName)
    
    if (themeName === 'system') {
      setTheme('system')
      // Clear any custom colors for system theme
      const root = document.documentElement
      const theme = telegramThemes['day-classic'] // fallback
      Object.keys(theme.colors).forEach(property => {
        root.style.removeProperty(property)
      })
    } else {
      const telegramTheme = telegramThemes[themeName]
      
      // Clear ALL existing custom properties first (including any cached ones)
      const root = document.documentElement
      Object.values(telegramThemes).forEach(theme => {
        if (theme.colors) {
          Object.keys(theme.colors).forEach(property => {
            root.style.removeProperty(property)
          })
        }
      })
      
      // Set the base theme (light/dark) first and wait for it to apply
      if (telegramTheme.type === 'light') {
        setTheme('light')
      } else {
        setTheme('dark')
      }
      
      // Force apply the theme with a longer delay and force refresh
      setTimeout(() => {
        applyTheme(themeName)
        // Force a repaint
        document.body.style.display = 'none'
        document.body.offsetHeight // Trigger reflow
        document.body.style.display = ''
      }, 100)
    }
  }

  // Don't render until mounted to avoid hydration issues
  if (!mounted) {
    return (
      <Button variant="outline" size="icon" disabled>
        <Palette className="h-[1.2rem] w-[1.2rem]" />
      </Button>
    )
  }

  const getPreviewClasses = (themeName: TelegramTheme) => {
    const themeData = telegramThemes[themeName]
    if (themeName === 'night-accent') {
      return 'bg-slate-900 border-slate-700' // Very dark background like in your image
    } else if (themeData.type === 'light') {
      return 'bg-slate-50 border-slate-200'
    } else if (themeData.type === 'dark') {
      return 'bg-slate-800 border-slate-600'
    } else {
      return 'bg-gradient-to-br from-slate-50 to-slate-800 border-slate-400'
    }
  }

  const getMessagePreviewClasses = (themeName: TelegramTheme, isMine: boolean) => {
    const themeData = telegramThemes[themeName]
    
    if (themeName === 'night-accent') {
      return isMine 
        ? 'bg-blue-600 text-white' // Blue bubbles for sent messages (right side)
        : 'bg-slate-700 text-slate-100' // Dark gray for received messages (left side)
    } else if (themeData.type === 'dark') {
      return isMine 
        ? 'bg-blue-600 text-white' 
        : 'bg-slate-600 text-slate-100'
    } else {
      return isMine 
        ? 'bg-blue-500 text-white' 
        : 'bg-slate-200 text-slate-800'
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Palette className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Choose theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-2">
        <DropdownMenuLabel className="text-center">Choose Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="grid grid-cols-2 gap-2 p-2">
          {(Object.keys(telegramThemes) as TelegramTheme[]).map((themeName) => {
            const themeData = telegramThemes[themeName]
            const isSelected = customTheme === themeName
            
            return (
              <button
                key={themeName}
                onClick={() => handleThemeSelect(themeName)}
                className={`relative p-2 rounded-lg border transition-all hover:scale-105 ${
                  isSelected 
                    ? 'border-primary ring-1 ring-primary/20' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {/* Theme Preview */}
                <div className={`w-full h-16 rounded-md border mb-2 p-1.5 ${getPreviewClasses(themeName)}`}>
                  {/* Mock chat messages */}
                  <div className="space-y-1">
                    <div className="flex justify-end">
                      <div className={`px-1.5 py-0.5 rounded text-[10px] max-w-[70%] ${getMessagePreviewClasses(themeName, true)}`}>
                        Good morning! 👋
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className={`px-1.5 py-0.5 rounded text-[10px] max-w-[70%] ${getMessagePreviewClasses(themeName, false)}`}>
                        It's morning in Tokyo 😄
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Theme Name */}
                <div className="text-xs font-medium text-center">{themeData.name}</div>
                
                {/* Selection Indicator */}
                {isSelected && (
                  <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                    <Check className="h-2.5 w-2.5" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
