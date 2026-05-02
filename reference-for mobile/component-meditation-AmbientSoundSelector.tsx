"use client";

import { useState } from "react";
import { Crown } from "lucide-react";
import { AMBIENT_SOUNDS, type AmbientSound } from "@/lib/meditation/ambient-sounds";
import { UpgradePrompt } from "@/components/plan/UpgradePrompt";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

interface AmbientSoundSelectorProps {
  selectedId: string;
  onSelect: (sound: AmbientSound) => void;
  disabled?: boolean;
  lockedForFree?: boolean;
}

export function AmbientSoundSelector({
  selectedId,
  onSelect,
  disabled,
  lockedForFree = false,
}: AmbientSoundSelectorProps) {
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  const handleClick = (sound: AmbientSound) => {
    if (lockedForFree && sound.id !== "none") {
      setShowUpgradeDialog(true);
      return;
    }
    onSelect(sound);
  };

  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin" data-testid="ambient-sound-selector">
        {AMBIENT_SOUNDS.map((sound) => {
          const Icon = sound.icon;
          const isSelected = selectedId === sound.id;
          const isLocked = lockedForFree && sound.id !== "none";
          return (
            <button
              key={sound.id}
              onClick={() => handleClick(sound)}
              disabled={disabled}
              className={`relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl border text-xs font-medium transition-all flex-shrink-0 min-w-[60px] min-h-[44px] ${
                isSelected
                  ? "border-purple-500 bg-purple-500/10 text-foreground"
                  : "border-border hover:border-purple-500/50 text-muted-foreground"
              } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
              data-testid={`button-ambient-${sound.id}`}
            >
              <Icon className={`h-4 w-4 ${isSelected ? "text-purple-500" : ""}`} />
              <span className="leading-none">{sound.name}</span>
              {isLocked && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                  <Crown className="h-2.5 w-2.5 text-primary-foreground" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="max-w-sm" data-testid="dialog-ambient-upgrade">
          <UpgradePrompt
            feature="Ambient Sounds"
            description="Layer calming rain, ocean waves, forest sounds, and more to deepen your meditation."
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
