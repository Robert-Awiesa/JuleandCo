"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            /**
             * Refetch when the tab is focused again.
             *
             * This was off, which is what made the dashboard feel wrong: leave
             * the admin open, take an order on the storefront or edit something
             * in a second tab, come back, and the figures were whatever they
             * had been when you left. Nothing was broken — the screen was
             * simply never asked again. Coming back to a tab is exactly the
             * moment to check, so it now does.
             */
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,

            /**
             * Zero, so returning to the tab always re-reads. Data that genuinely
             * changes rarely — categories, attribute vocabularies — sets its own
             * staleTime in useCatalogConfig; everything else here is a live
             * figure and a stale one is worse than a refetch.
             */
            staleTime: 0,

            // A failed admin request should surface, not be retried three times
            // behind a spinner while the user waits without being told why.
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}
