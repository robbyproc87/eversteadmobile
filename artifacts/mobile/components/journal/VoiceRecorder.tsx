import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
  const { showError, showSuccess } = useToast();
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<"idle" | "recording" | "uploading" | "transcribing">("idle");
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
      return;
    }
    setRecording(null);

    if (!uri) {
      showError("Recording produced no audio.");
      setPhase("idle");
      return;
    }

    try {
      setPhase("uploading");
      let id = entryId;
      if (!id) {
        id = await onRequireSaveFirst();
        if (!id) {
          setPhase("idle");
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

      setPhase("transcribing");
      const result = await api.transcribeJournalAudio(id, confirmed.id);
      if (result.status === "complete" && result.text) {
        onTranscribed(result.text);
        showSuccess("Voice transcribed");
      } else if (result.status === "pending") {
        showSuccess("Transcription started — refresh shortly.");
      } else {
        showError("Couldn't transcribe audio.");
      }
      setOpen(false);
      setPhase("idle");
      setElapsed(0);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Voice note failed.";
      showError(msg);
      setPhase("idle");
    }
  }, [recording, entryId, clearTick, showError, showSuccess, onTranscribed, onRequireSaveFirst]);

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
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setOpen(true);
  }, []);

  return (
    <>
      <Pressable
        onPress={triggerOpen}
        disabled={disabled}
        accessibilityLabel="Record voice note"
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.toolbarBtn,
          disabled && { opacity: 0.5 },
          pressed && !disabled && { opacity: 0.7 },
        ]}
        hitSlop={6}
      >
        <Feather name="mic" size={14} color={Colors.goldDark} />
        <Text style={styles.toolbarBtnText}>Voice</Text>
      </Pressable>

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
                name={phase === "recording" ? "mic" : phase === "idle" ? "mic" : "loader"}
                size={28}
                color={phase === "recording" ? Colors.error : Colors.gold}
              />
            </View>
            <Text style={styles.title}>
              {phase === "idle" && "Voice note"}
              {phase === "recording" && "Recording…"}
              {phase === "uploading" && "Uploading…"}
              {phase === "transcribing" && "Transcribing…"}
            </Text>
            <Text style={styles.subtitle}>
              {phase === "idle" && "Tap record. Whisper will transcribe and append to your entry."}
              {phase === "recording" && fmt(elapsed)}
              {phase === "uploading" && "Sending audio to the server."}
              {phase === "transcribing" && "AI is converting your voice to text."}
            </Text>

            {phase === "uploading" || phase === "transcribing" ? (
              <ActivityIndicator color={Colors.gold} size="large" style={{ marginVertical: 10 }} />
            ) : null}

            <View style={styles.actions}>
              <Pressable
                onPress={handleCancel}
                disabled={phase === "uploading" || phase === "transcribing"}
                style={({ pressed }) => [
                  styles.btnSecondary,
                  (phase === "uploading" || phase === "transcribing") && { opacity: 0.4 },
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
              ) : phase === "recording" ? (
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
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
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
  toolbarBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.goldDark,
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
