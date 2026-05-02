"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Pause, Loader2, Volume2 } from "lucide-react";
import { useAudioMixer } from "@/lib/meditation/use-audio-mixer";
import {
  AMBIENT_SOUNDS,
  loadAmbientPreference,
  saveAmbientPreference,
  type AmbientSound,
} from "@/lib/meditation/ambient-sounds";
import { AmbientSoundSelector } from "./AmbientSoundSelector";
import { VolumeControls } from "./VolumeControls";

interface MeditationPlayerProps {
  meditationId: string;
  onSessionEnd: (durationS: number, meditationType: string, generatedMeditationId: string) => void;
  onBack: () => void;
  initialAmbientSoundId?: string;
}

interface GeneratedMeditationDetail {
  id: string;
  meditationType: string;
  durationS: number;
  scriptText: string;
  audioUrl: string | null;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function cleanScriptForDisplay(text: string): string {
  return text
    .replace(/\[PAUSE \d+s\]/g, "⋯")
    .replace(/\[TRANSITION\]/g, "\n\n—\n\n");
}

export function MeditationPlayer({ meditationId, onSessionEnd, onBack, initialAmbientSoundId }: MeditationPlayerProps) {
  const [selectedAmbientId, setSelectedAmbientId] = useState(() => {
    if (initialAmbientSoundId) return initialAmbientSoundId;
    return loadAmbientPreference().soundId;
  });

  const [sessionEnded, setSessionEnded] = useState(false);
  const sessionEndedRef = useRef(false);

  const mixer = useAudioMixer({
    onVoiceEnded: useCallback(() => {
      if (!sessionEndedRef.current) {
        sessionEndedRef.current = true;
        setSessionEnded(true);
      }
    }, []),
  });

  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const pref = loadAmbientPreference();
    mixer.setVoiceVolume(pref.voiceVolume);
    mixer.setBackgroundVolume(pref.backgroundVolume);
  }, []);

  const { data: meditation, isLoading } = useQuery<GeneratedMeditationDetail>({
    queryKey: ["/api/meditation/generated", meditationId],
    queryFn: async () => {
      const res = await fetch(`/api/meditation/generated/${meditationId}`);
      if (!res.ok) throw new Error("Failed to fetch meditation");
      return res.json();
    },
  });

  useEffect(() => {
    if (meditation?.audioUrl) {
      mixer.initVoice(meditation.audioUrl);
    }
  }, [meditation?.audioUrl]);

  useEffect(() => {
    const sound = AMBIENT_SOUNDS.find((s) => s.id === selectedAmbientId);
    mixer.setAmbientSound(sound?.storagePath || null);
  }, [selectedAmbientId]);

  useEffect(() => {
    if (sessionEnded && meditation) {
      const actualDuration = Math.floor(mixer.voiceDuration || meditation.durationS);
      onSessionEnd(actualDuration, meditation.meditationType, meditation.id);
    }
  }, [sessionEnded]);

  const handleTogglePlayPause = () => {
    if (!hasStarted) {
      setHasStarted(true);
    }
    mixer.togglePlayPause();
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mixer.voiceDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    mixer.seekVoice(ratio * mixer.voiceDuration);
  };

  const handleAmbientSelect = (sound: AmbientSound) => {
    setSelectedAmbientId(sound.id);
    saveAmbientPreference({
      soundId: sound.id,
      voiceVolume: mixer.voiceVolume,
      backgroundVolume: mixer.backgroundVolume,
    });
  };

  const handleVoiceVolumeChange = (v: number) => {
    mixer.setVoiceVolume(v);
    saveAmbientPreference({
      soundId: selectedAmbientId,
      voiceVolume: v,
      backgroundVolume: mixer.backgroundVolume,
    });
  };

  const handleBgVolumeChange = (v: number) => {
    mixer.setBackgroundVolume(v);
    saveAmbientPreference({
      soundId: selectedAmbientId,
      voiceVolume: mixer.voiceVolume,
      backgroundVolume: v,
    });
  };

  const handleBack = () => {
    mixer.stopAll();
    onBack();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        <p className="text-muted-foreground">Loading meditation...</p>
      </div>
    );
  }

  if (!meditation || !meditation.audioUrl) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-muted-foreground">Audio not available</p>
        <Button variant="outline" onClick={onBack}>Go back</Button>
      </div>
    );
  }

  const progress = mixer.voiceDuration > 0 ? (mixer.voiceCurrentTime / mixer.voiceDuration) * 100 : 0;
  const remaining = Math.max(0, mixer.voiceDuration - mixer.voiceCurrentTime);

  return (
    <div className="space-y-6" data-testid="meditation-player">
      <Button variant="ghost" size="sm" onClick={handleBack} data-testid="button-player-back">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Library
      </Button>

      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="text-center space-y-2">
            <Badge variant="secondary">{meditation.meditationType}</Badge>
            <h3 className="text-xl font-semibold">Guided Session</h3>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Ambient Sound</label>
            <AmbientSoundSelector
              selectedId={selectedAmbientId}
              onSelect={handleAmbientSelect}
            />
          </div>

          <div className="text-center space-y-4">
            <div className="text-5xl font-mono font-light" data-testid="text-player-timer">
              {formatTime(remaining)}
            </div>

            <div
              className="h-2 bg-muted rounded-full cursor-pointer overflow-hidden"
              onClick={handleProgressClick}
              data-testid="player-progress"
            >
              <div
                className="h-full bg-purple-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatTime(mixer.voiceCurrentTime)}</span>
              <span>{formatTime(mixer.voiceDuration)}</span>
            </div>

            <Button
              size="lg"
              className="h-16 w-16 rounded-full bg-purple-600 hover:bg-purple-500"
              onClick={handleTogglePlayPause}
              disabled={!mixer.voiceReady}
              data-testid="button-play-pause"
            >
              {!mixer.voiceReady ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : mixer.isPlaying ? (
                <Pause className="h-6 w-6" />
              ) : (
                <Play className="h-6 w-6 ml-1" />
              )}
            </Button>

            {selectedAmbientId !== "none" && (
              <VolumeControls
                voiceVolume={mixer.voiceVolume}
                onVoiceVolumeChange={handleVoiceVolumeChange}
                backgroundVolume={mixer.backgroundVolume}
                onBackgroundVolumeChange={handleBgVolumeChange}
                showVoice={true}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-medium text-muted-foreground">Script</h4>
          </div>
          <div
            className="prose prose-sm dark:prose-invert max-h-[300px] overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap"
            data-testid="text-script"
          >
            {cleanScriptForDisplay(meditation.scriptText)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
