"use client";

import { cn } from "@/lib/utils";
import { CoachOrb } from "./CoachOrb";
import { CoachActionBadge } from "./CoachActionBadge";
import { getCoach } from "@/lib/coach/coach-definitions";
import type { CoachAction } from "@/lib/coach/coach-types";

interface CoachMessageBubbleProps {
  role: string;
  content: string;
  createdAt?: string;
  isStreaming?: boolean;
  coachId?: string;
  actions?: CoachAction[] | null;
}

function renderMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={i} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}

export function CoachMessageBubble({
  role,
  content,
  createdAt,
  isStreaming,
  coachId = "sage",
  actions,
}: CoachMessageBubbleProps) {
  const isUser = role === "user";
  const coach = getCoach(coachId);

  const paragraphs = content.split("\n\n").filter(Boolean);

  return (
    <div
      className={cn(
        "flex gap-3 px-4 group",
        isUser ? "justify-end" : "items-start"
      )}
      data-testid={`coach-message-${role}`}
    >
      {!isUser && <CoachOrb coachId={coachId} size={24} />}
      <div className="max-w-[80%] space-y-2">
        <div
          className={cn(
            "rounded-2xl px-4 py-3 relative",
            isUser
              ? "bg-primary/85 text-primary-foreground rounded-tr-sm"
              : "bg-muted/80 dark:bg-[hsl(30_10%_14%)] rounded-tl-sm"
          )}
          style={!isUser ? { borderLeft: `2px solid ${coach.color}50` } : undefined}
        >
          <div className="space-y-2">
            {paragraphs.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed">
                {renderMarkdown(p)}
              </p>
            ))}
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-current animate-pulse ml-0.5" />
            )}
          </div>
          {createdAt && (
            <span
              className={cn(
                "absolute -bottom-5 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity",
                isUser ? "right-0" : "left-0"
              )}
            >
              {new Date(createdAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
        {actions && actions.length > 0 && (
          <div className="space-y-1 pl-1" data-testid="coach-action-badges">
            {actions.map((action, i) => (
              <CoachActionBadge key={i} action={action} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
