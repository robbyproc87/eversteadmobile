"use client";

import { CoachOrb } from "./CoachOrb";
import { COACHES, COACH_IDS } from "@/lib/coach/coach-definitions";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CoachSelectorProps {
  activeCoachId: string;
  onSelect: (coachId: string) => void;
}

export function CoachSelector({ activeCoachId, onSelect }: CoachSelectorProps) {
  return (
    <div
      className="flex items-center justify-center gap-2 py-3 px-4 border-b"
      data-testid="coach-selector"
    >
      {COACH_IDS.map((id) => {
        const coach = COACHES[id];
        const isActive = id === activeCoachId;
        return (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onSelect(id)}
                className="rounded-full p-1 transition-all"
                style={{
                  opacity: isActive ? 1 : 0.5,
                  outline: isActive ? `2px solid ${coach.color}` : "2px solid transparent",
                  outlineOffset: "2px",
                }}
                data-testid={`coach-select-${id}`}
              >
                <CoachOrb coachId={id} size={24} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p className="font-medium">{coach.name}</p>
              <p className="text-muted-foreground">{coach.title}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
