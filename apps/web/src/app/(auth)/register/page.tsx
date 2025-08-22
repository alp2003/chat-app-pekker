'use client';
import { useState, useTransition } from 'react';
import { registerAction } from './actions';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function RegisterPage() {
  const [username, setU] = useState('');
  const [password, setP] = useState('');
  const [displayName, setD] = useState('');
  const [error, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="grid min-h-[100dvh] place-items-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Username</Label>
            <Input value={username} onChange={e => setU(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Display name</Label>
            <Input value={displayName} onChange={e => setD(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={e => setP(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button
            disabled={pending}
            className="w-full"
            onClick={() =>
              start(async () => {
                try {
                  await registerAction({
                    username,
                    password,
                    displayName,
                  });
                  router.replace('/login'); // redirect to login
                } catch (e: any) {
                  setErr(e.message);
                }
              })
            }
          >
            Create account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
