import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { SageChatPanel } from "@/components/life-architecture/SageChatPanel";
import { SectionForm } from "@/components/life-architecture/SectionForm";
import Colors from "@/constants/colors";
import { useToast } from "@/contexts/ToastContext";
import {
  ApiError,
  EMPTY_LIFE_ARCHITECTURE,
  lifeArchitectureApi,
  type LifeArchitectureData,
  type LifeArchitectureSnapshot,
} from "@/lib/api";
import {
  getSection,
  isSectionComplete,
  nextSection,
  type SectionId,
} from "@/lib/life-architecture";

type ViewMode = "chat" | "edit";

export default function LifeArchitectureSectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const params = useLocalSearchParams<{ sectionId?: string }>();

  const sectionId = (params.sectionId as SectionId) || "foundation";
  const section = getSection(sectionId);
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const [mode, setMode] = useState<ViewMode>("chat");
  const [draft, setDraft] = useState<LifeArchitectureData | null>(null);
  const [dirty, setDirty] = useState(false);

  const snapshotQuery = useQuery<LifeArchitectureSnapshot | null>({
    queryKey: ["life-architecture"],
    queryFn: () => lifeArchitectureApi.get(),
  });

  const baseData: LifeArchitectureData = useMemo(() => {
    const s = snapshotQuery.data;
    if (!s) return EMPTY_LIFE_ARCHITECTURE;
    return {
      foundation: s.foundation ?? EMPTY_LIFE_ARCHITECTURE.foundation,
      pillars: s.pillars ?? [],
      blueprints: s.blueprints ?? [],
      rituals: s.rituals ?? [],
      guardrails: s.guardrails ?? [],
      vision: s.vision ?? EMPTY_LIFE_ARCHITECTURE.vision,
    };
  }, [snapshotQuery.data]);

  // Initialize draft from server data once.
  useEffect(() => {
    if (snapshotQuery.isLoading) return;
    if (draft === null) {
      setDraft(baseData);
    }
  }, [snapshotQuery.isLoading, baseData, draft]);

  const saveMutation = useMutation({
    mutationFn: (data: LifeArchitectureData) => lifeArchitectureApi.save(data),
    onSuccess: (snap) => {
      queryClient.setQueryData(["life-architecture"], snap);
      queryClient.invalidateQueries({ queryKey: ["life-architecture"] });
      showToast(`${section.label} saved`, { variant: "success" });
      setDirty(false);
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : "Couldn't save. Please retry.";
      showToast(msg, { variant: "error" });
    },
  });

  const handleChange = useCallback((next: LifeArchitectureData) => {
    setDraft(next);
    setDirty(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!draft) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    saveMutation.mutate(draft);
  }, [draft, saveMutation]);

  const handleSaveAndNext = useCallback(async () => {
    if (!draft) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    try {
      await saveMutation.mutateAsync(draft);
      const next = nextSection(sectionId);
      if (next) {
        router.replace({
          pathname: "/life-architecture-section",
          params: { sectionId: next },
        } as never);
      } else {
        router.back();
      }
    } catch {
      // toast already shown
    }
  }, [draft, saveMutation, sectionId, router]);

  const handleClose = useCallback(() => {
    if (dirty) {
      Alert.alert(
        "Unsaved changes",
        "You have unsaved edits. Discard them?",
        [
          { text: "Keep editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => router.back(),
          },
        ],
      );
      return;
    }
    router.back();
  }, [dirty, router]);

  const upgradeRequired =
    snapshotQuery.error instanceof ApiError &&
    snapshotQuery.error.status === 402;

  if (snapshotQuery.isLoading || !draft) {
    return (
      <AuthGuard>
        <View
          style={[
            styles.center,
            { paddingTop: insets.top + webTopInset, paddingBottom: insets.bottom },
          ]}
        >
          <ActivityIndicator color={section.color} />
        </View>
      </AuthGuard>
    );
  }

  if (upgradeRequired) {
    return (
      <AuthGuard>
        <View
          style={[
            styles.center,
            { paddingTop: insets.top + webTopInset, paddingBottom: insets.bottom },
          ]}
        >
          <View style={{ width: "100%", maxWidth: 480 }}>
            <UpgradePrompt
              variant="full"
              feature="life_architecture"
              message="Life Architecture is a Pro feature. Upgrade to begin shaping your year."
            />
          </View>
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              styles.closeBtnLg,
              { marginTop: 16 },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.closeBtnText}>Close</Text>
          </Pressable>
        </View>
      </AuthGuard>
    );
  }

  const complete = isSectionComplete(draft, sectionId);
  const next = nextSection(sectionId);

  return (
    <AuthGuard>
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + webTopInset,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <View style={[styles.header, { backgroundColor: section.bg }]}>
          <View style={styles.headerLeft}>
            <View
              style={[styles.headerIcon, { backgroundColor: section.color }]}
            >
              <Feather name={section.icon as never} size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: section.color }]}>
                {section.label}
              </Text>
              <Text style={styles.headerSubtitle}>{section.tagline}</Text>
            </View>
          </View>
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              styles.closeBtn,
              pressed && { opacity: 0.6 },
            ]}
            accessibilityLabel="Close section editor"
          >
            <Feather name="x" size={20} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.tabRow}>
          <TabButton
            label="Talk with Sage"
            icon="message-circle"
            active={mode === "chat"}
            color={section.color}
            onPress={() => setMode("chat")}
          />
          <TabButton
            label="Shape it"
            icon="edit-3"
            active={mode === "edit"}
            color={section.color}
            onPress={() => setMode("edit")}
          />
        </View>

        <KeyboardAvoidingView
          style={styles.flex1}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            style={styles.flex1}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {mode === "chat" ? (
              <>
                <Text style={styles.helperText}>
                  {section.metaphor}. {section.description}
                </Text>
                <SageChatPanel
                  key={section.id}
                  section={section}
                  onUpgradeRequired={() => {
                    showToast(
                      "Sage is a Pro feature — upgrade to continue.",
                      { variant: "error" },
                    );
                    router.replace("/settings" as never);
                  }}
                />
                <Pressable
                  onPress={() => setMode("edit")}
                  style={({ pressed }) => [
                    styles.linkRow,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Feather
                    name="arrow-right"
                    size={14}
                    color={section.color}
                  />
                  <Text style={[styles.linkText, { color: section.color }]}>
                    When you're ready, open "Shape it" to capture what came up.
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.helperText}>
                  Add or edit each item. Talk with Sage anytime if you get
                  stuck.
                </Text>
                <SectionForm
                  section={section}
                  data={draft}
                  onChange={handleChange}
                />
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.statusRow}>
              {complete ? (
                <View style={styles.statusBadge}>
                  <Feather name="check-circle" size={12} color={section.color} />
                  <Text style={[styles.statusText, { color: section.color }]}>
                    Section shaped
                  </Text>
                </View>
              ) : (
                <Text style={styles.statusMuted}>Not shaped yet</Text>
              )}
              {dirty && (
                <Text style={styles.dirtyText}>Unsaved changes</Text>
              )}
            </View>
            <View style={styles.btnRow}>
              <Pressable
                onPress={handleSave}
                disabled={saveMutation.isPending || !dirty}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  (!dirty || saveMutation.isPending) && { opacity: 0.5 },
                  pressed && dirty && { opacity: 0.85 },
                ]}
              >
                {saveMutation.isPending ? (
                  <ActivityIndicator size="small" color={Colors.dark} />
                ) : (
                  <>
                    <Feather name="save" size={14} color={Colors.dark} />
                    <Text style={styles.secondaryText}>Save</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                onPress={handleSaveAndNext}
                disabled={saveMutation.isPending}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: section.color },
                  saveMutation.isPending && { opacity: 0.6 },
                  pressed && { opacity: 0.85 },
                ]}
              >
                {saveMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Text style={styles.primaryText}>
                      {next
                        ? `Save & continue to ${getSection(next).label}`
                        : "Save & finish"}
                    </Text>
                    <Feather name="arrow-right" size={14} color="#fff" />
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </AuthGuard>
  );
}

function TabButton({
  label,
  icon,
  active,
  color,
  onPress,
}: {
  label: string;
  icon: string;
  active: boolean;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tabBtn,
        active && {
          borderBottomColor: color,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Feather
        name={icon as never}
        size={14}
        color={active ? color : Colors.textSecondary}
      />
      <Text
        style={[
          styles.tabText,
          { color: active ? color : Colors.textSecondary },
          active && { fontFamily: "Inter_600SemiBold" },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex1: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
    padding: 24,
    gap: 16,
  },
  upgradeMsg: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  closeBtnLg: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: Colors.gold,
    borderRadius: 10,
  },
  closeBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  headerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 24,
  },
  helperText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    fontStyle: "italic",
    lineHeight: 17,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
  },
  linkText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    flex: 1,
    lineHeight: 17,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
    backgroundColor: Colors.card,
    gap: 10,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  statusMuted: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  dirtyText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.gold,
  },
  btnRow: {
    flexDirection: "row",
    gap: 8,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderRadius: 10,
  },
  secondaryText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});
