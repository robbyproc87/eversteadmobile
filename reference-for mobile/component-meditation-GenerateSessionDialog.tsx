"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Clock } from "lucide-react";
import {
  AMBIENT_SOUNDS,
  loadAmbientPreference,
  saveAmbientPreference,
  type AmbientSound,
} from "@/lib/meditation/ambient-sounds";
import { AmbientSoundSelector } from "./AmbientSoundSelector";

interface GeneratedMeditation {
  id: string;
  meditationType: string;
  durationS: number;
  scriptText: string;
  audioPath: string;
}

interface GenerateSessionDialogProps {
  open: boolean;
  onClose: () => void;
  meditationType: string;
  onGenerated: (meditation: GeneratedMeditation, ambientSoundId: string) => void;
}

const DURATIONS = [
  { label: "5 min", seconds: 300 },
  { label: "10 min", seconds: 600 },
  { label: "20 min", seconds: 1200 },
];

export function GenerateSessionDialog({
  open,
  onClose,
  meditationType,
  onGenerated,
}: GenerateSessionDialogProps) {
  const { toast } = useToast();
  const [selectedDuration, setSelectedDuration] = useState(600);
  const [selectedAmbientId, setSelectedAmbientId] = useState(() => loadAmbientPreference().soundId);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/meditation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meditationType,
          durationS: selectedDuration,
          voice: "nova",
        }),
      });
      if (res.status === 429) {
        throw new Error("You've reached the daily generation limit (5 per day). Try again tomorrow.");
      }
      if (!res.ok) throw new Error("Generation failed");
      return res.json();
    },
    onSuccess: (data) => {
      onGenerated(data, selectedAmbientId);
      onClose();
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Generation Failed", description: error.message });
    },
  });

  const handleAmbientSelect = (sound: AmbientSound) => {
    setSelectedAmbientId(sound.id);
    const pref = loadAmbientPreference();
    saveAmbientPreference({ ...pref, soundId: sound.id });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !generateMutation.isPending && onClose()}>
      <DialogContent className="max-w-md" data-testid="dialog-generate">
        {generateMutation.isPending ? (
          <div className="flex flex-col items-center py-8 space-y-6" data-testid="generate-loading">
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-purple-500/20 animate-pulse" />
              <div className="absolute inset-2 h-16 w-16 rounded-full bg-purple-500/30 animate-pulse" style={{ animationDelay: "0.5s" }} />
              <div className="absolute inset-4 h-12 w-12 rounded-full bg-purple-500/40 animate-pulse" style={{ animationDelay: "1s" }} />
            </div>
            <div className="text-center space-y-2">
              <p className="font-medium text-lg">Zen is preparing your meditation...</p>
              <p className="text-sm text-muted-foreground">
                Writing your personalized script and generating audio. This may take a minute.
              </p>
            </div>
            <div className="w-full space-y-2 pt-2">
              <label className="text-xs font-medium text-muted-foreground">Pre-select your ambient sound</label>
              <AmbientSoundSelector
                selectedId={selectedAmbientId}
                onSelect={handleAmbientSelect}
              />
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                Generate {meditationType}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 pt-2">
              <div className="space-y-3">
                <label className="text-sm font-medium">Duration</label>
                <div className="flex gap-3">
                  {DURATIONS.map((d) => (
                    <Button
                      key={d.seconds}
                      variant={selectedDuration === d.seconds ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setSelectedDuration(d.seconds)}
                      data-testid={`button-gen-duration-${d.seconds}`}
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      {d.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium">Ambient Sound</label>
                <AmbientSoundSelector
                  selectedId={selectedAmbientId}
                  onSelect={handleAmbientSelect}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Zen will create a personalized {meditationType.toLowerCase()} meditation
                tailored to your goals and current state.
              </p>
              <Button
                className="w-full bg-purple-600 hover:bg-purple-500"
                onClick={() => generateMutation.mutate()}
                data-testid="button-generate"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Meditation
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
