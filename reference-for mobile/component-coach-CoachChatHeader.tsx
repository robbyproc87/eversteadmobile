"use client";

import { CoachOrb } from "./CoachOrb";
import { getCoach } from "@/lib/coach/coach-definitions";

interface CoachChatHeaderProps {
  coachId: string;
}

export function CoachChatHeader({ coachId }: CoachChatHeaderProps) {
  const coach = getCoach(coachId);

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 border-b"
      data-testid="coach-chat-header"
    >
      <CoachOrb coachId={coachId} size={24} />
      <span
        className="text-sm font-semibold"
        style={{ color: coach.color }}
        data-testid="coach-chat-header-name"
      >
        {coach.name}
      </span>
      <span className="text-xs text-muted-foreground">{coach.shortDescription}</span>
    </div>
  );
}
