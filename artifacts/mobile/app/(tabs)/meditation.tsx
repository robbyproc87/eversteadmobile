import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useDrawer } from "@/contexts/DrawerContext";
import { useToast } from "@/contexts/ToastContext";
import Colors from "@/constants/colors";
import { api, isPreviewAuthError } from "@/lib/api";
import type { GeneratedMeditation, MeditationSession } from "@/lib/api";
import { usePlan } from "@/lib/plan";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import DailyMindfulnessCheckin from "@/components/meditation/DailyMindfulnessCheckin";
import GenerateSessionDialog from "@/components/meditation/GenerateSessionDialog";
import PreSessionCheckin from "@/components/meditation/PreSessionCheckin";
import PostSessionReview, {
  type PostSessionMetrics,
} from "@/components/meditation/PostSessionReview";
import { supabase } from "@/lib/supabase";
import { MenuIcon } from "@/components/MenuIcon";
import { PreviewEmptyState } from "@/components/PreviewEmptyState";

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

interface AmbientSound {
  id: string;
  name: string;
  icon: FeatherIconName;
  storagePath: string | null;
}

const AMBIENT_SOUNDS: AmbientSound[] = [
  { id: "none", name: "None", icon: "volume-x", storagePath: null },
  { id: "rain", name: "Rain", icon: "cloud-rain", storagePath: "rain.mp3" },
  { id: "ocean", name: "Ocean", icon: "wind", storagePath: "ocean.mp3" },
  { id: "forest", name: "Forest", icon: "feather", storagePath: "forest.mp3" },
  { id: "bowls", name: "Bowls", icon: "circle", storagePath: "bowls.mp3" },
  { id: "white-noise", name: "White Noise", icon: "radio", storagePath: "white-noise.mp3" },
  { id: "stream", name: "Stream", icon: "droplet", storagePath: "stream.mp3" },
];

const DURATION_PRESETS = [
  { label: "5 min", seconds: 300 },
  { label: "10 min", seconds: 600 },
  { label: "20 min", seconds: 1200 },
];

function getAmbientSoundUrl(storagePath: string): string | null {
  try {
    const { data } = supabase.storage
      .from("ambient-sounds")
      .getPublicUrl(storagePath);
    return data?.publicUrl ?? null;
  } catch {
    return null;
  }
}

function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60).toString().padStart(2, "0");
  const s = (safe % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function MeditationScreen() {
  const insets = useSafeAreaInsets();
  const { openDrawer } = useDrawer();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const [selectedDuration, setSelectedDuration] = useState(600);
  const [elapsed, setElapsed] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [ambientId, setAmbientId] = useState<string>("none");
  const [bgVolume, setBgVolume] = useState(70);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ambientSoundRef = useRef<Audio.Sound | null>(null);
  const ambientTokenRef = useRef(0);

  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [ambientUpgradeOpen, setAmbientUpgradeOpen] = useState(false);
  const plan = usePlan();
  const [pendingDurationS, setPendingDurationS] = useState(0);
  const [preCheckinOpen, setPreCheckinOpen] = useState(false);
  const [postReviewOpen, setPostReviewOpen] = useState(false);
  const [reviewSessionId, setReviewSessionId] = useState<string | null>(null);
  const [tensionBefore, setTensionBefore] = useState<number | null>(null);
  const [stressBefore, setStressBefore] = useState<number | null>(null);
  const checkinRef = useRef<{ tensionBefore: number | null; stressBefore: number | null }>({
    tensionBefore: null,
    stressBefore: null,
  });

  const sessionsQuery = useQuery({
    queryKey: ["meditation", "sessions"],
    queryFn: () => api.listMeditationSessions(),
  });

  const generatedQuery = useQuery({
    queryKey: ["meditation", "generated"],
    queryFn: () => api.listGeneratedMeditations(),
  });

  const createSession = useMutation({
    mutationFn: (input: {
      durationS: number;
      rating?: number;
      tensionBefore?: number;
      stressBefore?: number;
    }) => api.createMeditationSession(input),
    onSuccess: (sess) => {
      queryClient.invalidateQueries({ queryKey: ["meditation", "sessions"] });
      showToast("Session logged");
      if (sess?.id) {
        setReviewSessionId(sess.id);
        if (plan.isPro) {
          setPostReviewOpen(true);
        }
      }
    },
    onError: () => {
      showToast("Failed to log session", { variant: "error" });
    },
  });

  const updateRating = useMutation({
    mutationFn: ({ id, rating }: { id: string; rating: number }) =>
      api.rateMeditationSession(id, rating),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meditation", "sessions"] });
    },
  });

  const updateReview = useMutation({
    mutationFn: ({ id, metrics }: { id: string; metrics: PostSessionMetrics }) =>
      api.updateMeditationSession(id, metrics),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meditation", "sessions"] });
      showToast("Review saved");
      setPostReviewOpen(false);
      setReviewSessionId(null);
      setTensionBefore(null);
      setStressBefore(null);
      checkinRef.current = { tensionBefore: null, stressBefore: null };
    },
    onError: () => {
      showToast("Failed to save review", { variant: "error" });
    },
  });

  const deleteGenerated = useMutation({
    mutationFn: (id: string) => api.deleteGeneratedMeditation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meditation", "generated"] });
      showToast("Removed");
    },
    onError: () => {
      showToast("Failed to delete", { variant: "error" });
    },
  });

  const clearTimerInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const stopAmbient = useCallback(async () => {
    ambientTokenRef.current += 1;
    const s = ambientSoundRef.current;
    ambientSoundRef.current = null;
    if (!s) return;
    try {
      await s.stopAsync();
    } catch {
      // ignore
    }
    try {
      await s.unloadAsync();
    } catch {
      // ignore
    }
  }, []);

  const loadAmbient = useCallback(
    async (storagePath: string, volume: number) => {
      const token = ++ambientTokenRef.current;
      // Tear down existing without bumping token again
      const prev = ambientSoundRef.current;
      ambientSoundRef.current = null;
      if (prev) {
        try {
          await prev.stopAsync();
        } catch {}
        try {
          await prev.unloadAsync();
        } catch {}
      }
      const url = getAmbientSoundUrl(storagePath);
      if (!url) return;
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true, isLooping: true, volume: volume / 100 },
        );
        // If a newer call took over (or unmount happened), discard this one.
        if (token !== ambientTokenRef.current) {
          try {
            await newSound.unloadAsync();
          } catch {}
          return;
        }
        ambientSoundRef.current = newSound;
      } catch {
        // ambient sound failed to load — silently continue
      }
    },
    [],
  );

  const startAmbient = useCallback(async () => {
    const sound = AMBIENT_SOUNDS.find((s) => s.id === ambientId);
    if (!sound?.storagePath) {
      await stopAmbient();
      return;
    }
    await loadAmbient(sound.storagePath, bgVolume);
  }, [ambientId, bgVolume, loadAmbient, stopAmbient]);

  // Update volume on slider change while playing
  useEffect(() => {
    const s = ambientSoundRef.current;
    if (!s) return;
    s.setVolumeAsync(bgVolume / 100).catch(() => {});
  }, [bgVolume]);

  useEffect(() => {
    return () => {
      clearTimerInterval();
      ambientTokenRef.current += 1;
      const s = ambientSoundRef.current;
      ambientSoundRef.current = null;
      s?.unloadAsync().catch(() => {});
      deactivateKeepAwake().catch(() => {});
    };
  }, [clearTimerInterval]);

  const completeSession = useCallback(
    (durationS: number) => {
      clearTimerInterval();
      setIsTimerActive(false);
      stopAmbient();
      deactivateKeepAwake().catch(() => {});
      if (durationS < 60) {
        showToast("Meditate for at least 1 minute to log", { variant: "error" });
        return;
      }
      setPendingDurationS(durationS);
      const tb = checkinRef.current.tensionBefore;
      const sb = checkinRef.current.stressBefore;
      createSession.mutate({
        durationS,
        ...(tb != null ? { tensionBefore: tb } : {}),
        ...(sb != null ? { stressBefore: sb } : {}),
      });
    },
    [clearTimerInterval, createSession, showToast, stopAmbient],
  );

  const beginTimer = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    clearTimerInterval();
    setElapsed(0);
    setIsTimerActive(true);
    activateKeepAwakeAsync().catch(() => {});
    startAmbient();

    intervalRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= selectedDuration) {
          clearTimerInterval();
          setIsTimerActive(false);
          stopAmbient();
          deactivateKeepAwake().catch(() => {});
          setPendingDurationS(selectedDuration);
          const tb = checkinRef.current.tensionBefore;
          const sb = checkinRef.current.stressBefore;
          createSession.mutate({
            durationS: selectedDuration,
            ...(tb != null ? { tensionBefore: tb } : {}),
            ...(sb != null ? { stressBefore: sb } : {}),
          });
          return selectedDuration;
        }
        return next;
      });
    }, 1000);
  }, [
    clearTimerInterval,
    createSession,
    selectedDuration,
    startAmbient,
    stopAmbient,
  ]);

  const handleStart = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    setPreCheckinOpen(true);
  }, []);

  const handlePause = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    clearTimerInterval();
    setIsTimerActive(false);
    ambientSoundRef.current?.pauseAsync().catch(() => {});
  }, [clearTimerInterval]);

  const handleResume = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    clearTimerInterval();
    setIsTimerActive(true);
    ambientSoundRef.current?.playAsync().catch(() => {});
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= selectedDuration) {
          clearTimerInterval();
          setIsTimerActive(false);
          stopAmbient();
          deactivateKeepAwake().catch(() => {});
          setPendingDurationS(selectedDuration);
          const tb = checkinRef.current.tensionBefore;
          const sb = checkinRef.current.stressBefore;
          createSession.mutate({
            durationS: selectedDuration,
            ...(tb != null ? { tensionBefore: tb } : {}),
            ...(sb != null ? { stressBefore: sb } : {}),
          });
          return selectedDuration;
        }
        return next;
      });
    }, 1000);
  }, [clearTimerInterval, createSession, selectedDuration, stopAmbient]);

  const handleStop = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    completeSession(elapsed);
    setElapsed(0);
  }, [completeSession, elapsed]);

  const handleAmbientSelect = useCallback(
    (sound: AmbientSound) => {
      if (Platform.OS !== "web") {
        Haptics.selectionAsync();
      }
      const idx = AMBIENT_SOUNDS.findIndex((s) => s.id === sound.id);
      if (!plan.isPro && idx > 0) {
        setAmbientUpgradeOpen(true);
        return;
      }
      setAmbientId(sound.id);
      // If actively playing, restart with new sound
      if (isTimerActive) {
        if (sound.storagePath) {
          loadAmbient(sound.storagePath, bgVolume);
        } else {
          stopAmbient();
        }
      }
    },
    [bgVolume, isTimerActive, loadAmbient, stopAmbient],
  );

  const handleRateRecent = useCallback(
    (sessionId: string, rating: number) => {
      if (!plan.isPro) {
        setAmbientUpgradeOpen(true);
        return;
      }
      if (Platform.OS !== "web") {
        Haptics.selectionAsync();
      }
      updateRating.mutate({ id: sessionId, rating });
    },
    [updateRating, plan.isPro],
  );

  const handleRefresh = useCallback(() => {
    sessionsQuery.refetch();
    generatedQuery.refetch();
  }, [generatedQuery, sessionsQuery]);

  const remaining = Math.max(0, selectedDuration - elapsed);
  const progress = selectedDuration > 0 ? elapsed / selectedDuration : 0;

  const sessions: MeditationSession[] = sessionsQuery.data ?? [];
  const generated: GeneratedMeditation[] = generatedQuery.data ?? [];

  const isPreview =
    isPreviewAuthError(sessionsQuery.error) ||
    isPreviewAuthError(generatedQuery.error);

  if (isPreview) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <PreviewEmptyState screenName="Meditation" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          onPress={() => {
            if (Platform.OS !== "web") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            openDrawer();
          }}
          style={({ pressed }) => [
            styles.menuButton,
            pressed && { opacity: 0.6 },
          ]}
        >
          <MenuIcon size={22} color={Colors.dark} />
        </Pressable>
        <Text style={styles.title}>Meditation</Text>
        <View style={styles.menuButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={sessionsQuery.isFetching || generatedQuery.isFetching}
            onRefresh={handleRefresh}
            tintColor={Colors.gold}
          />
        }
      >
        <DailyMindfulnessCheckin />
        {/* Quick Start Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="clock" size={18} color={Colors.gold} />
            <Text style={styles.cardTitle}>Quick Start</Text>
          </View>

          <View style={styles.presetRow}>
            {DURATION_PRESETS.map((preset) => {
              const isSelected = selectedDuration === preset.seconds;
              return (
                <Pressable
                  key={preset.seconds}
                  onPress={() => {
                    if (isTimerActive) return;
                    if (Platform.OS !== "web") {
                      Haptics.selectionAsync();
                    }
                    setSelectedDuration(preset.seconds);
                  }}
                  disabled={isTimerActive}
                  style={({ pressed }) => [
                    styles.presetButton,
                    isSelected && styles.presetButtonSelected,
                    isTimerActive && !isSelected && { opacity: 0.4 },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={[
                      styles.presetText,
                      isSelected && styles.presetTextSelected,
                    ]}
                  >
                    {preset.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Timer */}
          <View style={styles.timerArea}>
            <Text style={styles.timerText}>{formatTime(remaining)}</Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, progress * 100)}%` },
                ]}
              />
            </View>

            <View style={styles.controlsRow}>
              {!isTimerActive && elapsed === 0 && (
                <Pressable
                  onPress={handleStart}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Feather name="play" size={18} color={Colors.dark} />
                  <Text style={styles.primaryButtonText}>Start</Text>
                </Pressable>
              )}

              {isTimerActive && (
                <Pressable
                  onPress={handlePause}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Feather name="pause" size={18} color={Colors.dark} />
                  <Text style={styles.secondaryButtonText}>Pause</Text>
                </Pressable>
              )}

              {!isTimerActive && elapsed > 0 && (
                <Pressable
                  onPress={handleResume}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Feather name="play" size={18} color={Colors.dark} />
                  <Text style={styles.primaryButtonText}>Resume</Text>
                </Pressable>
              )}

              {(isTimerActive || elapsed > 0) && (
                <Pressable
                  onPress={handleStop}
                  style={({ pressed }) => [
                    styles.dangerButton,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Feather name="square" size={18} color={Colors.error} />
                  <Text style={styles.dangerButtonText}>Stop</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>

        {/* Ambient Sound Selector */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="music" size={18} color={Colors.gold} />
            <Text style={styles.cardTitle}>Ambient Sound</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.ambientRow}
          >
            {AMBIENT_SOUNDS.map((sound) => {
              const isSelected = ambientId === sound.id;
              return (
                <Pressable
                  key={sound.id}
                  onPress={() => handleAmbientSelect(sound)}
                  style={({ pressed }) => [
                    styles.ambientChip,
                    isSelected && styles.ambientChipSelected,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Feather
                    name={sound.icon}
                    size={18}
                    color={isSelected ? Colors.gold : Colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.ambientChipText,
                      isSelected && styles.ambientChipTextSelected,
                    ]}
                  >
                    {sound.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {ambientId !== "none" && (
            <View style={styles.volumeArea}>
              <View style={styles.volumeLabelRow}>
                <Feather name="volume-2" size={14} color={Colors.textSecondary} />
                <Text style={styles.volumeLabel}>Volume</Text>
                <Text style={styles.volumeValue}>{bgVolume}%</Text>
              </View>
              <View style={styles.volumeSliderTrack}>
                <View
                  style={[
                    styles.volumeSliderFill,
                    { width: `${bgVolume}%` },
                  ]}
                />
                <View style={styles.volumeButtons}>
                  {[0, 25, 50, 75, 100].map((v) => (
                    <Pressable
                      key={v}
                      onPress={() => {
                        if (Platform.OS !== "web") Haptics.selectionAsync();
                        setBgVolume(v);
                      }}
                      style={styles.volumeStop}
                      hitSlop={12}
                    >
                      <View
                        style={[
                          styles.volumeStopDot,
                          bgVolume >= v && { backgroundColor: Colors.gold },
                        ]}
                      />
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>

        {/* My Meditations (AI-generated) */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="headphones" size={18} color={Colors.gold} />
            <Text style={styles.cardTitle}>My Meditations</Text>
            {generated.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{generated.length}</Text>
              </View>
            )}
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                setGenerateDialogOpen(true);
              }}
              style={({ pressed }) => [
                styles.generateBtn,
                pressed && { opacity: 0.85 },
              ]}
              hitSlop={6}
            >
              <Feather name="zap" size={13} color={Colors.dark} />
              <Text style={styles.generateBtnText}>Generate</Text>
            </Pressable>
          </View>

          {generatedQuery.isLoading ? (
            <ActivityIndicator color={Colors.gold} style={{ marginVertical: 16 }} />
          ) : generated.length === 0 ? (
            <Text style={styles.emptyInline}>
              No generated meditations yet. Tap Generate to create your first one.
            </Text>
          ) : (
            <View style={{ gap: 8 }}>
              {generated.slice(0, 5).map((m) => (
                <View key={m.id} style={styles.generatedRow}>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>{m.meditationType}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.generatedMeta}>
                      {Math.round(m.durationS / 60)} min ·{" "}
                      {formatDateShort(m.generatedAt)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      showToast("Open the web app to play this session");
                    }}
                    style={({ pressed }) => [
                      styles.iconButton,
                      pressed && { opacity: 0.6 },
                    ]}
                    hitSlop={8}
                  >
                    <Feather name="play" size={18} color={Colors.gold} />
                  </Pressable>
                  <Pressable
                    onPress={() => deleteGenerated.mutate(m.id)}
                    disabled={deleteGenerated.isPending}
                    style={({ pressed }) => [
                      styles.iconButton,
                      pressed && { opacity: 0.6 },
                    ]}
                    hitSlop={8}
                  >
                    <Feather
                      name="trash-2"
                      size={16}
                      color={Colors.textSecondary}
                    />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Recent Sessions */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="activity" size={18} color={Colors.gold} />
            <Text style={styles.cardTitle}>Recent Sessions</Text>
          </View>

          {sessionsQuery.isLoading ? (
            <ActivityIndicator color={Colors.gold} style={{ marginVertical: 16 }} />
          ) : sessions.length === 0 ? (
            <Text style={styles.emptyInline}>
              Your completed sessions will show up here.
            </Text>
          ) : (
            <View style={{ gap: 10 }}>
              {sessions.slice(0, 8).map((s) => {
                const start = s.startedAt ? new Date(s.startedAt) : null;
                const end = s.endedAt ? new Date(s.endedAt) : null;
                const durationS =
                  start && end
                    ? Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
                    : 0;
                const minutes = Math.max(1, Math.round(durationS / 60));
                return (
                  <View key={s.id} style={styles.sessionRow}>
                    <View style={styles.sessionIconWrap}>
                      <Feather name="clock" size={16} color={Colors.gold} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sessionTitle}>
                        {s.meditationType || "Meditation"} · {minutes} min
                      </Text>
                      <Text style={styles.sessionMeta}>
                        {start ? formatDateShort(start.toISOString()) : ""}
                      </Text>
                    </View>
                    <View style={styles.starRow}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Pressable
                          key={n}
                          onPress={() => handleRateRecent(s.id, n)}
                          hitSlop={4}
                          style={styles.starButton}
                        >
                          <Feather
                            name="star"
                            size={14}
                            color={
                              (s.rating ?? 0) >= n
                                ? Colors.gold
                                : Colors.textTertiary
                            }
                          />
                        </Pressable>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <GenerateSessionDialog
        visible={generateDialogOpen}
        onClose={() => setGenerateDialogOpen(false)}
      />

      <Modal
        transparent
        visible={ambientUpgradeOpen}
        animationType="fade"
        onRequestClose={() => setAmbientUpgradeOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { padding: 0, overflow: "hidden" }]}>
            <UpgradePrompt
              variant="full"
              feature="premium_ambient"
              message="Additional ambient soundscapes are a Pro feature. Upgrade to unlock all sounds."
              onSuccess={() => setAmbientUpgradeOpen(false)}
            />
            <Pressable
              onPress={() => setAmbientUpgradeOpen(false)}
              style={({ pressed }) => [
                { paddingVertical: 12, alignItems: "center" },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text
                style={{
                  color: Colors.textSecondary,
                  fontFamily: "Inter_500Medium",
                }}
              >
                Not now
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <PreSessionCheckin
        visible={preCheckinOpen}
        onCancel={() => setPreCheckinOpen(false)}
        onComplete={({ tensionBefore: tb, stressBefore: sb }) => {
          checkinRef.current = { tensionBefore: tb, stressBefore: sb };
          setTensionBefore(tb);
          setStressBefore(sb);
          setPreCheckinOpen(false);
          beginTimer();
        }}
      />

      <PostSessionReview
        visible={postReviewOpen && !!reviewSessionId}
        durationS={pendingDurationS}
        tensionBefore={tensionBefore}
        stressBefore={stressBefore}
        isSaving={updateReview.isPending}
        onSkip={() => {
          setPostReviewOpen(false);
          setReviewSessionId(null);
          setTensionBefore(null);
          setStressBefore(null);
          checkinRef.current = { tensionBefore: null, stressBefore: null };
        }}
        onComplete={(metrics) => {
          if (!reviewSessionId) return;
          updateReview.mutate({ id: reviewSessionId, metrics });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
    textAlign: "center",
  },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    paddingTop: 12,
    gap: 16,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  countBadge: {
    backgroundColor: Colors.goldLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: "center",
  },
  countBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.goldDark,
  },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: Colors.gold,
  },
  generateBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  presetRow: {
    flexDirection: "row",
    gap: 10,
  },
  presetButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  presetButtonSelected: {
    borderColor: Colors.gold,
    backgroundColor: Colors.goldLight,
  },
  presetText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  presetTextSelected: {
    color: Colors.dark,
  },
  timerArea: {
    alignItems: "center",
    gap: 16,
    paddingVertical: 8,
  },
  timerText: {
    fontSize: 56,
    fontFamily: "Inter_300Light",
    color: Colors.dark,
    fontVariant: ["tabular-nums"],
  },
  progressTrack: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.cardBorder,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.gold,
    borderRadius: 3,
  },
  controlsRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.gold,
  },
  primaryButtonText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  dangerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
  },
  dangerButtonText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.error,
  },
  ambientRow: {
    gap: 8,
    paddingVertical: 4,
  },
  ambientChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.background,
    alignItems: "center",
    gap: 4,
    minWidth: 72,
  },
  ambientChipSelected: {
    borderColor: Colors.gold,
    backgroundColor: Colors.goldLight,
  },
  ambientChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  ambientChipTextSelected: {
    color: Colors.dark,
  },
  volumeArea: {
    gap: 8,
    paddingTop: 4,
  },
  volumeLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  volumeLabel: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  volumeValue: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  volumeSliderTrack: {
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.cardBorder,
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  volumeSliderFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.goldLight,
  },
  volumeButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 8,
    height: "100%",
  },
  volumeStop: {
    padding: 6,
  },
  volumeStopDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textTertiary,
  },
  generatedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: Colors.background,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
  },
  typeBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.dark,
  },
  generatedMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyInline: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    paddingVertical: 12,
    lineHeight: 18,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  sessionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.goldLight,
    alignItems: "center",
    justifyContent: "center",
  },
  sessionTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  sessionMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  starRow: {
    flexDirection: "row",
    gap: 2,
  },
  starButton: {
    padding: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  modalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.goldLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  modalStarRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  modalStarButton: {
    padding: 4,
  },
  modalSkipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  modalSkipText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
});
