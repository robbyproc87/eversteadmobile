import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
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

import { AuthGuard } from "@/components/AuthGuard";
import { PreviewEmptyState } from "@/components/PreviewEmptyState";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  COACHES,
  COACH_IDS,
  GREETING_TRIGGER,
  getCoach,
} from "@/lib/coach";
import {
  coachApi,
  isPreviewAuthError,
  type CoachChatMessage,
  type CoachConversationDetail,
  type CoachConversationListItem,
} from "@/lib/api";

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  createdAt?: string;
}

function CoachOrb({
  coachId,
  size = 28,
  ring = false,
}: {
  coachId: string;
  size?: number;
  ring?: boolean;
}) {
  const coach = getCoach(coachId);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: coach.color,
        borderWidth: ring ? 2 : 0,
        borderColor: ring ? coach.color : "transparent",
        alignItems: "center",
        justifyContent: "center",
        ...Platform.select({
          ios: {
            shadowColor: coach.color,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.4,
            shadowRadius: 6,
          },
          android: { elevation: 3 },
          web: { boxShadow: `0 2px 8px ${coach.color}66` },
        }),
      }}
    >
      <View
        style={{
          width: size * 0.45,
          height: size * 0.45,
          borderRadius: size * 0.225,
          backgroundColor: coach.gradientFrom,
          opacity: 0.9,
          transform: [{ translateX: -size * 0.08 }, { translateY: -size * 0.08 }],
        }}
      />
    </View>
  );
}

function TypingDots({ color }: { color: string }) {
  const dots = useRef([
    new Animated.Value(0.3),
    new Animated.Value(0.3),
    new Animated.Value(0.3),
  ]).current;

  useEffect(() => {
    const animations = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(d, {
            toValue: 1,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(d, {
            toValue: 0.3,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [dots]);

  return (
    <View style={styles.typingDots}>
      {dots.map((d, i) => (
        <Animated.View
          key={i}
          style={[styles.typingDot, { backgroundColor: color, opacity: d }]}
        />
      ))}
    </View>
  );
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <Text key={i} style={styles.bold}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <Text key={i} style={styles.italic}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    return <Text key={i}>{part}</Text>;
  });
}

function MessageBubble({
  role,
  content,
  coachId,
  isStreaming,
}: {
  role: string;
  content: string;
  coachId: string;
  isStreaming?: boolean;
}) {
  const isUser = role === "user";
  const coach = getCoach(coachId);
  const paragraphs = content.split("\n\n").filter((p) => p.length > 0);

  if (isUser) {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          {paragraphs.map((p, i) => (
            <Text key={i} style={styles.userText}>
              {renderInline(p)}
            </Text>
          ))}
          {paragraphs.length === 0 && (
            <Text style={styles.userText}>{content}</Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.assistantRow}>
      <CoachOrb coachId={coachId} size={28} />
      <View
        style={[
          styles.assistantBubble,
          { borderLeftColor: `${coach.color}80` },
        ]}
      >
        {paragraphs.length > 0 ? (
          paragraphs.map((p, i) => (
            <Text key={i} style={styles.assistantText}>
              {renderInline(p)}
            </Text>
          ))
        ) : (
          <Text style={styles.assistantText}>{content}</Text>
        )}
        {isStreaming && (
          <View style={[styles.cursor, { backgroundColor: coach.color }]} />
        )}
      </View>
    </View>
  );
}

export default function SageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { session } = useAuth();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const [activeCoachId, setActiveCoachId] = useState<string>("sage");
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>(
    [],
  );
  const [input, setInput] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const resolvedCoachRef = useRef<string | null>(null);
  const greetingTriggeredRef = useRef<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const activeCoach = getCoach(activeCoachId);

  const conversationsQuery = useQuery<CoachConversationListItem[]>({
    queryKey: ["coach", "conversations"],
    queryFn: () => coachApi.listConversations(),
    enabled: !!session,
  });
  const conversations = conversationsQuery.data ?? [];
  const convLoading = conversationsQuery.isLoading;

  const activeConversationQuery = useQuery<CoachConversationDetail>({
    queryKey: ["coach", "conversation", activeConvId],
    queryFn: () => coachApi.getConversation(activeConvId!),
    enabled: !!activeConvId,
  });
  const activeConversation = activeConversationQuery.data;
  const msgLoading = activeConversationQuery.isLoading;

  const isPreviewError =
    isPreviewAuthError(conversationsQuery.error) ||
    isPreviewAuthError(activeConversationQuery.error);

  // Resolve the active conversation per coach whenever the coach changes.
  useEffect(() => {
    if (convLoading) return;
    if (resolvedCoachRef.current === activeCoachId && activeConvId) return;
    const coachConvs = conversations.filter(
      (c) => c.coachType === activeCoachId,
    );
    if (coachConvs.length > 0) {
      setActiveConvId(coachConvs[0].id);
    } else {
      setActiveConvId(null);
    }
    resolvedCoachRef.current = activeCoachId;
  }, [activeCoachId, conversations, convLoading, activeConvId]);

  const sendRaw = useCallback(
    async (message: string, opts?: { isGreeting?: boolean }) => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // Guard against stale conv IDs: if the active conversation does not
        // belong to the active coach, treat as a brand-new conversation.
        const matched = conversations.find(
          (c) => c.id === activeConvId && c.coachType === activeCoachId,
        );
        let convId = matched ? activeConvId : null;
        let firstChunk = true;

        for await (const chunk of coachApi.streamChat(
          {
            conversationId: convId,
            message,
            coachType: activeCoachId,
            currentPage: "Sage",
          },
          controller.signal,
        )) {
          if (firstChunk) {
            setIsStreaming(true);
            setIsSending(false);
            firstChunk = false;
          }

          if (chunk.conversationId && !convId) {
            convId = chunk.conversationId;
            setActiveConvId(convId);
          }
          if (chunk.thinking) {
            setIsThinking(true);
          }
          if (chunk.action) {
            setIsThinking(false);
          }
          if (chunk.text) {
            setIsThinking(false);
            setStreamingContent((prev) => prev + chunk.text);
          }
          if (chunk.error) {
            showToast(chunk.error || "Coach is unavailable right now", {
              variant: "error",
            });
          }
          if (chunk.done) {
            setIsStreaming(false);
            setIsThinking(false);
            setStreamingContent("");
            setOptimisticMessages([]);
            if (convId) {
              queryClient.invalidateQueries({
                queryKey: ["coach", "conversation", convId],
              });
            }
            queryClient.invalidateQueries({
              queryKey: ["coach", "conversations"],
            });
          }
        }
      } catch (err) {
        const aborted =
          err instanceof Error &&
          (err.name === "AbortError" || /abort/i.test(err.message));
        if (!aborted) {
          // eslint-disable-next-line no-console
          console.warn("Coach chat error", err);
          showToast(
            err instanceof Error
              ? err.message
              : "Couldn't reach your coach. Please try again.",
            { variant: "error" },
          );
          setOptimisticMessages([]);
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        setIsStreaming(false);
        setIsThinking(false);
        setIsSending(false);
        setStreamingContent("");
      }
    },
    [activeConvId, activeCoachId, conversations, queryClient, showToast],
  );

  const isPreview = session?.access_token === "dev-bypass";

  // Auto-trigger greeting when the user lands on a coach with no prior conversation.
  useEffect(() => {
    if (!session) return;
    if (isPreview) return;
    if (convLoading || msgLoading) return;
    if (isStreaming || isSending) return;
    if (activeConvId) return;
    const coachConvs = conversations.filter(
      (c) => c.coachType === activeCoachId,
    );
    if (coachConvs.length > 0) return;
    const key = `greeting-${activeCoachId}`;
    if (greetingTriggeredRef.current === key) return;
    greetingTriggeredRef.current = key;
    setIsSending(true);
    sendRaw(GREETING_TRIGGER, { isGreeting: true });
  }, [
    session,
    isPreview,
    activeConvId,
    convLoading,
    msgLoading,
    isStreaming,
    isSending,
    conversations,
    activeCoachId,
    sendRaw,
  ]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (isStreaming || isSending) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setInput("");
    setIsSending(true);
    setStreamingContent("");
    setOptimisticMessages((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      },
    ]);
    sendRaw(trimmed);
  }, [input, isStreaming, isSending, sendRaw]);

  const handleCoachSelect = useCallback(
    (coachId: string) => {
      if (coachId === activeCoachId) return;
      if (Platform.OS !== "web") {
        Haptics.selectionAsync();
      }
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      setIsStreaming(false);
      setIsThinking(false);
      setIsSending(false);
      setStreamingContent("");
      setOptimisticMessages([]);
      setActiveCoachId(coachId);
      // Resolve immediately to the matching coach's conversation (or null)
      // so a quick send after a switch can never land in the previous coach.
      const next = conversations.find((c) => c.coachType === coachId);
      setActiveConvId(next ? next.id : null);
      resolvedCoachRef.current = coachId;
    },
    [activeCoachId, conversations],
  );

  const handleClose = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    router.back();
  }, [router]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, []);

  // Combine persisted + optimistic + streaming for display.
  const displayedMessages = useMemo<ChatMessage[]>(() => {
    const persisted: ChatMessage[] = (activeConversation?.messages ??
      []) as CoachChatMessage[];
    return [...persisted, ...optimisticMessages];
  }, [activeConversation?.messages, optimisticMessages]);

  const showInitialLoading =
    !!activeConvId && msgLoading && displayedMessages.length === 0;

  const showGreetingLoading =
    !activeConvId &&
    (isSending || convLoading) &&
    displayedMessages.length === 0 &&
    !streamingContent;

  // Auto-scroll to bottom when content changes.
  useEffect(() => {
    const t = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(t);
  }, [displayedMessages.length, streamingContent, isThinking, isSending]);

  if (isPreviewError) {
    return (
      <AuthGuard>
        <View
          style={[
            styles.container,
            {
              paddingTop: Platform.OS === "web" ? webTopInset : 0,
              paddingBottom: insets.bottom,
            },
          ]}
        >
          <PreviewEmptyState screenName="Sage" />
        </View>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <View
        style={[
          styles.container,
          {
            paddingTop: Platform.OS === "web" ? webTopInset : 0,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <CoachOrb coachId={activeCoachId} size={36} />
            <View>
              <Text style={[styles.headerTitle, { color: activeCoach.color }]}>
                {activeCoach.name}
              </Text>
              <Text style={styles.headerSubtitle}>
                {activeCoach.shortDescription}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && { opacity: 0.6 },
            ]}
            accessibilityLabel="Close coaching"
          >
            <Feather name="x" size={22} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.selectorWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.selectorContent}
          >
            {COACH_IDS.map((id) => {
              const coach = COACHES[id];
              const isActive = id === activeCoachId;
              return (
                <Pressable
                  key={id}
                  onPress={() => handleCoachSelect(id)}
                  style={({ pressed }) => [
                    styles.selectorItem,
                    isActive && {
                      backgroundColor: `${coach.color}1f`,
                      borderColor: coach.color,
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <CoachOrb coachId={id} size={24} />
                  <Text
                    style={[
                      styles.selectorLabel,
                      { color: isActive ? coach.color : Colors.textSecondary },
                      isActive && { fontFamily: "Inter_600SemiBold" },
                    ]}
                  >
                    {coach.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <KeyboardAvoidingView
          style={styles.chatArea}
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : Platform.OS === "android"
                ? "height"
                : undefined
          }
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.bottom : 0}
        >
          <ScrollView
            ref={scrollRef}
            style={styles.messagesScroll}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              scrollRef.current?.scrollToEnd({ animated: false })
            }
          >
            {showInitialLoading && (
              <View style={styles.centerState}>
                <ActivityIndicator color={activeCoach.color} />
              </View>
            )}

            {showGreetingLoading && (
              <View style={styles.welcomeCard}>
                <CoachOrb coachId={activeCoachId} size={56} />
                <Text style={styles.welcomeTitle}>
                  {activeCoach.name} is preparing a greeting…
                </Text>
                <TypingDots color={activeCoach.color} />
              </View>
            )}

            {!showInitialLoading &&
              !showGreetingLoading &&
              displayedMessages.length === 0 &&
              !streamingContent && (
                <View style={styles.welcomeCard}>
                  <CoachOrb coachId={activeCoachId} size={56} />
                  <Text style={styles.welcomeTitle}>
                    {isPreview
                      ? `Sign in to chat with ${activeCoach.name}`
                      : "Hey, what's on your mind?"}
                  </Text>
                  <Text style={styles.welcomeSubtext}>
                    {isPreview
                      ? "You're in Preview Mode. Coaching conversations are saved to your account — sign in to start one."
                      : activeCoach.description}
                  </Text>
                </View>
              )}

            {displayedMessages.map((msg) => (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                coachId={activeCoachId}
              />
            ))}

            {streamingContent.length > 0 && (
              <MessageBubble
                role="assistant"
                content={streamingContent}
                coachId={activeCoachId}
                isStreaming
              />
            )}

            {(isThinking ||
              (isSending && !streamingContent) ||
              (isStreaming && !streamingContent)) &&
              displayedMessages.length > 0 && (
                <View style={styles.assistantRow}>
                  <CoachOrb coachId={activeCoachId} size={28} />
                  <View
                    style={[
                      styles.assistantBubble,
                      { borderLeftColor: `${activeCoach.color}80` },
                    ]}
                  >
                    <TypingDots color={activeCoach.color} />
                  </View>
                </View>
              )}
          </ScrollView>

          <View style={styles.inputBar}>
            <TextInput
              style={styles.textInput}
              placeholder={
                isPreview
                  ? "Sign in to send messages"
                  : `Message ${activeCoach.name}…`
              }
              placeholderTextColor={Colors.textTertiary}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={2000}
              editable={!isStreaming && !isSending && !isPreview}
              onSubmitEditing={Platform.OS === "web" ? handleSend : undefined}
              blurOnSubmit={false}
            />
            <Pressable
              onPress={handleSend}
              style={({ pressed }) => [
                styles.sendButton,
                { backgroundColor: activeCoach.color },
                (!input.trim() || isStreaming || isSending || isPreview) &&
                  styles.sendButtonDisabled,
                pressed && input.trim() && !isPreview && { opacity: 0.85 },
              ]}
              disabled={
                !input.trim() || isStreaming || isSending || isPreview
              }
              accessibilityLabel="Send message"
            >
              {isStreaming || isSending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather
                  name="send"
                  size={18}
                  color={input.trim() ? "#fff" : Colors.textTertiary}
                />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </AuthGuard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
    backgroundColor: Colors.card,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  selectorWrap: {
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  selectorContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  selectorItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.background,
  },
  selectorLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  chatArea: {
    flex: 1,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 12,
  },
  centerState: {
    paddingVertical: 32,
    alignItems: "center",
  },
  welcomeCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginVertical: 16,
  },
  welcomeTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
    textAlign: "center",
  },
  welcomeSubtext: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  userRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  userBubble: {
    maxWidth: "82%",
    backgroundColor: Colors.dark,
    borderRadius: 18,
    borderTopRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  assistantRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  assistantBubble: {
    flex: 1,
    maxWidth: "85%",
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderTopLeftRadius: 4,
    borderLeftWidth: 2,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  assistantText: {
    color: Colors.dark,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  bold: {
    fontFamily: "Inter_600SemiBold",
  },
  italic: {
    fontStyle: "italic",
  },
  cursor: {
    width: 6,
    height: 14,
    borderRadius: 1,
    marginTop: 2,
    opacity: 0.7,
  },
  typingDots: {
    flexDirection: "row",
    gap: 4,
    paddingVertical: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
    backgroundColor: Colors.card,
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
    maxHeight: 120,
    minHeight: 40,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
