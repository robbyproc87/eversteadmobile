"use client";

import { useEffect, useState } from "react";
import { Loader2, Check, RotateCcw } from "lucide-react";

type AutosaveStatus = "idle" | "saving" | "saved" | "error";

interface AutosaveIndicatorProps {
  status: AutosaveStatus;
  onRetry?: () => void;
}

export function AutosaveIndicator({ status, onRetry }: AutosaveIndicatorProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status === "saving" || status === "error") {
      setVisible(true);
    } else if (status === "saved") {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [status]);

  if (!visible) return null;

  return (
    <div
      className={`flex items-center gap-1.5 text-xs transition-opacity duration-300 ${
        status === "saved" ? "text-muted-foreground" : status === "error" ? "text-destructive" : "text-muted-foreground"
      }`}
      data-testid="autosave-indicator"
    >
      {status === "saving" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Saving...</span>
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="h-3 w-3" />
          <span>Saved</span>
        </>
      )}
      {status === "error" && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 text-destructive hover:text-destructive/80 transition-colors"
          data-testid="button-autosave-retry"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Save failed — tap to retry</span>
        </button>
      )}
    </div>
  );
}
