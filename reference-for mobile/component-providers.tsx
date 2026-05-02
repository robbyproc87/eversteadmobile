"use client";

import { QueryClient, QueryClientProvider, type QueryFunctionContext } from "@tanstack/react-query";
import { useState } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthDebugBanner } from "@/components/auth-debug-banner";
import { apiGet } from "@/lib/api/client";

const cacheKeyToApiPath: Record<string, string> = {
  "stats:dashboard": "/api/dashboard/stats",
  "plan:today": "/api/plan/today",
  "activity:recent": "/api/activity/recent",
  "streaks": "/api/streaks-adherence",
};

function buildUrlFromQueryKey(queryKey: readonly unknown[]): string {
  const keyStr = queryKey.filter(k => typeof k === "string").join(":");
  
  if (cacheKeyToApiPath[keyStr]) {
    return cacheKeyToApiPath[keyStr];
  }
  
  const [path, params] = queryKey;
  
  if (typeof path !== "string") {
    throw new Error("Query key first element must be a string URL path");
  }
  
  if (!params || typeof params !== "object") {
    return path;
  }
  
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  }
  
  const queryString = searchParams.toString();
  return queryString ? `${path}?${queryString}` : path;
}

async function defaultQueryFn({ queryKey }: QueryFunctionContext): Promise<unknown> {
  const url = buildUrlFromQueryKey(queryKey);
  return apiGet(url);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            queryFn: defaultQueryFn,
            staleTime: 30_000,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <TooltipProvider>
          <AuthDebugBanner />
          {children}
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
