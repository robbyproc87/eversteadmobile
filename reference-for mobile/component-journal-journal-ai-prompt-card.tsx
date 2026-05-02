"use client";

import { Sparkles, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface JournalAIPromptCardProps {
  prompt: string | null;
  isLoading: boolean;
  onDismiss: () => void;
}

export function JournalAIPromptCard({ prompt, isLoading, onDismiss }: JournalAIPromptCardProps) {
  if (!isLoading && !prompt) return null;

  return (
    <div className="mx-[60px] mr-6 mt-2">
      {isLoading ? (
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-amber-500/10 border border-amber-500/20"
          data-testid="journal-prompt-loading"
        >
          <Loader2 className="h-4 w-4 text-amber-500 shrink-0 animate-spin" />
          <p className="text-sm text-amber-700 dark:text-amber-400">Crafting a personalized prompt...</p>
        </div>
      ) : (
        <div
          className="flex items-start gap-2 px-3 py-2.5 rounded-md bg-amber-500/10 border border-amber-500/20"
          data-testid="journal-prompt-banner"
        >
          <Sparkles className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="flex-1 text-sm italic text-amber-800 dark:text-amber-300">{prompt}</p>
          <Button
            size="icon"
            variant="ghost"
            onClick={onDismiss}
            className="shrink-0 text-amber-600 dark:text-amber-400 hover:text-amber-700"
            data-testid="button-dismiss-prompt"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
