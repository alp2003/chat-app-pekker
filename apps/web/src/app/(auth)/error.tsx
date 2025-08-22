'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RefreshCw, LogIn } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="grid min-h-[100dvh] place-items-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center">Authentication Error</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Something went wrong with authentication.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <details className="text-left">
              <summary className="cursor-pointer text-xs">Error Details</summary>
              <pre className="mt-2 text-xs overflow-x-auto whitespace-pre-wrap border p-2 rounded">
                {error.message}
              </pre>
            </details>
          )}
          <div className="flex flex-col gap-2">
            <Button onClick={reset} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
            <Button 
              onClick={() => window.location.href = '/login'} 
              variant="outline"
              className="flex items-center gap-2"
            >
              <LogIn className="h-4 w-4" />
              Go to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
