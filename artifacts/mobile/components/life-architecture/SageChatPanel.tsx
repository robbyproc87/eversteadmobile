import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
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
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import Colors from "@/constants/colors";
import { useToast } from "@/contexts/ToastContext";
import { isPaymentRequiredError, lifeArchitectureApi } from "@/lib/api";
import { sectionNumberFor, type SectionMeta } from "@/lib/life-architecture";

interface ChatMessage {
  id: string;
  role: string;
  content: string;
}

interface Props {
  section: SectionMeta;
  onUpgradeRequired?: () => void;
}

// The panel previously faked its opening (a local bubble the server
// never saw) over the generic coach chat - Sage had no idea it had
// asked anything, nothing persisted, and the save_section_data capture
// flow never ran. It now drives the dedicated section-aware endpoint:
// server-held history, section prompts, and live structured capture.
export function SageChatPanel({ section, onUpgradeRequired }: Props) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const sectionNumber = sectionNumberFor(section.id);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [input, setInput] = useState("");
  const [primed, setPrimed] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const sendRaw = useCallback(
    async (message: string, isInitial = false) => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        let firstChunk = true;
        let assistantText = "";

        for await (const chunk of lifeArchitectureApi.streamSectionChat(
          { sectionNumber, message, isInitial },
          controller.signal,
        )) {
          if (firstChunk) {
            setIsStreaming(true);
            setIsSending(false);
            firstChunk = false;
          }
          if (chunk.text) {
            setIsThinking(false);
            assistantText += chunk.text;
            setStreamingContent((prev) => prev + chunk.text);
          }
          if (chunk.sectionData) {
            // Sage distilled the conversation into structured data and
            // saved it server-side; pull it into the form and the hub.
            queryClient.invalidateQueries({
              queryKey: ["life-architecture"],
            });
            showToast(`Sage shaped ${section.label} — check "Shape it".`, {
              variant: "success",
            });
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              ).catch(() => {});
            }
          }
          if (chunk.error) {
            showToast(chunk.error || "Sage is unavailable right now.", {
              variant: "error",
            });
          }
          if (chunk.done) {
            setIsStreaming(false);
            setIsThinking(false);
            if (assistantText.trim()) {
              setMessages((prev) => [
                ...prev,
                {
                  id: `a-${Date.now()}`,
                  role: "assistant",
                  content: assistantText,
                },
              ]);
            }
            setStreamingContent("");
          }
        }
      } catch (err) {
        const aborted =
          err instanceof Error &&
          (err.name === "AbortError" || /abort/i.test(err.message));
        if (!aborted) {
          if (isPaymentRequiredError(err)) {
            onUpgradeRequired?.();
          } else {
            showToast(
              err instanceof Error
                ? err.message
                : "Couldn't reach Sage right now.",
              { variant: "error" },
            );
            // Hand a failed message back to the composer.
            if (!isInitial) setInput(message);
          }
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setIsStreaming(false);
        setIsThinking(false);
        setIsSending(false);
        setStreamingContent("");
      }
    },
    [sectionNumber, section.label, queryClient, showToast, onUpgradeRequired],
  );

  // Restore the persistent server-side conversation; if this section
  // has never been opened, ask Sage to open it for real.
  useEffect(() => {
    if (primed) return;
    setPrimed(true);
    let cancelled = false;
    (async () => {
      setIsSending(true);
      try {
        const res = await lifeArchitectureApi.getSection(sectionNumber);
        if (cancelled) return;
        const history = (res?.section?.conversationHistory ?? []).filter(
          (m) => typeof m?.content === "string" && m.content.trim(),
        );
        if (history.length > 0) {
          setMessages(
            history.map((m, i) => ({
              id: `h-${i}`,
              role: m.role,
              content: m.content,
            })),
          );
          setIsSending(false);
          return;
        }
      } catch (err) {
        if (cancelled) return;
        if (isPaymentRequiredError(err)) {
          setIsSending(false);
          onUpgradeRequired?.();
          return;
        }
        // History fetch failing isn't fatal - fall through to opening.
      }
      if (!cancelled) {
        sendRaw("(begin)", true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [primed, sectionNumber, sendRaw, onUpgradeRequired]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || isSending) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setInput("");
    setIsSending(true);
    setStreamingContent("");
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", content: trimmed },
    ]);
    sendRaw(trimmed);
  }, [input, isStreaming, isSending, sendRaw]);

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, []);

  // Auto-scroll on changes.
  useEffect(() => {
    const t = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 30);
    return () => clearTimeout(t);
  }, [messages.length, streamingContent, isThinking]);

  const displayed = useMemo(() => messages, [messages]);

  return (
    <View style={[styles.wrap, { borderColor: section.color }]}>
      <View style={[styles.header, { backgroundColor: section.bg }]}>
        <View style={[styles.orb, { backgroundColor: section.color }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Sage</Text>
          <Text style={styles.headerSub}>Guiding you through {section.label}</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: false })
        }
      >
        {displayed.map((msg) => (
          <ChatBubble key={msg.id} msg={msg} color={section.color} />
        ))}
        {streamingContent.length > 0 && (
          <ChatBubble
            msg={{ id: "stream", role: "assistant", content: streamingContent }}
            color={section.color}
            streaming
          />
        )}
        {(isThinking || (isStreaming && !streamingContent) || isSending) && (
          <View style={styles.assistantRow}>
            <View
              style={[
                styles.bubbleAssistant,
                { borderLeftColor: `${section.color}80` },
              ]}
            >
              <TypingDots color={section.color} />
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder="Reply to Sage…"
          placeholderTextColor={Colors.textTertiary}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={2000}
          editable={!isStreaming && !isSending}
          blurOnSubmit={false}
          onSubmitEditing={Platform.OS === "web" ? handleSend : undefined}
        />
        <Pressable
          onPress={handleSend}
          style={({ pressed }) => [
            styles.sendBtn,
            { backgroundColor: section.color },
            (!input.trim() || isStreaming || isSending) && {
              opacity: 0.4,
            },
            pressed && input.trim() && { opacity: 0.85 },
          ]}
          disabled={!input.trim() || isStreaming || isSending}
          accessibilityLabel="Send message"
        >
          {isStreaming || isSending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Feather name="send" size={16} color="#fff" />
          )}
        </Pressable>
      </View>
    </View>
  );
}

function ChatBubble({
  msg,
  color,
  streaming,
}: {
  msg: ChatMessage;
  color: string;
  streaming?: boolean;
}) {
  const isUser = msg.role === "user";
  if (isUser) {
    return (
      <View style={styles.userRow}>
        <View style={styles.bubbleUser}>
          <Text style={styles.userText}>{msg.content}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.assistantRow}>
      <View
        style={[styles.bubbleAssistant, { borderLeftColor: `${color}80` }]}
      >
        <Text style={styles.assistantText}>{msg.content}</Text>
        {streaming && (
          <View style={[styles.cursor, { backgroundColor: color }]} />
        )}
      </View>
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

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
    minHeight: 240,
    maxHeight: 320,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  orb: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  headerTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  headerSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    padding: 12,
    gap: 8,
  },
  userRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  assistantRow: {
    flexDirection: "row",
  },
  bubbleUser: {
    backgroundColor: Colors.dark,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: "85%",
  },
  bubbleAssistant: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderLeftWidth: 3,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: "85%",
  },
  userText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#fff",
    lineHeight: 18,
  },
  assistantText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
    lineHeight: 18,
  },
  cursor: {
    width: 2,
    height: 14,
    marginTop: 2,
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
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
    backgroundColor: Colors.card,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
    maxHeight: 80,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
