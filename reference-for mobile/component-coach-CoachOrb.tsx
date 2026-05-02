"use client";

import { cn } from "@/lib/utils";
import { COACHES } from "@/lib/coach/coach-definitions";

interface CoachOrbProps {
  size?: number;
  pulse?: boolean;
  gradientFrom?: string;
  gradientTo?: string;
  coachId?: string;
  className?: string;
}

export function CoachOrb({
  size = 32,
  pulse = false,
  gradientFrom,
  gradientTo,
  coachId = "sage",
  className,
}: CoachOrbProps) {
  const coach = COACHES[coachId] || COACHES.sage;
  const from = gradientFrom || coach.gradientFrom;
  const to = gradientTo || coach.gradientTo;
  const color = coach.color;

  return (
    <div
      className={cn("shrink-0", pulse && "animate-pulse", className)}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle at 35% 35%, ${from}, ${color} 40%, ${to})`,
        boxShadow: `0 0 12px 2px ${color}4D`,
      }}
      data-testid={`coach-orb-${coachId}`}
    />
  );
}
