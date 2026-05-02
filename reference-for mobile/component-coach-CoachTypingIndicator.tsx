"use client";

import { CoachOrb } from "./CoachOrb";
import { getCoach } from "@/lib/coach/coach-definitions";

interface CoachTypingIndicatorProps {
  coachId?: string;
}

export function CoachTypingIndicator({ coachId = "sage" }: CoachTypingIndicatorProps) {
  const coach = getCoach(coachId);

  return (
    <div className="flex items-start gap-3 px-4" data-testid="coach-typing-indicator">
      <CoachOrb coachId={coachId} size={24} />
      <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 border-l-2" style={{ borderColor: `${coach.color}50` }}>
        <div className="flex gap-1.5">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
