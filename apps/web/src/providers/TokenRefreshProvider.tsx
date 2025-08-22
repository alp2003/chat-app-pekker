import React, { createContext, useContext, useState, ReactNode } from 'react';

interface TokenRefreshContextType {
  isRefreshing: boolean;
  setIsRefreshing: (value: boolean) => void;
  refreshMessage: string;
  setRefreshMessage: (message: string) => void;
}

const TokenRefreshContext = createContext<TokenRefreshContextType | null>(null);

export function TokenRefreshProvider({ children }: { children: ReactNode }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState(
    'Refreshing authentication...'
  );

  return (
    <TokenRefreshContext.Provider
      value={{
        isRefreshing,
        setIsRefreshing,
        refreshMessage,
        setRefreshMessage,
      }}
    >
      {children}
    </TokenRefreshContext.Provider>
  );
}

export function useTokenRefresh() {
  const context = useContext(TokenRefreshContext);
  if (!context) {
    throw new Error(
      'useTokenRefresh must be used within a TokenRefreshProvider'
    );
  }
  return context;
}
