"use client"

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"

import { ApiError } from "@/lib/api"

function signOutOn401(error: unknown) {
  if (error instanceof ApiError && error.status === 401 && typeof window !== "undefined") {
    window.location.replace("/login")
  }
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: signOutOn401 }),
        mutationCache: new MutationCache({ onError: signOutOn401 }),
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: true,
            // Client errors will not fix themselves; retry only network/5xx failures.
            retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
          },
        },
      })
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
