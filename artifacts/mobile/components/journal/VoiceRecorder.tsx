import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Colors from "@/constants/colors";
import { useToast } from "@/contexts/ToastContext";
import { api, ApiError } from "@/lib/api";

interface VoiceRecorderProps {
  entryId: string | null;
  disabled?: boolean;
  onTranscribed: (text: string) => void;
  onRequireSaveFirst: () => Promise<string | null>;
}

function fmt(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

async function uploadToSignedUrl(signedUrl: string, uri: string, mime: string): Promise<number> {
  const res = await fetch(uri);
  const blob = await res.blob();
  const put = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": mime },
    body: blob,
  });
  if (!put.ok) {
    throw new Error(`Upload failed (${put.status})`);
  }
  return blob.size;
}

export default function VoiceRecorder({
  entryId,
  disabled,
  onTranscribed,
  onRequireSaveFirst,
}: VoiceRecorderProps) {
  const { showError, showSuccess, showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<"idle" | "recording">("idle");
  const [inFlight, setInFlight] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTick();
      recording?.stopAndUnloadAsync().catch(() => {});
    };
  }, [clearTick, recording]);

  const handleStart = useCallback(async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        showError("Microphone permission is needed to record voice notes.");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      await rec.startAsync();
      setRecording(rec);
      setPhase("recording");
      setElapsed(0);
      startTimeRef.current = Date.now();
      clearTick();
      tickRef.current = setInterval(() => {
        setElapsed(Date.now() - startTimeRef.current);
      }, 250);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't start recording.";
      showError(msg);
      setPhase("idle");
    }
  }, [clearTick, showError]);

  const processInBackground = useCallback(
    async (uri: string) => {
      setInFlight(true);
      try {
        let id = entryId;
        if (!id) {
          id = await onRequireSaveFirst();
          if (!id) {
            return;
          }
        }
        const mime = Platform.OS === "ios" ? "audio/m4a" : "audio/m4a";
        const { path, signedUrl } = await api.requestJournalMediaUpload(id, mime);
        const bytes = await uploadToSignedUrl(signedUrl, uri, mime);
        const confirmed = await api.confirmJournalMedia(id, {
          path,
          mime,
          bytes,
        });

        const result = await api.transcribeJournalAudio(id, confirmed.id);
        if (result.status === "complete" && result.text) {
          onTranscribed(result.text);
          showSuccess("Voice transcribed");
        } else if (result.status === "pending") {
          showToast("Transcription started — refresh shortly.");
        } else {
          showError("Couldn't transcribe audio.");
        }
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Voice note failed.";
        showError(msg);
      } finally {
        setInFlight(false);
      }
    },
    [entryId, onRequireSaveFirst, onTranscribed, showError, showSuccess, showToast],
  );

  const handleStop = useCallback(async () => {
    if (!recording) return;
    clearTick();
    let uri: string | null = null;
    try {
      await recording.stopAndUnloadAsync();
      uri = recording.getURI();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't stop recording.";
      showError(msg);
      setPhase("idle");
      setRecording(null);
      setOpen(false);
      setElapsed(0);
      return;
    }
    setRecording(null);
    setPhase("idle");
    setElapsed(0);
    setOpen(false);

    if (!uri) {
      showError("Recording produced no audio.");
      return;
    }

    showToast("Transcribing voice note…");
    void processInBackground(uri);
  }, [recording, clearTick, showError, showToast, processInBackground]);

  const handleCancel = useCallback(async () => {
    clearTick();
    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
      } catch {}
      setRecording(null);
    }
    setPhase("idle");
    setElapsed(0);
    setOpen(false);
  }, [recording, clearTick]);

  const triggerOpen = useCallback(() => {
    if (inFlight) return;
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setOpen(true);
  }, [inFlight]);

  const micDisabled = !!disabled || inFlight;

  return (
    <>
      <View style={styles.toolbarGroup}>
        <Pressable
          onPress={triggerOpen}
          disabled={micDisabled}
          accessibilityLabel={inFlight ? "Transcribing previous recording" : "Record voice note"}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.toolbarBtn,
            micDisabled && styles.toolbarBtnDisabled,
            pressed && !micDisabled && { opacity: 0.7 },
          ]}
          hitSlop={6}
        >
          <Feather
            name="mic"
            size={14}
            color={micDisabled ? Colors.textTertiary : Colors.goldDark}
          />
          <Text
            style={[
              styles.toolbarBtnText,
              micDisabled && { color: Colors.textTertiary },
            ]}
          >
            Voice
          </Text>
        </Pressable>
        {inFlight ? (
          <Text style={styles.inFlightText}>
            Transcribing previous recording…
          </Text>
        ) : null}
      </View>

      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={handleCancel}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Feather
                name="mic"
                size={28}
                color={phase === "recording" ? Colors.error : Colors.gold}
              />
            </View>
            <Text style={styles.title}>
              {phase === "idle" ? "Voice note" : "Recording…"}
            </Text>
            <Text style={styles.subtitle}>
              {phase === "idle"
                ? "Tap record. Whisper will transcribe and append to your entry."
                : fmt(elapsed)}
            </Text>

            <View style={styles.actions}>
              <Pressable
                onPress={handleCancel}
                style={({ pressed }) => [
                  styles.btnSecondary,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </Pressable>
              {phase === "idle" ? (
                <Pressable
                  onPress={handleStart}
                  style={({ pressed }) => [
                    styles.btnPrimary,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Feather name="mic" size={16} color={Colors.dark} />
                  <Text style={styles.btnPrimaryText}>Record</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={handleStop}
                  style={({ pressed }) => [
                    styles.btnPrimary,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Feather name="square" size={16} color={Colors.dark} />
                  <Text style={styles.btnPrimaryText}>Stop & transcribe</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  toolbarGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  toolbarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.goldLight,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  toolbarBtnDisabled: {
    backgroundColor: Colors.background,
    borderColor: Colors.cardBorder,
    opacity: 0.6,
  },
  toolbarBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.goldDark,
  },
  inFlightText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    fontStyle: "italic",
    flexShrink: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 22,
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.goldLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
    fontVariant: ["tabular-nums"],
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  btnSecondary: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.background,
  },
  btnSecondaryText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.gold,
  },
  btnPrimaryText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
  },
});
