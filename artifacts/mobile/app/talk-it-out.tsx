import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthGuard } from "@/components/AuthGuard";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import Colors from "@/constants/colors";
import { useToast } from "@/contexts/ToastContext";
import { api, isPaymentRequiredError } from "@/lib/api";

// Talk It Out: speak for a minute or two, get the words back as a
// journal entry, and get one sharp reflection from Sage in return.

type Phase =
  | { name: "idle" }
  | { name: "recording" }
  | { name: "processing"; label: string }
  | {
      name: "done";
      entryId: string;
      transcript: string;
      reflection: string | null;
    }
  | { name: "locked" }
  | { name: "error"; message: string };

function fmt(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

async function uploadToSignedUrl(
  signedUrl: string,
  uri: string,
  mime: string,
): Promise<number> {
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

export default function TalkItOutScreen() {
  return (
    <AuthGuard>
      <TalkItOutContent />
    </AuthGuard>
  );
}

function TalkItOutContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showError } = useToast();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [elapsed, setElapsed] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTick();
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, [clearTick]);

  const startRecording = useCallback(async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        showError("Microphone permission is needed to talk it out.");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      recordingRef.current = rec;
      startRef.current = Date.now();
      setElapsed(0);
      clearTick();
      tickRef.current = setInterval(() => {
        setElapsed(Date.now() - startRef.current);
      }, 250);
      setPhase({ name: "recording" });
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (e) {
      showError(e instanceof Error ? e.message : "Couldn't start recording.");
    }
  }, [clearTick, showError]);

  const stopAndProcess = useCallback(async () => {
    const rec = recordingRef.current;
    if (!rec) return;
    clearTick();
    recordingRef.current = null;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    let uri: string | null = null;
    try {
      await rec.stopAndUnloadAsync();
      uri = rec.getURI();
    } catch (e) {
      setPhase({
        name: "error",
        message: e instanceof Error ? e.message : "Recording failed.",
      });
      return;
    }
    if (!uri) {
      setPhase({ name: "error", message: "Recording produced no audio." });
      return;
    }

    try {
      setPhase({ name: "processing", label: "Saving your words…" });
      const entry = await api.createJournalEntry({
        title: "Talked it out",
        content: "",
        tags: ["voice"],
      });

      const mime = "audio/m4a";
      const { path, signedUrl } = await api.requestJournalMediaUpload(
        entry.id,
        mime,
      );
      const bytes = await uploadToSignedUrl(signedUrl, uri, mime);
      const confirmed = await api.confirmJournalMedia(entry.id, {
        path,
        mime,
        bytes,
      });

      setPhase({ name: "processing", label: "Listening back…" });
      const result = await api.transcribeJournalAudio(entry.id, confirmed.id);
      const transcript =
        result.status === "complete" && result.text ? result.text.trim() : "";

      if (transcript) {
        await api
          .updateJournalEntry(entry.id, {
            title: "Talked it out",
            content: transcript,
            contentPlainText: transcript,
            tags: ["voice"],
          })
          .catch(() => {
            // the audio is attached either way; transcript update is
            // best-effort
          });
      }
      queryClient.invalidateQueries({ queryKey: ["journal"] });

      if (!transcript) {
        setPhase({
          name: "done",
          entryId: entry.id,
          transcript: "",
          reflection: null,
        });
        return;
      }

      setPhase({ name: "processing", label: "Sage is thinking…" });
      let reflection: string | null = null;
      try {
        const res = await api.suggestTalkItOut(transcript);
        reflection = res?.suggestion?.trim() || null;
      } catch (e) {
        if (isPaymentRequiredError(e)) {
          setPhase({ name: "locked" });
          return;
        }
        reflection = null;
      }

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setPhase({ name: "done", entryId: entry.id, transcript, reflection });
    } catch (e) {
      if (isPaymentRequiredError(e)) {
        setPhase({ name: "locked" });
        return;
      }
      setPhase({
        name: "error",
        message:
          e instanceof Error ? e.message : "Something went wrong. Try again.",
      });
    }
  }, [clearTick, queryClient]);

  const isRecording = phase.name === "recording";

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
      ]}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Talk it out</Text>
          <Text style={styles.subtitle}>
            Say it like you'd say it on a walk. Sage listens.
          </Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          accessibilityLabel="Close"
        >
          <Feather name="x" size={24} color={Colors.textSecondary} />
        </Pressable>
      </View>

      {(phase.name === "idle" || phase.name === "recording") && (
        <View style={styles.recordArea}>
          <Pressable
            onPress={isRecording ? stopAndProcess : startRecording}
            style={({ pressed }) => [
              styles.micButton,
              isRecording && styles.micButtonActive,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityLabel={
              isRecording ? "Stop and transcribe" : "Start recording"
            }
          >
            <Feather
              name={isRecording ? "square" : "mic"}
              size={36}
              color={Colors.dark}
            />
          </Pressable>
          <Text style={styles.recordHint}>
            {isRecording ? fmt(elapsed) : "Tap to start"}
          </Text>
          {isRecording ? (
            <Text style={styles.recordSubHint}>Tap again when you're done</Text>
          ) : null}
        </View>
      )}

      {phase.name === "processing" && (
        <View style={styles.recordArea}>
          <ActivityIndicator size="large" color={Colors.gold} />
          <Text style={styles.recordHint}>{phase.label}</Text>
        </View>
      )}

      {phase.name === "locked" && (
        <ScrollView contentContainerStyle={styles.resultScroll}>
          <UpgradePrompt
            feature="ai_coaching"
            message="Voice reflections with Sage are part of Everstead Pro."
          />
        </ScrollView>
      )}

      {phase.name === "error" && (
        <View style={styles.recordArea}>
          <Feather name="alert-circle" size={28} color={Colors.error} />
          <Text style={styles.recordHint}>{phase.message}</Text>
          <Pressable
            onPress={() => setPhase({ name: "idle" })}
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.secondaryBtnText}>Try again</Text>
          </Pressable>
        </View>
      )}

      {phase.name === "done" && (
        <ScrollView
          contentContainerStyle={styles.resultScroll}
          showsVerticalScrollIndicator={false}
        >
          {phase.reflection ? (
            <View style={styles.sageCard}>
              <View style={styles.sageHeader}>
                <Feather name="feather" size={16} color={Colors.gold} />
                <Text style={styles.sageLabel}>Sage</Text>
              </View>
              <Text style={styles.sageText}>{phase.reflection}</Text>
            </View>
          ) : null}

          {phase.transcript ? (
            <View style={styles.transcriptCard}>
              <Text style={styles.transcriptLabel}>What you said</Text>
              <Text style={styles.transcriptText}>{phase.transcript}</Text>
            </View>
          ) : (
            <View style={styles.transcriptCard}>
              <Text style={styles.transcriptText}>
                The recording is saved to your journal. Transcription is still
                working - check back there shortly.
              </Text>
            </View>
          )}

          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync();
              router.replace({
                pathname: "/journal-entry",
                params: { id: phase.entryId },
              } as never);
            }}
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Feather name="book-open" size={14} color={Colors.goldDark} />
            <Text style={styles.secondaryBtnText}>Open in Journal</Text>
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.primaryBtnText}>Done</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  recordArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingBottom: 60,
  },
  micButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.gold,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.gold,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  micButtonActive: {
    backgroundColor: "#e85d5d",
    shadowColor: "#e85d5d",
  },
  recordHint: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  recordSubHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  resultScroll: {
    gap: 14,
    paddingBottom: 32,
  },
  sageCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.gold,
    borderRadius: 16,
    padding: 18,
    gap: 10,
  },
  sageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sageLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.goldDark,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sageText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: Colors.dark,
    lineHeight: 24,
  },
  transcriptCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  transcriptLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  transcriptText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    lineHeight: 21,
  },
  primaryBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.goldDark,
  },
});
