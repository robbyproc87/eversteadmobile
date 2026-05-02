"use client";

import { CoachOrb } from "./CoachOrb";
import { CoachTypingIndicator } from "./CoachTypingIndicator";
import { getCoach } from "@/lib/coach/coach-definitions";

interface CoachEmptyStateProps {
  userName?: string;
  coachId?: string;
  isLoadingGreeting?: boolean;
}

export function CoachEmptyState({ userName, coachId = "sage", isLoadingGreeting }: CoachEmptyStateProps) {
  const coach = getCoach(coachId);

  if (isLoadingGreeting) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center"
        data-testid="coach-empty-state"
      >
        <CoachOrb coachId={coachId} size={56} pulse />
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {coach.name} is preparing a greeting for you...
          </p>
          <CoachTypingIndicator />
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center"
      data-testid="coach-empty-state"
    >
      <CoachOrb coachId={coachId} size={56} pulse />
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">
          Hey{userName ? ` ${userName}` : ""}, what's on your mind?
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          {coach.description}
        </p>
      </div>
    </div>
  );
}
