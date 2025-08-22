'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, Home } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center space-y-6 max-w-md">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Something went wrong!</h1>
          <p className="text-muted-foreground">
            We encountered an error while loading the chat application.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-4 p-4 border rounded-lg text-left">
              <summary className="cursor-pointer text-sm font-medium">
                Error Details (Development)
              </summary>
              <pre className="mt-2 text-xs overflow-x-auto whitespace-pre-wrap">
                {error.message}
              </pre>
            </details>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={reset} variant="default" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
          <Button 
            onClick={() => window.location.href = '/login'} 
            variant="outline"
            className="flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            Go to Login
          </Button>
        </div>
      </div>
    </div>
  )
}
