"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play } from "lucide-react";

interface PreSessionCheckInProps {
  onBegin: (tensionBefore: number, stressBefore: number) => void;
  onCancel: () => void;
}

export function PreSessionCheckIn({ onBegin, onCancel }: PreSessionCheckInProps) {
  const [tension, setTension] = useState(5);
  const [stress, setStress] = useState(5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" data-testid="pre-session-overlay">
      <div className="w-full max-w-md mx-4 rounded-2xl bg-gradient-to-b from-purple-950/90 to-background border border-purple-500/20 p-8 space-y-8 shadow-2xl">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-white">Before You Begin</h2>
          <p className="text-sm text-purple-200/70">
            Notice how you're feeling right now
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-purple-100">Body Tension</label>
              <span className="text-sm font-mono text-purple-300" data-testid="text-tension-value">{tension}</span>
            </div>
            <Slider
              value={[tension]}
              onValueChange={([v]) => setTension(v)}
              min={1}
              max={10}
              step={1}
              className="w-full"
              data-testid="slider-tension"
            />
            <div className="flex justify-between text-xs text-purple-300/60">
              <span>Fully relaxed</span>
              <span>Very tense</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-purple-100">Stress / Agitation</label>
              <span className="text-sm font-mono text-purple-300" data-testid="text-stress-value">{stress}</span>
            </div>
            <Slider
              value={[stress]}
              onValueChange={([v]) => setStress(v)}
              min={1}
              max={10}
              step={1}
              className="w-full"
              data-testid="slider-stress"
            />
            <div className="flex justify-between text-xs text-purple-300/60">
              <span>Calm</span>
              <span>Very stressed</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="ghost"
            className="flex-1 text-purple-300 hover:text-white hover:bg-purple-900/50"
            onClick={onCancel}
            data-testid="button-checkin-cancel"
          >
            Skip
          </Button>
          <Button
            className="flex-1 bg-purple-600 hover:bg-purple-500 text-white"
            onClick={() => onBegin(tension, stress)}
            data-testid="button-checkin-begin"
          >
            <Play className="h-4 w-4 mr-2" />
            Begin
          </Button>
        </div>
      </div>
    </div>
  );
}
