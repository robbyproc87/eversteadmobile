import { Feather } from "@expo/vector-icons";
import { Audio, type AVPlaybackStatus } from "expo-av";
import * as Haptics from "expo-haptics";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useQuery } from "@tanstack/react-query";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Colors from "@/constants/colors";
import {
  AMBIENT_SOUNDS,
  getAmbientSoundUrl,
} from "@/lib/ambient-sounds";
import { api, type GeneratedMeditationDetail } from "@/lib/api";

// Ambient bed sits well under the voice.
const BED_VOLUME = 0.35;

interface Props {
  meditationId: string | null;
  onClose: () => void;
  onComplete: (info: {
    durationS: number;
    meditationType: string;
    generatedMeditationId: string;
  }) => void;
}

function formatTime(ms: number): string {
  const totalS = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalS / 60);
  const s = totalS % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type ScriptSegment =
  | { kind: "text"; value: string }
  | { kind: "pause" }
  | { kind: "transition" };

// Script markup matches the web player: [PAUSE Ns] becomes a breathing
// ellipsis, [TRANSITION] becomes a divider.
function parseScript(script: string): ScriptSegment[] {
  const segments: ScriptSegment[] = [];
  for (const raw of script.split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^\[TRANSITION\]$/i.test(line)) {
      segments.push({ kind: "transition" });
      continue;
    }
    const withoutPauses = line.replace(/\[PAUSE\s*\d*s?\]/gi, "").trim();
    if (!withoutPauses && /\[PAUSE/i.test(line)) {
      segments.push({ kind: "pause" });
      continue;
    }
    if (withoutPauses) {
      segments.push({ kind: "text", value: withoutPauses });
      if (/\[PAUSE/i.test(line)) segments.push({ kind: "pause" });
    }
  }
  return segments;
}

export default function GeneratedMeditationPlayer({
  meditationId,
  onClose,
  onComplete,
}: Props) {
  const visible = meditationId != null;

  const detailQuery = useQuery<GeneratedMeditationDetail>({
    queryKey: ["meditation", "generated", meditationId],
    queryFn: () => api.getGeneratedMeditation(meditationId as string),
    enabled: visible,
    // The audioUrl is a 1-hour signed URL; don't reuse a stale one.
    staleTime: 30 * 60 * 1000,
    gcTime: 0,
  });
  const detail = detailQuery.data;

  const soundRef = useRef<Audio.Sound | null>(null);
  const tokenRef = useRef(0);
  const completedRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const barWidthRef = useRef(1);

  // Ambient bed mixed under the voice, matching the web player's
  // two-channel mixer.
  const [ambientId, setAmbientId] = useState("none");
  const bedRef = useRef<Audio.Sound | null>(null);
  const bedTokenRef = useRef(0);

  const stopBed = useCallback(async () => {
    bedTokenRef.current += 1;
    const bed = bedRef.current;
    bedRef.current = null;
    if (!bed) return;
    try {
      await bed.stopAsync();
    } catch {}
    try {
      await bed.unloadAsync();
    } catch {}
  }, []);

  const selectAmbient = useCallback(
    async (id: string, playNow: boolean) => {
      if (Platform.OS !== "web") Haptics.selectionAsync();
      setAmbientId(id);
      const token = ++bedTokenRef.current;
      const prev = bedRef.current;
      bedRef.current = null;
      if (prev) {
        try {
          await prev.stopAsync();
        } catch {}
        try {
          await prev.unloadAsync();
        } catch {}
      }
      const sound = AMBIENT_SOUNDS.find((s) => s.id === id);
      if (!sound?.storagePath) return;
      const url = getAmbientSoundUrl(sound.storagePath);
      if (!url) return;
      try {
        const { sound: bed } = await Audio.Sound.createAsync(
          { uri: url },
          { isLooping: true, volume: BED_VOLUME, shouldPlay: playNow },
        );
        if (token !== bedTokenRef.current) {
          try {
            await bed.unloadAsync();
          } catch {}
          return;
        }
        bedRef.current = bed;
      } catch {
        // ambient bed is best-effort
      }
    },
    [],
  );

  const teardown = useCallback(async () => {
    tokenRef.current += 1;
    const s = soundRef.current;
    soundRef.current = null;
    setIsPlaying(false);
    setIsLoaded(false);
    setPositionMs(0);
    setDurationMs(0);
    deactivateKeepAwake().catch(() => {});
    await stopBed();
    if (!s) return;
    try {
      await s.stopAsync();
    } catch {}
    try {
      await s.unloadAsync();
    } catch {}
  }, [stopBed]);

  // Keep the bed in lockstep with the voice.
  useEffect(() => {
    const bed = bedRef.current;
    if (!bed) return;
    if (isPlaying) {
      bed.playAsync().catch(() => {});
    } else {
      bed.pauseAsync().catch(() => {});
    }
  }, [isPlaying]);

  // Load the voice track whenever a fresh signed URL arrives.
  useEffect(() => {
    if (!visible || !detail?.audioUrl) return;
    const token = ++tokenRef.current;
    completedRef.current = false;
    setLoadError(false);
    let cancelled = false;

    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri: detail.audioUrl as string },
          { shouldPlay: true, progressUpdateIntervalMillis: 250 },
          (status: AVPlaybackStatus) => {
            if (!status.isLoaded) return;
            setIsLoaded(true);
            setIsPlaying(status.isPlaying);
            setPositionMs(status.positionMillis ?? 0);
            if (status.durationMillis) setDurationMs(status.durationMillis);
            if (status.didJustFinish && !completedRef.current) {
              completedRef.current = true;
              if (Platform.OS !== "web") {
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                ).catch(() => {});
              }
              const playedS = Math.round(
                (status.durationMillis ?? detail.durationS * 1000) / 1000,
              );
              onComplete({
                durationS: playedS,
                meditationType: detail.meditationType,
                generatedMeditationId: detail.id,
              });
            }
          },
        );
        if (token !== tokenRef.current || cancelled) {
          try {
            await sound.unloadAsync();
          } catch {}
          return;
        }
        soundRef.current = sound;
        activateKeepAwakeAsync().catch(() => {});
      } catch {
        if (token === tokenRef.current) setLoadError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, detail?.audioUrl]);

  // Full teardown when the sheet closes or unmounts.
  useEffect(() => {
    if (!visible) {
      teardown();
    }
    return () => {
      teardown();
    };
  }, [visible, teardown]);

  const togglePlayback = useCallback(() => {
    const s = soundRef.current;
    if (!s) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (isPlaying) {
      s.pauseAsync().catch(() => {});
    } else {
      s.playAsync().catch(() => {});
    }
  }, [isPlaying]);

  const handleSeek = useCallback(
    (locationX: number) => {
      const s = soundRef.current;
      if (!s || durationMs <= 0) return;
      const ratio = Math.min(1, Math.max(0, locationX / barWidthRef.current));
      s.setPositionAsync(Math.floor(ratio * durationMs)).catch(() => {});
    },
    [durationMs],
  );

  const handleClose = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    teardown();
    onClose();
  }, [teardown, onClose]);

  const progress = durationMs > 0 ? positionMs / durationMs : 0;
  const segments = detail?.scriptText ? parseScript(detail.scriptText) : [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{detail?.meditationType ?? "Meditation"}</Text>
            {detail ? (
              <Text style={styles.subtitle}>
                {Math.round(detail.durationS / 60)} min · in Sage's voice
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={handleClose}
            hitSlop={10}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            accessibilityLabel="Close player"
          >
            <Feather name="x" size={24} color={Colors.textSecondary} />
          </Pressable>
        </View>

        {detailQuery.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.gold} />
            <Text style={styles.loadingText}>Preparing your session…</Text>
          </View>
        ) : detailQuery.isError || !detail ? (
          <View style={styles.center}>
            <Feather name="alert-circle" size={28} color={Colors.error} />
            <Text style={styles.errorText}>
              Couldn't load this meditation. Close and try again.
            </Text>
          </View>
        ) : !detail.audioUrl || loadError ? (
          <View style={styles.center}>
            <Feather name="alert-circle" size={28} color={Colors.error} />
            <Text style={styles.errorText}>
              The audio for this session isn't available right now.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.playerArea}>
              <Pressable
                onPress={togglePlayback}
                disabled={!isLoaded}
                style={({ pressed }) => [
                  styles.playButton,
                  pressed && { opacity: 0.85 },
                  !isLoaded && { opacity: 0.5 },
                ]}
                accessibilityLabel={isPlaying ? "Pause" : "Play"}
              >
                {!isLoaded ? (
                  <ActivityIndicator color={Colors.dark} />
                ) : (
                  <Feather
                    name={isPlaying ? "pause" : "play"}
                    size={30}
                    color={Colors.dark}
                    style={!isPlaying && { marginLeft: 3 }}
                  />
                )}
              </Pressable>

              <Pressable
                style={styles.progressTrack}
                onLayout={(e) => {
                  barWidthRef.current = Math.max(
                    1,
                    e.nativeEvent.layout.width,
                  );
                }}
                onPress={(e) => handleSeek(e.nativeEvent.locationX)}
                accessibilityLabel="Seek"
              >
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(100, progress * 100)}%` },
                  ]}
                />
              </Pressable>

              <View style={styles.timeRow}>
                <Text style={styles.timeLabel}>{formatTime(positionMs)}</Text>
                <Text style={styles.timeLabel}>
                  -{formatTime(Math.max(0, durationMs - positionMs))}
                </Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.ambientRow}
                style={{ alignSelf: "stretch", flexGrow: 0 }}
              >
                {AMBIENT_SOUNDS.map((sound) => {
                  const selected = ambientId === sound.id;
                  return (
                    <Pressable
                      key={sound.id}
                      onPress={() => selectAmbient(sound.id, isPlaying)}
                      style={({ pressed }) => [
                        styles.ambientChip,
                        selected && styles.ambientChipSelected,
                        pressed && { opacity: 0.7 },
                      ]}
                      accessibilityLabel={`Ambient sound: ${sound.name}`}
                    >
                      <Feather
                        name={sound.icon}
                        size={14}
                        color={selected ? Colors.goldDark : Colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.ambientChipText,
                          selected && { color: Colors.goldDark },
                        ]}
                      >
                        {sound.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <ScrollView
              style={styles.scriptScroll}
              contentContainerStyle={styles.scriptContent}
              showsVerticalScrollIndicator={false}
            >
              {segments.map((seg, i) =>
                seg.kind === "transition" ? (
                  <View key={i} style={styles.transition} />
                ) : seg.kind === "pause" ? (
                  <Text key={i} style={styles.pauseDots}>
                    ⋯
                  </Text>
                ) : (
                  <Text key={i} style={styles.scriptText}>
                    {seg.value}
                  </Text>
                ),
              )}
            </ScrollView>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    marginBottom: 8,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  playerArea: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 16,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.gold,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.gold,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  progressTrack: {
    alignSelf: "stretch",
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.separator,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: Colors.gold,
  },
  timeRow: {
    alignSelf: "stretch",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  ambientRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  ambientChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
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
  timeLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  scriptScroll: {
    flex: 1,
    marginTop: 4,
  },
  scriptContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 14,
  },
  scriptText: {
    fontSize: 15,
    lineHeight: 24,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  pauseDots: {
    fontSize: 18,
    color: Colors.textTertiary,
    textAlign: "center",
  },
  transition: {
    height: 1,
    backgroundColor: Colors.separator,
    marginVertical: 6,
    alignSelf: "stretch",
  },
});
