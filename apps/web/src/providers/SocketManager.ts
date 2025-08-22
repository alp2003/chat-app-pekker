// providers/SocketManager.ts
import { io, Socket } from 'socket.io-client';

// Import refresh function from api module
async function refreshToken(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    return response.ok;
  } catch (error) {
    console.error('❌ Token refresh failed:', error);
    return false;
  }
}

export class SocketManager {
  private socket: Socket | null = null;
  private authToken: string = '';
  private cookieName: string = '';
  private onAuthExpired?: () => Promise<void> | void;
  private connected: boolean = false;
  private onStatusChange: (connected: boolean) => void = () => {};
  private cookieCheckInterval: NodeJS.Timeout | null = null;
  private isRefreshingToken: boolean = false;
  private refreshRetryCount: number = 0;
  private maxRefreshRetries: number = 3;

  // Dev HMR singleton
  private static _singleton: Socket | null = null;

  constructor() {
    this.handleConnect = this.handleConnect.bind(this);
    this.handleDisconnect = this.handleDisconnect.bind(this);
    this.handleConnectError = this.handleConnectError.bind(this);
  }

  initialize(config: {
    token?: string;
    cookieName?: string;
    onAuthExpired?: () => Promise<void> | void;
    onStatusChange: (connected: boolean) => void;
  }): Socket {
    this.cookieName = config.cookieName || 'access';
    this.onAuthExpired = config.onAuthExpired;
    this.onStatusChange = config.onStatusChange;

    // Get initial token
    const initialToken =
      typeof window !== 'undefined'
        ? config.token || this.getCookie(this.cookieName)
        : config.token || '';

    this.authToken = initialToken;

    console.log('🔌 SocketManager init:', {
      cookieName: this.cookieName,
      hasToken: !!initialToken,
      tokenPreview: initialToken?.slice(-10),
    });

    this.createSocket();
    this.startCookiePolling();

    return this.socket!;
  }

  private createSocket(): void {
    const url =
      (process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001') + '/chat';

    // Dev HMR: reuse singleton
    if (process.env.NODE_ENV !== 'production' && SocketManager._singleton) {
      console.log('🔄 Reusing existing socket singleton, updating auth token');
      SocketManager._singleton.auth = { token: this.authToken };
      this.socket = SocketManager._singleton;
      this.attachEventListeners();
      return;
    }

    console.log('🆕 Creating new socket instance with URL:', url);
    this.socket = io(url, {
      autoConnect: false,
      transports: ['websocket'],
      withCredentials: true,
      auth: { token: this.authToken },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 600,
      reconnectionDelayMax: 4000,
    });

    // Dev logs
    if (process.env.NODE_ENV !== 'production') {
      this.socket.onAny((ev, ...args) =>
        console.log('[socket:any]', ev, ...args)
      );
      this.socket.on('connect_error', err =>
        console.warn('[socket] connect_error', err?.message || err)
      );
      this.socket.on('disconnect', reason =>
        console.log('[socket] disconnected:', reason)
      );
      this.socket.on('connect', () =>
        console.log('[socket] connected:', this.socket?.id)
      );
      this.socket.on('reconnect', n => console.log('[socket] reconnected', n));
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('💾 Storing socket as singleton');
      SocketManager._singleton = this.socket;
    }

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', this.handleConnect);
    this.socket.on('disconnect', this.handleDisconnect);
    this.socket.on('connect_error', this.handleConnectError);

    // Only connect if we have a valid token
    if (!this.socket.connected && this.authToken) {
      console.log(
        '🔌 Connecting socket with token:',
        this.authToken?.slice(-10)
      );
      this.socket.connect();
    } else if (!this.authToken) {
      console.log(
        '🔌 No token available yet, waiting for token before connecting...'
      );
    }
  }

  private handleConnect(): void {
    this.connected = true;
    this.onStatusChange(true);
  }

  private handleDisconnect(): void {
    this.connected = false;
    this.onStatusChange(false);
  }

  private async handleConnectError(
    err: Error & { data?: string; message?: string }
  ): Promise<void> {
    console.log('🔌 Socket connect error:', err?.message, err?.data);
    const msg = (err?.message || '').toLowerCase();

    if (
      msg.includes('unauthorized') ||
      msg.includes('jwt') ||
      err?.data === 'unauthorized'
    ) {
      console.log('🔄 Socket auth expired, attempting refresh...');

      if (this.onAuthExpired) await this.onAuthExpired();

      const fresh = this.getCookie(this.cookieName);
      console.log('🍪 Fresh token after refresh:', {
        hasFresh: !!fresh,
        changed: fresh !== this.authToken,
        tokenPreview: fresh?.slice(-10),
      });

      if (fresh && fresh !== this.authToken) {
        this.updateToken(fresh);
        console.log('🔄 Reconnecting socket with new token...');
        if (!this.socket?.connected) this.socket?.connect();
      }
    }
  }

  updateToken(newToken: string): void {
    if (!this.socket || newToken === this.authToken) return;

    // Don't update to empty token unless we're explicitly clearing
    if (!newToken && this.authToken) {
      console.log('🔄 Ignoring empty token update, refresh may be in progress');
      return;
    }

    console.log('🔄 Token changed, updating socket auth:', {
      hadPrev: !!this.authToken,
      newTokenPreview: newToken?.slice(-10) || '(empty)',
      isEmpty: !newToken,
    });

    const wasFirstToken = !this.authToken && newToken;
    this.authToken = newToken;
    this.socket.auth = { token: newToken };

    // If this is our first token and we're not connected, connect now
    if (wasFirstToken && !this.socket.connected) {
      console.log('🔌 First token received, connecting socket...');
      this.socket.connect();
      return;
    }

    // Only reconnect if we have a valid token and are already connected
    if (this.socket.connected) {
      if (newToken) {
        console.log(
          '🔄 Disconnecting and reconnecting socket with new token...'
        );
        this.socket.disconnect();
        this.socket.connect();
      } else {
        console.log('🔄 Empty token, disconnecting socket...');
        this.socket.disconnect();
      }
    } else if (newToken) {
      console.log('🔄 Socket not connected, connecting with new token...');
      this.socket.connect();
    }
  }

  private startCookiePolling(): void {
    // Check for token immediately on startup
    const initialCookie = this.getCookie(this.cookieName);
    if (initialCookie && !this.authToken) {
      console.log('🍪 Found initial cookie, updating token:', {
        tokenPreview: initialCookie?.slice(-10),
      });
      this.updateToken(initialCookie);
    }

    // If we still don't have a token, check more frequently for the first few seconds
    if (!this.authToken) {
      console.log(
        '🔍 No initial token found, setting up aggressive polling...'
      );
      let attempts = 0;
      const maxAttempts = 10; // Check for 10 seconds
      const fastCheck = setInterval(() => {
        attempts++;
        const cookie = this.getCookie(this.cookieName);
        if (cookie && !this.authToken) {
          console.log('🍪 Token found during fast polling:', {
            tokenPreview: cookie?.slice(-10),
            attempt: attempts,
          });
          this.updateToken(cookie);
          clearInterval(fastCheck);
        } else if (attempts >= maxAttempts) {
          console.log('🔍 Fast polling completed, no token found');
          clearInterval(fastCheck);
        }
      }, 100); // Check every 100ms for the first few seconds
    }

    this.cookieCheckInterval = setInterval(async () => {
      const currentCookie = this.getCookie(this.cookieName);

      // Handle token change
      if (currentCookie && currentCookie !== this.authToken) {
        console.log('🍪 Detected cookie change, updating token:', {
          newTokenPreview: currentCookie?.slice(-10),
        });
        this.refreshRetryCount = 0; // Reset retry count on successful token update
        this.updateToken(currentCookie);
        return;
      }

      // Handle token expiration (cookie is empty but we had a token)
      if (!currentCookie && this.authToken && !this.isRefreshingToken) {
        console.log('🔄 Token expired, attempting refresh...');
        await this.handleTokenExpiration();
      }
    }, 1000);
  }

  private async handleTokenExpiration(): Promise<void> {
    if (this.isRefreshingToken) {
      console.log('🔄 Token refresh already in progress, skipping...');
      return;
    }

    if (this.refreshRetryCount >= this.maxRefreshRetries) {
      console.error('❌ Max refresh retries exceeded, calling onAuthExpired');
      this.refreshRetryCount = 0;
      if (this.onAuthExpired) {
        await this.onAuthExpired();
      }
      return;
    }

    this.isRefreshingToken = true;
    this.refreshRetryCount++;

    try {
      console.log(
        `🔄 Attempting token refresh (attempt ${this.refreshRetryCount}/${this.maxRefreshRetries})`
      );

      const refreshSuccess = await refreshToken();

      if (refreshSuccess) {
        console.log('✅ Token refresh successful, waiting for new cookie...');

        // Wait for the new cookie to appear (with timeout)
        const maxWait = 5000; // 5 seconds
        const checkInterval = 100; // Check every 100ms
        let waited = 0;

        while (waited < maxWait) {
          const newCookie = this.getCookie(this.cookieName);
          if (newCookie && newCookie !== this.authToken) {
            console.log('🍪 New token detected after refresh:', {
              tokenPreview: newCookie?.slice(-10),
            });
            this.refreshRetryCount = 0; // Reset on success
            this.updateToken(newCookie);
            break;
          }

          await new Promise(resolve => setTimeout(resolve, checkInterval));
          waited += checkInterval;
        }

        if (waited >= maxWait) {
          console.warn('⚠️ Timeout waiting for new token after refresh');
        }
      } else {
        console.error(
          `❌ Token refresh failed (attempt ${this.refreshRetryCount}/${this.maxRefreshRetries})`
        );

        if (this.refreshRetryCount >= this.maxRefreshRetries) {
          console.error(
            '❌ All refresh attempts failed, calling onAuthExpired'
          );
          if (this.onAuthExpired) {
            await this.onAuthExpired();
          }
        } else {
          // Wait before next retry (exponential backoff)
          const delay = Math.min(
            1000 * Math.pow(2, this.refreshRetryCount - 1),
            10000
          );
          console.log(`🔄 Retrying refresh in ${delay}ms...`);
          setTimeout(() => this.handleTokenExpiration(), delay);
        }
      }
    } catch (error) {
      console.error('❌ Error during token refresh:', error);

      if (this.refreshRetryCount >= this.maxRefreshRetries) {
        if (this.onAuthExpired) {
          await this.onAuthExpired();
        }
      }
    } finally {
      this.isRefreshingToken = false;
    }
  }

  private getCookie(name: string): string {
    if (typeof document === 'undefined') return '';
    const m = document.cookie.match(
      new RegExp(
        '(^| )' + name.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&') + '=([^;]+)'
      )
    );
    return m ? decodeURIComponent(m[2]!) : '';
  }

  cleanup(): void {
    if (!this.socket) return;

    this.socket.off('connect', this.handleConnect);
    this.socket.off('disconnect', this.handleDisconnect);
    this.socket.off('connect_error', this.handleConnectError);

    if (this.cookieCheckInterval) {
      clearInterval(this.cookieCheckInterval);
      this.cookieCheckInterval = null;
    }

    // Reset refresh state
    this.isRefreshingToken = false;
    this.refreshRetryCount = 0;

    console.log('🧹 Cleaning up socket listeners');
    if (process.env.NODE_ENV === 'production') {
      this.socket.disconnect();
    } else {
      if (this.socket !== SocketManager._singleton) {
        console.log('🧹 Disconnecting non-singleton socket');
        this.socket.disconnect();
      } else {
        this.socket.emit('app:leaving');
      }
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.connected;
  }

  // Public method to manually trigger token refresh (useful for testing)
  async forceTokenRefresh(): Promise<boolean> {
    console.log('🔄 Manually triggering token refresh...');
    await this.handleTokenExpiration();
    return !this.isRefreshingToken && this.refreshRetryCount === 0;
  }
}
