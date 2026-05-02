import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useToast } from "@/contexts/ToastContext";
import {
  api,
  ApiError,
  getMoodOption,
  MOOD_OPTIONS,
  type InkStrokeData,
  type JournalEntry,
  type JournalEntryInput,
} from "@/lib/api";
import {
  InkPad,
  type InkPadHandles,
  type InkStroke,
  type ToolKind,
} from "@/components/journal/InkPad";

type EditorMode = "type" | "write";

const PEN_COLORS: Array<{ hex: string; label: string }> = [
  { hex: "#1a1a1a", label: "Black" },
  { hex: "#4B5563", label: "Gray" },
  { hex: "#1D4ED8", label: "Blue" },
  { hex: "#DC2626", label: "Red" },
  { hex: "#16A34A", label: "Green" },
  { hex: "#9333EA", label: "Purple" },
  { hex: "#F59E0B", label: "Amber" },
  { hex: "#DB2777", label: "Pink" },
];

const TOOL_DEFAULT_SIZE: Record<ToolKind, number> = {
  pen: 4,
  pencil: 2,
  highlighter: 6,
  eraser: 22,
};

function haptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS !== "web") Haptics.impactAsync(style);
}

function formatLongDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatLongTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

const LOCK_AGE_MS = 24 * 60 * 60 * 1000;

interface MoodPickerProps {
  value: string | null;
  onChange: (next: string | null) => void;
  disabled?: boolean;
}

function MoodPicker({ value, onChange, disabled }: MoodPickerProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.moodRow}
    >
      {MOOD_OPTIONS.map((m) => {
        const selected = value === m.value;
        return (
          <Pressable
            key={m.value}
            onPress={() => {
              if (disabled) return;
              haptic();
              onChange(selected ? null : m.value);
            }}
            disabled={disabled}
            style={({ pressed }) => [
              styles.moodChip,
              selected && {
                backgroundColor: `${m.color}1f`,
                borderColor: m.color,
              },
              disabled && { opacity: 0.5 },
              pressed && !disabled && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.moodChipEmoji}>{m.emoji}</Text>
            <Text
              style={[
                styles.moodChipLabel,
                selected && { color: m.color, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              {m.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

interface TagEditorProps {
  tags: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

function TagEditor({ tags, onChange, disabled }: TagEditorProps) {
  const [input, setInput] = useState("");

  const commit = useCallback(() => {
    const cleaned = input.trim().replace(/,/g, "");
    if (!cleaned) {
      setInput("");
      return;
    }
    if (!tags.includes(cleaned)) {
      onChange([...tags, cleaned]);
    }
    setInput("");
  }, [input, tags, onChange]);

  const remove = useCallback(
    (tag: string) => {
      haptic();
      onChange(tags.filter((t) => t !== tag));
    },
    [tags, onChange],
  );

  return (
    <View style={styles.tagWrap}>
      {tags.map((tag) => (
        <View key={tag} style={styles.tagChip}>
          <Text style={styles.tagChipText}>{tag}</Text>
          {!disabled ? (
            <Pressable
              onPress={() => remove(tag)}
              hitSlop={6}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              <Feather name="x" size={12} color={Colors.goldDark} />
            </Pressable>
          ) : null}
        </View>
      ))}
      {!disabled ? (
        <TextInput
          value={input}
          onChangeText={(text) => {
            if (text.endsWith(",")) {
              const cleaned = text.slice(0, -1).trim();
              if (cleaned && !tags.includes(cleaned)) {
                onChange([...tags, cleaned]);
              }
              setInput("");
            } else {
              setInput(text);
            }
          }}
          onBlur={commit}
          onSubmitEditing={commit}
          placeholder={tags.length === 0 ? "Add tags…" : "+ tag"}
          placeholderTextColor={Colors.textTertiary}
          style={styles.tagInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          blurOnSubmit={false}
        />
      ) : null}
    </View>
  );
}

function ReadOnlyView({
  entry,
  isLocked,
  onEdit,
  onUnlockAndEdit,
  onDelete,
}: {
  entry: JournalEntry;
  isLocked: boolean;
  onEdit: () => void;
  onUnlockAndEdit: () => void;
  onDelete: () => void;
}) {
  const mood = getMoodOption(entry.mood);
  const text = entry.contentPlainText || entry.content || "";
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.viewTitle}>
        {entry.title?.trim() || "Untitled entry"}
      </Text>
      <Text style={styles.viewDate}>
        {formatLongDate(entry.createdAt)} · {formatLongTime(entry.createdAt)}
      </Text>

      <View style={styles.viewMetaRow}>
        {mood ? (
          <View
            style={[
              styles.viewMoodPill,
              { backgroundColor: `${mood.color}1f`, borderColor: mood.color },
            ]}
          >
            <Text style={styles.moodChipEmoji}>{mood.emoji}</Text>
            <Text style={[styles.moodChipLabel, { color: mood.color }]}>
              {mood.label}
            </Text>
          </View>
        ) : null}
        {isLocked ? (
          <View style={styles.lockedPill}>
            <Feather name="lock" size={11} color={Colors.textSecondary} />
            <Text style={styles.lockedPillText}>Locked (24h)</Text>
          </View>
        ) : null}
      </View>

      {entry.tags && entry.tags.length > 0 ? (
        <View style={styles.viewTagsRow}>
          {entry.tags.map((t) => (
            <View key={t} style={styles.tagChip}>
              <Text style={styles.tagChipText}>{t}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.viewBody}>
        {text ? (
          <Text style={styles.viewBodyText}>{text}</Text>
        ) : (
          <Text style={styles.viewBodyEmpty}>This entry is empty.</Text>
        )}
      </View>

      <View style={styles.viewActions}>
        <Pressable
          onPress={isLocked ? onUnlockAndEdit : onEdit}
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Feather
            name={isLocked ? "unlock" : "edit-2"}
            size={16}
            color={Colors.dark}
          />
          <Text style={styles.primaryBtnText}>
            {isLocked ? "Unlock & edit" : "Edit entry"}
          </Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          style={({ pressed }) => [
            styles.dangerBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Feather name="trash-2" size={16} color={Colors.error} />
          <Text style={styles.dangerBtnText}>Delete</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function ErrorView({
  message,
  onRetry,
  onBack,
}: {
  message: string;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.errorView}>
      <View style={styles.errorIcon}>
        <Feather name="alert-circle" size={36} color={Colors.error} />
      </View>
      <Text style={styles.errorTitle}>Couldn&apos;t load entry</Text>
      <Text style={styles.errorBody}>{message}</Text>
      <View style={styles.errorActions}>
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Feather name="refresh-cw" size={16} color={Colors.dark} />
          <Text style={styles.primaryBtnText}>Try again</Text>
        </Pressable>
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [
            styles.dangerBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Feather name="arrow-left" size={16} color={Colors.text} />
          <Text style={[styles.dangerBtnText, { color: Colors.text }]}>
            Back to journal
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function JournalEntryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useToast();

  const idParam = typeof params.id === "string" ? params.id : "new";
  const isNew = idParam === "new";

  const entryQuery = useQuery({
    queryKey: ["journal", "entry", idParam],
    queryFn: () => api.getJournalEntry(idParam),
    enabled: !isNew,
    retry: 1,
  });

  const entry = entryQuery.data;

  const isLocked = useMemo(() => {
    if (!entry?.createdAt) return false;
    return Date.now() - new Date(entry.createdAt).getTime() > LOCK_AGE_MS;
  }, [entry?.createdAt]);

  const [mode, setMode] = useState<"view" | "edit">(isNew ? "edit" : "view");
  const [editorMode, setEditorMode] = useState<EditorMode>("type");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [canvasPages, setCanvasPages] = useState<InkStrokeData[][]>([]);
  const [initialCanvas, setInitialCanvas] = useState<InkStroke[][] | undefined>(
    undefined,
  );
  const [tool, setTool] = useState<ToolKind>("pen");
  const [penColor, setPenColor] = useState<string>(PEN_COLORS[0].hex);
  const [penSize, setPenSize] = useState<number>(TOOL_DEFAULT_SIZE.pen);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const inkPadRef = useRef<InkPadHandles>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (isNew && !initializedRef.current) {
      initializedRef.current = true;
      setMode("edit");
    }
  }, [isNew]);

  useEffect(() => {
    if (!entry || initializedRef.current) return;
    initializedRef.current = true;
    setTitle(entry.title ?? "");
    setBody(entry.contentPlainText ?? entry.content ?? "");
    setMood(entry.mood ?? null);
    setTags(entry.tags ?? []);
    const loaded =
      entry.canvasData && Array.isArray(entry.canvasData)
        ? (entry.canvasData as InkStroke[][])
        : entry.inkData && Array.isArray(entry.inkData)
          ? [entry.inkData as unknown as InkStroke[]]
          : undefined;
    if (loaded && loaded.length > 0) {
      setInitialCanvas(loaded);
      setCanvasPages(loaded as unknown as InkStrokeData[][]);
    }
  }, [entry]);

  const handleSelectTool = useCallback((next: ToolKind) => {
    haptic();
    setTool(next);
    setPenSize(TOOL_DEFAULT_SIZE[next]);
  }, []);

  const handleSelectColor = useCallback((hex: string) => {
    haptic();
    setPenColor(hex);
    if (tool === "eraser") setTool("pen");
  }, [tool]);

  const handleCanvasChange = useCallback((next: InkStroke[][]) => {
    setCanvasPages(next as unknown as InkStrokeData[][]);
  }, []);

  const handleHistoryChange = useCallback((u: boolean, r: boolean) => {
    setCanUndo(u);
    setCanRedo(r);
  }, []);

  useEffect(() => {
    if (entryQuery.error) {
      const msg =
        entryQuery.error instanceof ApiError
          ? entryQuery.error.message
          : "Couldn't load this entry.";
      showError(msg);
    }
  }, [entryQuery.error, showError]);

  const hasCanvasContent = useMemo(
    () => canvasPages.some((p) => p.length > 0),
    [canvasPages],
  );

  const buildPayload = useCallback((): JournalEntryInput => {
    const trimmedTitle = title.trim();
    const trimmedBody = body;
    const payload: JournalEntryInput = {
      title: trimmedTitle.length > 0 ? trimmedTitle : null,
      content: trimmedBody,
      contentPlainText: trimmedBody,
      mood: mood,
      tags: tags,
      isPrivate: entry?.isPrivate ?? false,
    };
    if (hasCanvasContent) {
      payload.canvasData = canvasPages;
      payload.pageCount = canvasPages.length;
      payload.transcriptionStatus = "pending";
    } else if (initialCanvas) {
      payload.canvasData = canvasPages;
      payload.pageCount = canvasPages.length;
    }
    return payload;
  }, [title, body, mood, tags, entry?.isPrivate, hasCanvasContent, canvasPages, initialCanvas]);

  const runTranscription = useCallback(
    async (entryId: string) => {
      if (!hasCanvasContent) return;
      try {
        setIsTranscribing(true);
        const pngs = (await inkPadRef.current?.exportPagesAsPng()) ?? [];
        if (pngs.length === 0) return;
        await api.transcribeJournalEntry(entryId, pngs);
        queryClient.invalidateQueries({ queryKey: ["journal", "entry", entryId] });
        queryClient.invalidateQueries({ queryKey: ["journal", "list"] });
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Couldn't transcribe handwriting.";
        showError(msg);
      } finally {
        setIsTranscribing(false);
      }
    },
    [hasCanvasContent, queryClient, showError],
  );

  const createMutation = useMutation({
    mutationFn: (payload: JournalEntryInput) => api.createJournalEntry(payload),
    onSuccess: async (created) => {
      queryClient.invalidateQueries({ queryKey: ["journal", "list"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
      showSuccess("Entry saved");
      haptic(Haptics.ImpactFeedbackStyle.Medium);
      if (hasCanvasContent) {
        await runTranscription(created.id);
      }
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace(`/journal-entry?id=${encodeURIComponent(created.id)}`);
      }
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Couldn't save your entry. Please try again.";
      showError(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: JournalEntryInput) => {
      const body: JournalEntryInput & { forceUnlock?: boolean } = { ...payload };
      if (isLocked) body.forceUnlock = true;
      return api.updateJournalEntry(idParam, body);
    },
    onSuccess: async (updated) => {
      queryClient.setQueryData(["journal", "entry", idParam], updated);
      queryClient.invalidateQueries({ queryKey: ["journal", "list"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
      showSuccess("Entry saved");
      haptic(Haptics.ImpactFeedbackStyle.Medium);
      if (hasCanvasContent) {
        await runTranscription(updated.id);
      }
      setMode("view");
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Couldn't save your changes. Please try again.";
      showError(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteJournalEntry(idParam),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal", "list"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
      queryClient.removeQueries({ queryKey: ["journal", "entry", idParam] });
      showSuccess("Entry deleted");
      haptic(Haptics.ImpactFeedbackStyle.Medium);
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/journal");
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Couldn't delete this entry. Please try again.";
      showError(msg);
    },
  });

  const isSaving =
    createMutation.isPending || updateMutation.isPending || isTranscribing;

  const handleSave = useCallback(() => {
    if (isSaving) return;
    if (
      title.trim().length === 0 &&
      body.trim().length === 0 &&
      !hasCanvasContent
    ) {
      showError("Add a title, some content, or a sketch before saving.");
      return;
    }
    haptic();
    const payload = buildPayload();
    if (isNew) createMutation.mutate(payload);
    else updateMutation.mutate(payload);
  }, [
    isSaving,
    title,
    body,
    hasCanvasContent,
    isNew,
    buildPayload,
    createMutation,
    updateMutation,
    showError,
  ]);

  const confirmUnlockAndEdit = useCallback(() => {
    const proceed = () => {
      haptic();
      setMode("edit");
    };
    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        !window.confirm(
          "This entry is older than 24 hours and is normally locked. Unlock for editing?",
        )
      ) {
        return;
      }
      proceed();
      return;
    }
    Alert.alert(
      "Unlock entry?",
      "Entries older than 24 hours are locked to prevent accidental edits.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Unlock & edit", onPress: proceed },
      ],
    );
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteMutation.isPending) return;
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && !window.confirm("Delete this journal entry? This cannot be undone.")) {
        return;
      }
      deleteMutation.mutate();
      return;
    }
    Alert.alert(
      "Delete entry?",
      "This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMutation.mutate(),
        },
      ],
    );
  }, [deleteMutation]);

  const handleBack = useCallback(() => {
    if (mode === "edit" && !isNew) {
      setMode("view");
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/journal");
  }, [mode, isNew, router]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <View
          style={[
            styles.headerRow,
            { paddingTop: insets.top + (Platform.OS === "web" ? 12 : 12) },
          ]}
        >
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [
              styles.headerBtn,
              pressed && { opacity: 0.6 },
            ]}
            hitSlop={6}
          >
            <Feather name="arrow-left" size={22} color={Colors.dark} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {isNew ? "New Entry" : mode === "edit" ? "Edit" : "Entry"}
          </Text>
          <View style={styles.headerActions}>
            {mode === "edit" ? (
              <Pressable
                onPress={handleSave}
                disabled={isSaving}
                style={({ pressed }) => [
                  styles.saveBtn,
                  isSaving && { opacity: 0.6 },
                  pressed && !isSaving && { opacity: 0.85 },
                ]}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={Colors.dark} />
                ) : (
                  <>
                    <Feather name="check" size={16} color={Colors.dark} />
                    <Text style={styles.saveBtnText}>Save</Text>
                  </>
                )}
              </Pressable>
            ) : (
              <View style={styles.headerBtn} />
            )}
          </View>
        </View>

        {entryQuery.isLoading && !isNew ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.gold} />
          </View>
        ) : !isNew && entryQuery.isError ? (
          <ErrorView
            message={
              entryQuery.error instanceof ApiError
                ? entryQuery.error.message
                : "Something went wrong fetching this entry."
            }
            onRetry={() => entryQuery.refetch()}
            onBack={() => {
              if (router.canGoBack()) router.back();
              else router.replace("/(tabs)/journal");
            }}
          />
        ) : !isNew && !entry ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.gold} />
          </View>
        ) : mode === "view" && entry ? (
          <ReadOnlyView
            entry={entry}
            isLocked={isLocked}
            onEdit={() => {
              haptic();
              setMode("edit");
            }}
            onUnlockAndEdit={confirmUnlockAndEdit}
            onDelete={confirmDelete}
          />
        ) : (
          <View style={styles.editorStack}>
            <View style={styles.modePillRow}>
              <Pressable
                onPress={() => {
                  haptic();
                  setEditorMode("type");
                }}
                style={({ pressed }) => [
                  styles.modePill,
                  editorMode === "type" && styles.modePillActive,
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Type mode"
              >
                <Feather
                  name="type"
                  size={14}
                  color={editorMode === "type" ? Colors.dark : Colors.textSecondary}
                />
                <Text
                  style={[
                    styles.modePillText,
                    editorMode === "type" && styles.modePillTextActive,
                  ]}
                >
                  Type
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  haptic();
                  setEditorMode("write");
                }}
                style={({ pressed }) => [
                  styles.modePill,
                  editorMode === "write" && styles.modePillActive,
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Write mode"
              >
                <Feather
                  name="edit-3"
                  size={14}
                  color={editorMode === "write" ? Colors.dark : Colors.textSecondary}
                />
                <Text
                  style={[
                    styles.modePillText,
                    editorMode === "write" && styles.modePillTextActive,
                  ]}
                >
                  Write
                </Text>
              </Pressable>
            </View>

            <View
              style={[
                styles.editorSurface,
                editorMode !== "type" && styles.editorSurfaceHidden,
              ]}
              pointerEvents={editorMode === "type" ? "auto" : "none"}
            >
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={[
                  styles.scrollContent,
                  { paddingBottom: insets.bottom + 120 },
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Entry title"
                  placeholderTextColor={Colors.textTertiary}
                  style={styles.titleInput}
                  maxLength={140}
                />
                <Text style={styles.editDate}>
                  {entry?.createdAt
                    ? formatLongDate(entry.createdAt)
                    : formatLongDate(new Date().toISOString())}
                </Text>

                <Text style={styles.sectionLabel}>How are you feeling?</Text>
                <MoodPicker value={mood} onChange={setMood} />

                <Text style={styles.sectionLabel}>Tags</Text>
                <TagEditor tags={tags} onChange={setTags} />

                <Text style={styles.sectionLabel}>Your thoughts</Text>
                <TextInput
                  value={body}
                  onChangeText={setBody}
                  placeholder="Start writing your thoughts…"
                  placeholderTextColor={Colors.textTertiary}
                  style={styles.bodyInput}
                  multiline
                  textAlignVertical="top"
                  scrollEnabled={false}
                />

                {!isNew ? (
                  <Pressable
                    onPress={confirmDelete}
                    disabled={deleteMutation.isPending}
                    style={({ pressed }) => [
                      styles.dangerBtn,
                      { marginTop: 24 },
                      deleteMutation.isPending && { opacity: 0.6 },
                      pressed && !deleteMutation.isPending && { opacity: 0.85 },
                    ]}
                  >
                    <Feather name="trash-2" size={16} color={Colors.error} />
                    <Text style={styles.dangerBtnText}>Delete entry</Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            </View>

            <View
              style={[
                styles.editorSurface,
                editorMode !== "write" && styles.editorSurfaceHidden,
              ]}
              pointerEvents={editorMode === "write" ? "auto" : "none"}
            >
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={[
                  styles.writeScrollContent,
                  { paddingBottom: insets.bottom + 160 },
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View style={{ paddingHorizontal: 16 }}>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Entry title"
                    placeholderTextColor={Colors.textTertiary}
                    style={styles.titleInput}
                    maxLength={140}
                  />
                </View>
                <View style={{ height: 12 }} />
                <InkPad
                  ref={inkPadRef}
                  pages={initialCanvas as InkStroke[][] | undefined}
                  tool={tool}
                  color={penColor}
                  size={penSize}
                  onChange={handleCanvasChange}
                  onHistoryChange={handleHistoryChange}
                />
              </ScrollView>

              <View
                style={[
                  styles.writeToolbar,
                  { paddingBottom: insets.bottom + 8 },
                ]}
              >
                <View style={styles.toolRow}>
                  {(["pen", "pencil", "highlighter", "eraser"] as ToolKind[]).map(
                    (t) => (
                      <Pressable
                        key={t}
                        onPress={() => handleSelectTool(t)}
                        style={({ pressed }) => [
                          styles.toolBtn,
                          tool === t && styles.toolBtnActive,
                          pressed && { opacity: 0.8 },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`${t} tool`}
                      >
                        <Feather
                          name={
                            t === "pen"
                              ? "edit-2"
                              : t === "pencil"
                                ? "edit-3"
                                : t === "highlighter"
                                  ? "feather"
                                  : "x-circle"
                          }
                          size={16}
                          color={tool === t ? Colors.dark : Colors.textSecondary}
                        />
                      </Pressable>
                    ),
                  )}
                  <View style={styles.toolDivider} />
                  <Pressable
                    onPress={() => {
                      haptic();
                      inkPadRef.current?.undo();
                    }}
                    disabled={!canUndo}
                    style={({ pressed }) => [
                      styles.toolBtn,
                      !canUndo && { opacity: 0.35 },
                      pressed && canUndo && { opacity: 0.7 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Undo"
                  >
                    <Feather
                      name="rotate-ccw"
                      size={15}
                      color={Colors.textSecondary}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      haptic();
                      inkPadRef.current?.redo();
                    }}
                    disabled={!canRedo}
                    style={({ pressed }) => [
                      styles.toolBtn,
                      !canRedo && { opacity: 0.35 },
                      pressed && canRedo && { opacity: 0.7 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Redo"
                  >
                    <Feather
                      name="rotate-cw"
                      size={15}
                      color={Colors.textSecondary}
                    />
                  </Pressable>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.colorRow}
                >
                  {PEN_COLORS.map((c) => {
                    const selected = penColor === c.hex && tool !== "eraser";
                    return (
                      <Pressable
                        key={c.hex}
                        onPress={() => handleSelectColor(c.hex)}
                        disabled={tool === "eraser"}
                        style={({ pressed }) => [
                          styles.colorSwatch,
                          { backgroundColor: c.hex },
                          selected && styles.colorSwatchSelected,
                          tool === "eraser" && { opacity: 0.35 },
                          pressed && tool !== "eraser" && { opacity: 0.85 },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`${c.label} ink`}
                      />
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </>
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
    paddingBottom: 8,
    gap: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
    textAlign: "center",
  },
  headerActions: {
    minWidth: 40,
    alignItems: "flex-end",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.gold,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  saveBtnText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
  },
  loadingBox: {
    paddingVertical: 80,
    alignItems: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 60,
  },
  editorStack: {
    flex: 1,
    position: "relative",
  },
  editorSurface: {
    ...StyleSheet.absoluteFillObject,
    top: 56,
  },
  editorSurfaceHidden: {
    opacity: 0,
  },
  modePillRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    alignItems: "center",
    height: 56,
  },
  modePill: {
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
  modePillActive: {
    backgroundColor: Colors.goldLight,
    borderColor: Colors.gold,
  },
  modePillText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  modePillTextActive: {
    color: Colors.dark,
  },
  writeScrollContent: {
    paddingTop: 8,
  },
  writeToolbar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    paddingHorizontal: 12,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    gap: 8,
  },
  toolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  toolBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  toolBtnActive: {
    backgroundColor: Colors.goldLight,
    borderColor: Colors.gold,
  },
  toolDivider: {
    width: 1,
    height: 22,
    backgroundColor: Colors.cardBorder,
    marginHorizontal: 4,
  },
  colorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  colorSwatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "rgba(0,0,0,0.15)",
  },
  colorSwatchSelected: {
    borderColor: Colors.dark,
    borderWidth: 2.5,
    transform: [{ scale: 1.1 }],
  },
  titleInput: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  editDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 24,
    marginBottom: 10,
  },
  moodRow: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 12,
  },
  moodChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
  },
  moodChipEmoji: {
    fontSize: 16,
  },
  moodChipLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  tagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.goldLight,
  },
  tagChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.goldDark,
  },
  tagInput: {
    minWidth: 100,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  bodyInput: {
    minHeight: 240,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    lineHeight: 22,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 14,
  },
  viewTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
  },
  viewDate: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 4,
  },
  viewMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  viewMoodPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  lockedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
  },
  lockedPillText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  viewTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
  },
  viewBody: {
    marginTop: 20,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 16,
  },
  viewBodyText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    lineHeight: 22,
  },
  viewBodyEmpty: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    fontStyle: "italic",
  },
  viewActions: {
    marginTop: 24,
    gap: 10,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.gold,
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryBtnText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
  },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
  },
  dangerBtnText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.error,
  },
  errorView: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 60,
    alignItems: "center",
    gap: 12,
  },
  errorIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  errorBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  errorActions: {
    width: "100%",
    marginTop: 12,
    gap: 10,
  },
});
