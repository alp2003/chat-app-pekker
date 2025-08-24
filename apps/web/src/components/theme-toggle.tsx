'use client'

import * as React from 'react'
import { Check, Moon, Palette, Sun, Monitor } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { telegramThemes, applyTheme, type TelegramTheme } from '@/lib/theme'

export function ThemeToggle() {
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
      
      // Clear any existing custom properties first
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
      
      // Then apply custom colors with a small delay to ensure base theme is applied
      setTimeout(() => {
        applyTheme(themeName)
      }, 50)
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

  const getThemeIcon = (themeName: TelegramTheme) => {
    const themeData = telegramThemes[themeName]
    switch (themeData.type) {
      case 'light':
        return <Sun className="h-4 w-4" />
      case 'dark':
        return <Moon className="h-4 w-4" />
      default:
        return <Monitor className="h-4 w-4" />
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Palette className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Choose Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(Object.keys(telegramThemes) as TelegramTheme[]).map((themeName) => {
          const themeData = telegramThemes[themeName]
          const isSelected = customTheme === themeName
          
          return (
            <DropdownMenuItem 
              key={themeName}
              onClick={() => handleThemeSelect(themeName)}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                {getThemeIcon(themeName)}
                <span>{themeData.name}</span>
              </div>
              {isSelected && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
