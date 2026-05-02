"use client";

import { Slider } from "@/components/ui/slider";
import { Volume2, Music } from "lucide-react";

interface VolumeControlsProps {
  voiceVolume: number;
  onVoiceVolumeChange: (v: number) => void;
  backgroundVolume: number;
  onBackgroundVolumeChange: (v: number) => void;
  showVoice?: boolean;
}

export function VolumeControls({
  voiceVolume,
  onVoiceVolumeChange,
  backgroundVolume,
  onBackgroundVolumeChange,
  showVoice = true,
}: VolumeControlsProps) {
  return (
    <div className="space-y-3 w-full max-w-xs mx-auto" data-testid="volume-controls">
      {showVoice && (
        <div className="flex items-center gap-3 min-h-[44px]">
          <Volume2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground w-12 flex-shrink-0">Voice</span>
          <Slider
            value={[voiceVolume]}
            onValueChange={([v]) => onVoiceVolumeChange(v)}
            min={0}
            max={100}
            step={5}
            className="flex-1"
            data-testid="slider-voice-volume"
          />
          <span className="text-xs text-muted-foreground w-8 text-right flex-shrink-0">{voiceVolume}%</span>
        </div>
      )}
      <div className="flex items-center gap-3 min-h-[44px]">
        <Music className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-xs text-muted-foreground w-12 flex-shrink-0">Ambient</span>
        <Slider
          value={[backgroundVolume]}
          onValueChange={([v]) => onBackgroundVolumeChange(v)}
          min={0}
          max={100}
          step={5}
          className="flex-1"
          data-testid="slider-background-volume"
        />
        <span className="text-xs text-muted-foreground w-8 text-right flex-shrink-0">{backgroundVolume}%</span>
      </div>
    </div>
  );
}
