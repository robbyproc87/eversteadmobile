"use client";

import { CoachOrb } from "./CoachOrb";

interface SageOrbProps {
  size?: number;
  pulse?: boolean;
  className?: string;
}

export function SageOrb({ size = 32, pulse = false, className }: SageOrbProps) {
  return (
    <CoachOrb
      size={size}
      pulse={pulse}
      coachId="sage"
      className={className}
    />
  );
}
