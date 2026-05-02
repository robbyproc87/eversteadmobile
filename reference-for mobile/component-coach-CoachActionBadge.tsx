"use client";

import { Check, X, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { CoachAction } from "@/lib/coach/coach-types";

interface CoachActionBadgeProps {
  action: CoachAction;
}

export function CoachActionBadge({ action }: CoachActionBadgeProps) {
  const router = useRouter();

  const handleClick = () => {
    if (action.navigateTo) {
      router.push(action.navigateTo);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={!action.navigateTo}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-xs w-full text-left transition-colors",
        action.success
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
          : "bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20",
        action.navigateTo ? "cursor-pointer" : "cursor-default"
      )}
      data-testid={`coach-action-badge-${action.tool}`}
    >
      {action.success ? (
        <Check className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <X className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="flex-1 truncate">{action.message}</span>
      {action.navigateTo && (
        <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
      )}
    </button>
  );
}
