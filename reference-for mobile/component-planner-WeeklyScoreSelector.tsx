"use client";

import { useState } from "react";
import { Slider } from "@/components/ui/slider";

interface WeeklyScoreSelectorProps {
  value: number | null;
  onChange: (score: number | null) => void;
}

function getRatingColor(n: number): string {
  if (n <= 3) return "text-red-500";
  if (n <= 6) return "text-amber-500";
  if (n <= 8) return "text-blue-500";
  return "text-green-500";
}

function getTrackClass(n: number): string {
  if (n <= 3) return "[&_[role=slider]]:border-red-500 [&_span[data-orientation]>span]:bg-red-500";
  if (n <= 6) return "[&_[role=slider]]:border-amber-500 [&_span[data-orientation]>span]:bg-amber-500";
  if (n <= 8) return "[&_[role=slider]]:border-blue-500 [&_span[data-orientation]>span]:bg-blue-500";
  return "[&_[role=slider]]:border-green-500 [&_span[data-orientation]>span]:bg-green-500";
}

export default function WeeklyScoreSelector({ value, onChange }: WeeklyScoreSelectorProps) {
  const [hasInteracted, setHasInteracted] = useState(value !== null);
  const displayValue = value ?? 5;

  const handleChange = (v: number[]) => {
    if (!hasInteracted) setHasInteracted(true);
    onChange(v[0]);
  };

  return (
    <div className="space-y-4" data-testid="weekly-score-selector">
      <div className={`text-5xl font-bold text-center transition-colors ${hasInteracted ? getRatingColor(displayValue) : "text-muted-foreground/40"}`}>
        {displayValue}
      </div>

      <Slider
        value={[displayValue]}
        onValueChange={handleChange}
        min={1}
        max={10}
        step={1}
        className={`w-full ${hasInteracted ? getTrackClass(displayValue) : ""}`}
        data-testid="slider-weekly-score"
      />

      <div className="flex justify-between text-xs text-muted-foreground px-1">
        <span>Mediocre</span>
        <span>Solid</span>
        <span>World Class</span>
      </div>
    </div>
  );
}
