"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Brain,
  Play,
  Pause,
  Clock,
  Star,
  Loader2,
  Check,
  ChevronRight,
  ChevronDown,
  Wind,
  Eye,
  Heart,
  Compass,
  Waves,
  Sparkles,
} from "lucide-react";
import { formatDuration, formatDate, formatDateTime } from "@/lib/utils";
import type { MeditationSession } from "@/types";
import { PreSessionCheckIn } from "@/components/meditation/PreSessionCheckIn";
import { PostSessionReview, type QualityMetrics } from "@/components/meditation/PostSessionReview";
import { DailyCheckIn } from "@/components/meditation/DailyCheckIn";
import { GenerateSessionDialog } from "@/components/meditation/GenerateSessionDialog";
import { MeditationPlayer } from "@/components/meditation/MeditationPlayer";
import { MyMeditations } from "@/components/meditation/MyMeditations";
import { AmbientSoundSelector } from "@/components/meditation/AmbientSoundSelector";
import { VolumeControls } from "@/components/meditation/VolumeControls";
import {
  AMBIENT_SOUNDS,
  loadAmbientPreference,
  saveAmbientPreference,
  getAmbientSoundUrl,
  type AmbientSound,
} from "@/lib/meditation/ambient-sounds";
import { usePlan } from "@/hooks/usePlan";
import { UpgradePrompt } from "@/components/plan/UpgradePrompt";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const DURATION_PRESETS = [
  { label: "5 min", seconds: 300 },
  { label: "10 min", seconds: 600 },
  { label: "20 min", seconds: 1200 },
];

const LIBRARY_ITEMS = [
  {
    id: "box-breathing",
    title: "Box Breathing",
    description: "Equal-count breathing pattern to calm your nervous system. Inhale, hold, exhale, hold — each for 4 counts.",
    suggestedDuration: 300,
    icon: Wind,
  },
  {
    id: "4-7-8-breathing",
    title: "4-7-8 Breathing",
    description: "A relaxation technique: inhale for 4, hold for 7, exhale for 8 counts.",
    suggestedDuration: 300,
    icon: Waves,
  },
  {
    id: "body-scan",
    title: "Body Scan",
    description: "Progressively relax each part of your body from head to toe, releasing tension as you go.",
    suggestedDuration: 600,
    icon: Eye,
  },
  {
    id: "focused-attention",
    title: "Focused Attention",
    description: "Anchor your awareness on a single point — your breath, a mantra, or a sensation.",
    suggestedDuration: 600,
    icon: Brain,
  },
  {
    id: "loving-kindness",
    title: "Loving-Kindness",
    description: "Cultivate compassion by directing well-wishes toward yourself and others.",
    suggestedDuration: 600,
    icon: Heart,
  },
  {
    id: "open-awareness",
    title: "Open Awareness",
    description: "Rest in spacious awareness, observing thoughts and sensations without attachment.",
    suggestedDuration: 1200,
    icon: Compass,
  },
];

export default function MeditationPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isFree } = usePlan();

  const [activeTab, setActiveTab] = useState<"timer" | "library">("timer");
  const [showMeditationUpgrade, setShowMeditationUpgrade] = useState(false);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(600);
  const [elapsed, setElapsed] = useState(0);
  const [sessionRating, setSessionRating] = useState<number | null>(null);
  const [meditationType, setMeditationType] = useState<string | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [ratingSavedId, setRatingSavedId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showPreCheckIn, setShowPreCheckIn] = useState(false);
  const [tensionBefore, setTensionBefore] = useState<number | undefined>();
  const [stressBefore, setStressBefore] = useState<number | undefined>();
  const [showPostReview, setShowPostReview] = useState(false);
  const [pendingSessionData, setPendingSessionData] = useState<{
    durationS: number;
    meditationType?: string;
    generatedMeditationId?: string;
  } | null>(null);

  const [generateDialogType, setGenerateDialogType] = useState<string | null>(null);
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [playerAmbientSoundId, setPlayerAmbientSoundId] = useState<string | undefined>();
  const [playerPreCheckIn, setPlayerPreCheckIn] = useState(false);
  const [playerMeditationId, setPlayerMeditationId] = useState<string | null>(null);

  const [timerAmbientId, setTimerAmbientId] = useState(() => loadAmbientPreference().soundId);
  const [timerBgVolume, setTimerBgVolume] = useState(() => loadAmbientPreference().backgroundVolume);
  const timerAmbientRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: sessions } = useQuery<MeditationSession[]>({
    queryKey: ["/api/meditation/sessions"],
  });

  const clearTimerInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimerInterval();
      timerAmbientRef.current?.pause();
      if (fadeRef.current) clearInterval(fadeRef.current);
    };
  }, [clearTimerInterval]);

  const fadeOutTimerAmbient = useCallback(() => {
    const audio = timerAmbientRef.current;
    if (!audio || audio.paused) return;
    if (fadeRef.current) clearInterval(fadeRef.current);

    const startVol = audio.volume;
    const steps = 30;
    const stepTime = 3000 / steps;
    const volStep = startVol / steps;
    let step = 0;

    fadeRef.current = setInterval(() => {
      step++;
      audio.volume = Math.max(0, startVol - volStep * step);
      if (step >= steps) {
        if (fadeRef.current) clearInterval(fadeRef.current);
        fadeRef.current = null;
        audio.pause();
        audio.currentTime = 0;
        audio.volume = startVol;
      }
    }, stepTime);
  }, []);

  const startTimerAmbient = useCallback(() => {
    const sound = AMBIENT_SOUNDS.find((s) => s.id === timerAmbientId);
    if (!sound?.storagePath) return;

    if (timerAmbientRef.current) {
      timerAmbientRef.current.pause();
    }
    const audio = new Audio(getAmbientSoundUrl(sound.storagePath));
    audio.loop = true;
    audio.volume = timerBgVolume / 100;
    timerAmbientRef.current = audio;
    audio.play().catch(() => {});
  }, [timerAmbientId, timerBgVolume]);

  const stopTimerAmbient = useCallback(() => {
    if (timerAmbientRef.current && !timerAmbientRef.current.paused) {
      timerAmbientRef.current.pause();
      timerAmbientRef.current.currentTime = 0;
    }
  }, []);

  useEffect(() => {
    if (timerAmbientRef.current && !timerAmbientRef.current.paused) {
      timerAmbientRef.current.volume = timerBgVolume / 100;
    }
  }, [timerBgVolume]);

  const resetTimerState = useCallback(() => {
    clearTimerInterval();
    setIsTimerActive(false);
    setElapsed(0);
    setSessionRating(null);
    setMeditationType(null);
    setTensionBefore(undefined);
    setStressBefore(undefined);
    stopTimerAmbient();
  }, [clearTimerInterval, stopTimerAmbient]);

  const logMutation = useMutation({
    mutationFn: async (data: {
      durationS: number;
      rating?: number;
      meditationType?: string;
      generatedMeditationId?: string;
      tensionBefore?: number;
      stressBefore?: number;
      attentionQuality?: number;
      mindWanderingCount?: number;
      emotionalTurbulence?: number;
      reactivity?: number;
      tensionAfter?: number;
      stressAfter?: number;
      insightText?: string;
      insightScore?: number;
    }) => {
      const response = await fetch("/api/meditation/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startedAt: new Date(Date.now() - data.durationS * 1000).toISOString(),
          endedAt: new Date().toISOString(),
          rating: data.rating,
          meditationType: data.meditationType,
          generatedMeditationId: data.generatedMeditationId,
          tensionBefore: data.tensionBefore,
          stressBefore: data.stressBefore,
          attentionQuality: data.attentionQuality,
          mindWanderingCount: data.mindWanderingCount,
          emotionalTurbulence: data.emotionalTurbulence,
          reactivity: data.reactivity,
          tensionAfter: data.tensionAfter,
          stressAfter: data.stressAfter,
          insightText: data.insightText,
          insightScore: data.insightScore,
        }),
      });
      if (!response.ok) throw new Error("Failed to log session");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Session logged", description: "Great job on your meditation!" });
      queryClient.invalidateQueries({ queryKey: ["/api/meditation/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/activity"] });
      resetTimerState();
      setActivePlayerId(null);
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to log session." });
    },
  });

  const ratingMutation = useMutation({
    mutationFn: async (data: { id: string; rating: number }) => {
      const response = await fetch("/api/meditation/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update rating");
      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/meditation/sessions"] });
      setRatingSavedId(variables.id);
      setTimeout(() => setRatingSavedId(null), 1500);
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to save rating." });
    },
  });

  const handleStartClick = () => {
    setShowPreCheckIn(true);
  };

  const handlePreCheckInBegin = (tension: number, stress: number) => {
    setTensionBefore(tension);
    setStressBefore(stress);
    setShowPreCheckIn(false);
    startTimer(selectedDuration);
  };

  const handlePreCheckInCancel = () => {
    setShowPreCheckIn(false);
    startTimer(selectedDuration);
  };

  const startTimer = (duration: number) => {
    clearTimerInterval();
    setSelectedDuration(duration);
    setElapsed(0);
    setIsTimerActive(true);
    startTimerAmbient();

    intervalRef.current = setInterval(() => {
      setElapsed((prev) => {
        if (prev >= duration) {
          clearTimerInterval();
          setIsTimerActive(false);
          fadeOutTimerAmbient();
          return duration;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const resumeTimer = () => {
    clearTimerInterval();
    setIsTimerActive(true);

    const ambient = timerAmbientRef.current;
    if (ambient && ambient.paused && timerAmbientId !== "none") {
      ambient.play().catch(() => {});
    }

    intervalRef.current = setInterval(() => {
      setElapsed((prev) => {
        if (prev >= selectedDuration) {
          clearTimerInterval();
          setIsTimerActive(false);
          fadeOutTimerAmbient();
          return selectedDuration;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    clearTimerInterval();
    setIsTimerActive(false);
    timerAmbientRef.current?.pause();
  };

  const handleLogSession = () => {
    if (elapsed < 60) {
      toast({
        variant: "destructive",
        title: "Too short",
        description: "Meditate for at least 1 minute to log.",
      });
      return;
    }
    fadeOutTimerAmbient();
    if (isFree) {
      logMutation.mutate({
        durationS: elapsed,
        meditationType: meditationType || undefined,
        rating: sessionRating || undefined,
        tensionBefore,
        stressBefore,
      });
      return;
    }
    setPendingSessionData({
      durationS: elapsed,
      meditationType: meditationType || undefined,
    });
    setShowPostReview(true);
  };

  const handlePostReviewComplete = (metrics: QualityMetrics) => {
    setShowPostReview(false);
    if (pendingSessionData) {
      logMutation.mutate({
        ...pendingSessionData,
        rating: metrics.rating || sessionRating || undefined,
        tensionBefore,
        stressBefore,
        attentionQuality: metrics.attentionQuality,
        mindWanderingCount: metrics.mindWanderingCount,
        emotionalTurbulence: metrics.emotionalTurbulence,
        reactivity: metrics.reactivity,
        tensionAfter: metrics.tensionAfter,
        stressAfter: metrics.stressAfter,
        insightText: metrics.insightText,
        insightScore: metrics.insightScore,
      });
      setPendingSessionData(null);
    }
  };

  const handlePostReviewDismiss = () => {
    setShowPostReview(false);
    if (pendingSessionData) {
      logMutation.mutate({
        ...pendingSessionData,
        rating: sessionRating || undefined,
        tensionBefore,
        stressBefore,
      });
      setPendingSessionData(null);
    }
  };

  const handleLibrarySelect = (item: (typeof LIBRARY_ITEMS)[number]) => {
    resetTimerState();
    setSelectedDuration(item.suggestedDuration);
    setMeditationType(item.title);
    setActiveTab("timer");
  };

  const handleSessionRating = (sessionId: string, rating: number) => {
    ratingMutation.mutate({ id: sessionId, rating });
  };

  const handleGenerateClick = (type: string) => {
    setGenerateDialogType(type);
  };

  const handleGenerated = (meditation: { id: string }, ambientSoundId: string) => {
    setGenerateDialogType(null);
    setPlayerMeditationId(meditation.id);
    setPlayerAmbientSoundId(ambientSoundId);
    setPlayerPreCheckIn(true);
    queryClient.invalidateQueries({ queryKey: ["/api/meditation/generated"] });
  };

  const handlePlayerPreCheckInBegin = (tension: number, stress: number) => {
    setTensionBefore(tension);
    setStressBefore(stress);
    setPlayerPreCheckIn(false);
    if (playerMeditationId) {
      setActivePlayerId(playerMeditationId);
      setPlayerMeditationId(null);
    }
  };

  const handlePlayerPreCheckInCancel = () => {
    setPlayerPreCheckIn(false);
    if (playerMeditationId) {
      setActivePlayerId(playerMeditationId);
      setPlayerMeditationId(null);
    }
  };

  const handlePlayerSessionEnd = (durationS: number, type: string, generatedMeditationId: string) => {
    if (isFree) {
      logMutation.mutate({
        durationS,
        meditationType: type,
        generatedMeditationId,
        tensionBefore,
        stressBefore,
      });
      return;
    }
    setPendingSessionData({
      durationS,
      meditationType: type,
      generatedMeditationId,
    });
    setShowPostReview(true);
  };

  const handleReplay = (meditationId: string) => {
    setPlayerMeditationId(meditationId);
    setPlayerAmbientSoundId(undefined);
    setPlayerPreCheckIn(true);
  };

  const handleTimerAmbientSelect = (sound: AmbientSound) => {
    setTimerAmbientId(sound.id);
    const existingPref = loadAmbientPreference();
    saveAmbientPreference({
      soundId: sound.id,
      voiceVolume: existingPref.voiceVolume,
      backgroundVolume: timerBgVolume,
    });

    if (isTimerActive || (elapsed > 0 && !isTimerActive)) {
      if (timerAmbientRef.current) {
        timerAmbientRef.current.pause();
        timerAmbientRef.current = null;
      }
      if (sound.storagePath) {
        const audio = new Audio(getAmbientSoundUrl(sound.storagePath));
        audio.loop = true;
        audio.volume = timerBgVolume / 100;
        timerAmbientRef.current = audio;
        if (isTimerActive) {
          audio.play().catch(() => {});
        }
      }
    }
  };

  const handleTimerBgVolumeChange = (v: number) => {
    setTimerBgVolume(v);
    const existingPref = loadAmbientPreference();
    saveAmbientPreference({
      soundId: timerAmbientId,
      voiceVolume: existingPref.voiceVolume,
      backgroundVolume: v,
    });
  };

  const progress = selectedDuration > 0 ? (elapsed / selectedDuration) * 100 : 0;
  const remaining = selectedDuration - elapsed;
  const displayMinutes = Math.floor(remaining / 60).toString().padStart(2, "0");
  const displaySeconds = (remaining % 60).toString().padStart(2, "0");

  if (activePlayerId) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        <MeditationPlayer
          meditationId={activePlayerId}
          onSessionEnd={handlePlayerSessionEnd}
          onBack={() => {
            setActivePlayerId(null);
            setPlayerAmbientSoundId(undefined);
            setTensionBefore(undefined);
            setStressBefore(undefined);
          }}
          initialAmbientSoundId={playerAmbientSoundId}
        />
        <PostSessionReview
          open={showPostReview}
          onComplete={handlePostReviewComplete}
          onDismiss={handlePostReviewDismiss}
          meditationType={pendingSessionData?.meditationType}
          sessionDuration={pendingSessionData?.durationS || 0}
          tensionBefore={tensionBefore}
          stressBefore={stressBefore}
        />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2" data-testid="text-meditation-title">
          <Brain className="h-8 w-8 text-purple-500" />
          Meditation
        </h1>
        <p className="text-muted-foreground mt-1">
          Find your calm and focus
        </p>
      </header>

      <div className="flex gap-1 border-b" data-testid="meditation-tabs">
        <button
          onClick={() => setActiveTab("timer")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "timer"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          data-testid="tab-timer"
        >
          <Clock className="h-4 w-4" />
          Timer
        </button>
        <button
          onClick={() => setActiveTab("library")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "library"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          data-testid="tab-library"
        >
          <Sparkles className="h-4 w-4" />
          Library
        </button>
      </div>

      {activeTab === "timer" && (
        <>
          <Card data-testid="card-quick-start">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Quick Start</CardTitle>
                {meditationType && (
                  <Badge variant="secondary" className="text-xs">
                    {meditationType}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-3">
                {DURATION_PRESETS.map((preset) => (
                  <Button
                    key={preset.seconds}
                    variant={selectedDuration === preset.seconds && !isTimerActive ? "default" : "outline"}
                    size="lg"
                    onClick={() => !isTimerActive && setSelectedDuration(preset.seconds)}
                    disabled={isTimerActive}
                    data-testid={`button-duration-${preset.seconds}`}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    {preset.label}
                  </Button>
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Ambient Sound</label>
                <AmbientSoundSelector
                  selectedId={timerAmbientId}
                  onSelect={handleTimerAmbientSelect}
                  disabled={false}
                  lockedForFree={isFree}
                />
              </div>

              <div className="text-center space-y-4">
                <div className="text-6xl font-mono font-light" data-testid="text-timer">
                  {displayMinutes}:{displaySeconds}
                </div>

                <Progress value={progress} className="h-2 max-w-md mx-auto" />

                <div className="flex justify-center gap-3">
                  {isTimerActive ? (
                    <Button size="lg" variant="outline" onClick={stopTimer} data-testid="button-pause">
                      <Pause className="h-5 w-5 mr-2" />
                      Pause
                    </Button>
                  ) : elapsed === 0 ? (
                    <Button size="lg" onClick={handleStartClick} data-testid="button-start">
                      <Play className="h-5 w-5 mr-2" />
                      Start
                    </Button>
                  ) : (
                    <>
                      <Button size="lg" variant="outline" onClick={resumeTimer} data-testid="button-resume">
                        <Play className="h-5 w-5 mr-2" />
                        Resume
                      </Button>
                      <Button
                        size="lg"
                        onClick={handleLogSession}
                        disabled={logMutation.isPending}
                        data-testid="button-log-session"
                      >
                        {logMutation.isPending ? (
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        ) : (
                          <Check className="h-5 w-5 mr-2" />
                        )}
                        Log Session
                      </Button>
                    </>
                  )}
                </div>

                {timerAmbientId !== "none" && (elapsed > 0 || isTimerActive) && (
                  <VolumeControls
                    voiceVolume={100}
                    onVoiceVolumeChange={() => {}}
                    backgroundVolume={timerBgVolume}
                    onBackgroundVolumeChange={handleTimerBgVolumeChange}
                    showVoice={false}
                  />
                )}

                {elapsed > 0 && !isTimerActive && (
                  <div className="flex justify-center gap-2 pt-4">
                    <span className="text-sm text-muted-foreground mr-2">Rate your session:</span>
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <Button
                        key={rating}
                        variant={sessionRating === rating ? "default" : "outline"}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setSessionRating(rating)}
                        data-testid={`button-rating-${rating}`}
                      >
                        <Star
                          className={`h-4 w-4 ${
                            sessionRating && rating <= sessionRating
                              ? "fill-current"
                              : ""
                          }`}
                        />
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {!isFree && <DailyCheckIn />}

          {sessions && sessions.length > 0 && (
            <Card data-testid="card-recent-sessions">
              <CardHeader>
                <CardTitle className="text-lg">Recent Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {sessions.slice(0, 10).map((session) => {
                    const duration = session.endedAt
                      ? Math.floor(
                          (new Date(session.endedAt).getTime() -
                            new Date(session.startedAt).getTime()) /
                            1000
                        )
                      : 0;
                    const isExpanded = expandedSessionId === session.id;

                    return (
                      <div key={session.id} data-testid={`session-${session.id}`}>
                        <button
                          type="button"
                          onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
                          className="w-full flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors text-left"
                          data-testid={`button-session-toggle-${session.id}`}
                        >
                          <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                            <Brain className="h-5 w-5 text-purple-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">
                              {formatDuration(duration)} meditation
                              {session.meditationType && (
                                <span className="text-muted-foreground font-normal"> · {session.meditationType}</span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(session.startedAt)}
                            </p>
                          </div>
                          {session.rating && !isExpanded && (
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: session.rating }).map((_, i) => (
                                <Star
                                  key={i}
                                  className="h-3.5 w-3.5 text-yellow-500 fill-current"
                                />
                              ))}
                            </div>
                          )}
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="ml-14 mr-8 py-3 space-y-3 border-l-2 border-muted pl-4" data-testid={`session-detail-${session.id}`}>
                            <div className="space-y-1 text-sm">
                              <p><span className="text-muted-foreground">Duration:</span> {formatDuration(duration)}</p>
                              <p><span className="text-muted-foreground">Date:</span> {formatDateTime(session.startedAt)}</p>
                              {session.meditationType && (
                                <p><span className="text-muted-foreground">Type:</span> {session.meditationType}</p>
                              )}
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">Rating:</p>
                              <div className="flex items-center gap-2">
                                {[1, 2, 3, 4, 5].map((rating) => (
                                  <button
                                    key={rating}
                                    type="button"
                                    onClick={() => handleSessionRating(session.id, rating)}
                                    className="p-1 rounded transition-colors hover:bg-muted"
                                    data-testid={`button-session-rating-${session.id}-${rating}`}
                                  >
                                    <Star
                                      className={`h-5 w-5 transition-colors ${
                                        session.rating && rating <= session.rating
                                          ? "text-yellow-500 fill-current"
                                          : "text-muted-foreground"
                                      }`}
                                    />
                                  </button>
                                ))}
                                {ratingSavedId === session.id && (
                                  <span className="text-xs text-muted-foreground animate-in fade-in">Saved</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {activeTab === "library" && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="meditation-library">
            {LIBRARY_ITEMS.map((item) => {
              const IconComponent = item.icon;
              const durationLabel = `${item.suggestedDuration / 60} min`;
              return (
                <Card
                  key={item.id}
                  className="hover:bg-muted/30 transition-colors"
                  data-testid={`library-card-${item.id}`}
                >
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                          <IconComponent className="h-5 w-5 text-purple-500" />
                        </div>
                        <h3 className="font-semibold">{item.title}</h3>
                      </div>
                      <Badge variant="secondary" className="text-xs flex-shrink-0">
                        {durationLabel}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleLibrarySelect(item)}
                        data-testid={`button-quick-start-${item.id}`}
                      >
                        <Clock className="h-3.5 w-3.5 mr-1.5" />
                        Quick Start
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-purple-600 hover:bg-purple-500 text-white"
                        onClick={() => isFree ? setShowMeditationUpgrade(true) : handleGenerateClick(item.title)}
                        data-testid={`button-generate-${item.id}`}
                      >
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                        Generate
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <MyMeditations onReplay={handleReplay} />
        </div>
      )}

      {showPreCheckIn && (
        <PreSessionCheckIn
          onBegin={handlePreCheckInBegin}
          onCancel={handlePreCheckInCancel}
        />
      )}

      {playerPreCheckIn && (
        <PreSessionCheckIn
          onBegin={handlePlayerPreCheckInBegin}
          onCancel={handlePlayerPreCheckInCancel}
        />
      )}

      <PostSessionReview
        open={showPostReview}
        onComplete={handlePostReviewComplete}
        onDismiss={handlePostReviewDismiss}
        meditationType={pendingSessionData?.meditationType}
        sessionDuration={pendingSessionData?.durationS || 0}
        tensionBefore={tensionBefore}
        stressBefore={stressBefore}
      />

      {generateDialogType && (
        <GenerateSessionDialog
          open={!!generateDialogType}
          onClose={() => setGenerateDialogType(null)}
          meditationType={generateDialogType}
          onGenerated={handleGenerated}
        />
      )}

      <Dialog open={showMeditationUpgrade} onOpenChange={setShowMeditationUpgrade}>
        <DialogContent className="max-w-sm" data-testid="dialog-meditation-upgrade">
          <UpgradePrompt
            feature="AI-Generated Meditations"
            description="Create personalized guided meditations with Sage's voice and calming ambient sounds."
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
