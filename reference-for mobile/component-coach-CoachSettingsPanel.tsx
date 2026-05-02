"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { X, Shield } from "lucide-react";
import type { CoachSettingsData } from "@/lib/coach/coach-types";

interface CoachSettingsPanelProps {
  onClose: () => void;
}

function proactivityLabel(level: number) {
  if (level <= 15) return "Silent - I'll come to you when I need help";
  if (level <= 40) return "Quiet - Only speak when spoken to";
  if (level <= 60) return "Balanced - Offer suggestions occasionally";
  if (level <= 85) return "Active - Help me stay on track";
  return "Always on - Keep me accountable";
}

export function CoachSettingsPanel({ onClose }: CoachSettingsPanelProps) {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<CoachSettingsData>({
    queryKey: ["coach", "settings"],
    queryFn: async () => {
      const res = await fetch("/api/coach/settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async (updates: Partial<CoachSettingsData>) => {
      const res = await fetch("/api/coach/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update settings");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["coach", "settings"], data);
    },
  });

  const toggles = [
    {
      key: "accessJournal" as const,
      label: "Journal entries",
      description: "Let Sage read your journal entries for personalized coaching",
    },
    {
      key: "accessPlanner" as const,
      label: "Planner & goals",
      description: "Let Sage see your daily plans, priorities, and weekly goals",
    },
    {
      key: "accessMeditation" as const,
      label: "Meditation",
      description: "Let Sage track your meditation practice",
    },
    {
      key: "accessBooks" as const,
      label: "Books & courses",
      description: "Let Sage know what you're reading and learning",
    },
    {
      key: "accessMood" as const,
      label: "Mood data",
      description: "Let Sage understand your emotional patterns",
    },
  ];

  if (isLoading || !settings) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Coach Settings</h3>
          <Button size="icon" variant="ghost" onClick={onClose} data-testid="coach-settings-close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="coach-settings-panel">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Coach Settings</h3>
        <Button size="icon" variant="ghost" onClick={onClose} data-testid="coach-settings-close">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium">Coach Proactivity</label>
        <input
          type="range"
          min={0}
          max={100}
          value={settings.proactivityLevel}
          onChange={(e) =>
            mutation.mutate({ proactivityLevel: Number(e.target.value) })
          }
          className="w-full accent-amber-500 cursor-pointer"
          data-testid="coach-proactivity-slider"
        />
        <p className="text-xs text-muted-foreground">
          {proactivityLabel(settings.proactivityLevel)}
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Coach Data Access</label>
        <p className="text-xs text-muted-foreground mb-3">
          Control what data Sage can see to personalize your coaching.
        </p>
        <div className="space-y-4">
          {toggles.map((toggle) => (
            <div
              key={toggle.key}
              className="flex items-start justify-between gap-3"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{toggle.label}</p>
                <p className="text-xs text-muted-foreground">
                  {toggle.description}
                </p>
              </div>
              <Switch
                checked={settings[toggle.key]}
                onCheckedChange={(checked) =>
                  mutation.mutate({ [toggle.key]: checked })
                }
                data-testid={`coach-toggle-${toggle.key}`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
        <Shield className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Your data is never used to train AI models. Sage only accesses the
          data types you enable above, and never reads entries you've marked as
          private. All conversations are encrypted and only accessible by you.
        </p>
      </div>
    </div>
  );
}
