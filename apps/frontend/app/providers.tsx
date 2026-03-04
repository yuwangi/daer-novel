'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { type ThemeProviderProps } from 'next-themes';
import { SWRConfig } from 'swr';

export function Providers({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <SWRConfig
        value={{
          revalidateOnFocus: false,      // Don't refetch when switching browser tabs
          revalidateOnReconnect: false,  // Don't refetch on reconnect
          dedupingInterval: 5000,        // Dedup identical requests within 5s (covers StrictMode double-invocation)
        }}
      >
        {children}
      </SWRConfig>
    </NextThemesProvider>
  );
}
