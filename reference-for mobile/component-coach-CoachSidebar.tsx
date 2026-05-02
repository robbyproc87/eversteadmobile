"use client";

import { cn } from "@/lib/utils";
import { CoachOrb } from "./CoachOrb";
import { Button } from "@/components/ui/button";
import { X, Settings as SettingsIcon } from "lucide-react";
import { COACHES, COACH_IDS } from "@/lib/coach/coach-definitions";

interface CoachSidebarProps {
  activeCoachId: string;
  onCoachSelect: (coachId: string) => void;
  onSettings: () => void;
  onClose?: () => void;
  isMobileDrawer?: boolean;
}

export function CoachSidebar({
  activeCoachId,
  onCoachSelect,
  onSettings,
  onClose,
  isMobileDrawer,
}: CoachSidebarProps) {
  return (
    <div
      className={cn(
        "flex flex-col h-full bg-muted/30",
        isMobileDrawer ? "w-full" : "w-72 border-r"
      )}
      data-testid="coach-sidebar"
    >
      <div className="p-4 flex items-center gap-3 border-b">
        <h2 className="font-semibold text-sm flex-1">Coaching Team</h2>
        {isMobileDrawer && onClose && (
          <Button size="icon" variant="ghost" onClick={onClose} data-testid="coach-sidebar-close">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {COACH_IDS.map((id) => {
          const coach = COACHES[id];
          const isActive = id === activeCoachId;
          return (
            <button
              key={id}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-3 rounded-lg text-left transition-colors",
                isActive
                  ? "bg-sidebar-accent"
                  : "hover:bg-muted"
              )}
              style={isActive ? { borderLeft: `3px solid ${coach.color}` } : { borderLeft: "3px solid transparent" }}
              onClick={() => {
                onCoachSelect(id);
                if (isMobileDrawer && onClose) onClose();
              }}
              data-testid={`coach-select-${id}`}
            >
              <CoachOrb coachId={id} size={32} pulse={isActive} />
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-semibold"
                  style={{ color: coach.color }}
                >
                  {coach.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {coach.shortDescription}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="p-3 border-t">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={onSettings}
          data-testid="coach-settings-button"
        >
          <SettingsIcon className="h-4 w-4" />
          Settings
        </Button>
      </div>
    </div>
  );
}
