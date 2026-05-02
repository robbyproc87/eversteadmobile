"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CoachSidebar } from "./CoachSidebar";
import { CoachChatArea } from "./CoachChatArea";
import { CoachSettingsPanel } from "./CoachSettingsPanel";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { getCoach } from "@/lib/coach/coach-definitions";
import type {
  ConversationListItem,
  ConversationDetail,
  StreamChunk,
} from "@/lib/coach/coach-types";

interface CoachPageProps {
  userName?: string;
}

export function CoachPage({ userName }: CoachPageProps) {
  const queryClient = useQueryClient();
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [activeCoachId, setActiveCoachId] = useState("sage");
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingActions, setStreamingActions] = useState<import("@/lib/coach/coach-types").CoachAction[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const resolvedCoachRef = useRef<string | null>(null);

  const { data: conversations = [], isLoading: convLoading } = useQuery<
    ConversationListItem[]
  >({
    queryKey: ["coach", "conversations"],
    queryFn: async () => {
      const res = await fetch("/api/coach/conversations");
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return res.json();
    },
  });

  useEffect(() => {
    if (convLoading) return;
    if (resolvedCoachRef.current === activeCoachId && activeConvId) return;

    const coachConvs = conversations.filter((c) => c.coachType === activeCoachId);
    if (coachConvs.length > 0) {
      setActiveConvId(coachConvs[0].id);
    } else {
      setActiveConvId(null);
    }
    resolvedCoachRef.current = activeCoachId;
  }, [activeCoachId, conversations, convLoading, activeConvId]);

  const { data: activeConversation, isLoading: msgLoading } =
    useQuery<ConversationDetail>({
      queryKey: ["coach", "conversation", activeConvId],
      queryFn: async () => {
        const res = await fetch(`/api/coach/conversations/${activeConvId}`);
        if (!res.ok) throw new Error("Failed to fetch conversation");
        return res.json();
      },
      enabled: !!activeConvId,
    });

  const greetingTriggeredRef = useRef<string | null>(null);

  const sendRaw = useCallback(
    async (message: string, opts?: { isSystemTrigger?: boolean }) => {
      try {
        abortRef.current = new AbortController();

        const res = await fetch("/api/coach/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: activeConvId,
            message,
            currentPage: "Coach",
            coachType: activeCoachId,
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) throw new Error("Failed to send message");

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let convId = activeConvId;

        setIsStreaming(true);
        setIsSending(false);
        setStreamingActions([]);
        setIsThinking(false);

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              try {
                const chunk: StreamChunk = JSON.parse(line.slice(6));

                if (chunk.conversationId && !convId) {
                  convId = chunk.conversationId;
                  setActiveConvId(convId);
                }

                if (chunk.thinking) {
                  setIsThinking(true);
                }

                if (chunk.action) {
                  setIsThinking(false);
                  setStreamingActions((prev) => [...prev, chunk.action!]);
                  if (chunk.action.invalidateKeys) {
                    for (const key of chunk.action.invalidateKeys) {
                      queryClient.invalidateQueries({ queryKey: key });
                    }
                  }
                }

                if (chunk.text) {
                  setIsThinking(false);
                  setStreamingContent((prev) => prev + chunk.text);
                }

                if (chunk.done) {
                  setIsStreaming(false);
                  setIsThinking(false);
                  setStreamingContent("");
                  setStreamingActions([]);
                  if (convId) {
                    queryClient.invalidateQueries({
                      queryKey: ["coach", "conversation", convId],
                    });
                  }
                  queryClient.invalidateQueries({
                    queryKey: ["coach", "conversations"],
                  });
                }

                if (chunk.error) {
                  setIsStreaming(false);
                  setIsThinking(false);
                  setStreamingContent("");
                  setStreamingActions([]);
                  console.error("Stream error:", chunk.error);
                }
              } catch {
                // ignore parse errors
              }
            }
          }
        } finally {
          setIsStreaming(false);
          setIsThinking(false);
          setIsSending(false);
          if (convId) {
            queryClient.invalidateQueries({
              queryKey: ["coach", "conversation", convId],
            });
          }
          queryClient.invalidateQueries({
            queryKey: ["coach", "conversations"],
          });
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Chat error:", err);
        }
        setIsStreaming(false);
        setIsThinking(false);
        setIsSending(false);
        setStreamingContent("");
        setStreamingActions([]);
      }
    },
    [activeConvId, activeCoachId, queryClient]
  );

  useEffect(() => {
    if (convLoading || msgLoading) return;
    if (isStreaming || isSending) return;
    if (activeConvId) return;

    const coachConvs = conversations.filter((c) => c.coachType === activeCoachId);
    if (coachConvs.length > 0) return;

    const greetingKey = `greeting-${activeCoachId}`;
    if (greetingTriggeredRef.current === greetingKey) return;
    greetingTriggeredRef.current = greetingKey;
    setIsSending(true);
    sendRaw("__SAGE_GREETING__", { isSystemTrigger: true });
  }, [activeConvId, convLoading, msgLoading, isStreaming, isSending, conversations, activeCoachId, sendRaw]);

  const handleSend = useCallback(
    async (message: string) => {
      if (isStreaming || isSending) return;

      setIsSending(true);
      setStreamingContent("");
      setStreamingActions([]);

      const optimisticUserMsg = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: message,
        createdAt: new Date().toISOString(),
      };

      if (activeConvId) {
        queryClient.setQueryData<ConversationDetail>(
          ["coach", "conversation", activeConvId],
          (old) => {
            if (!old) return old;
            return {
              ...old,
              messages: [...old.messages, optimisticUserMsg],
            };
          }
        );
      }

      await sendRaw(message);
    },
    [activeConvId, isStreaming, isSending, queryClient, sendRaw]
  );

  const handleCoachSelect = useCallback(
    (coachId: string) => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      setIsStreaming(false);
      setIsThinking(false);
      setIsSending(false);
      setStreamingContent("");
      setStreamingActions([]);
      setActiveCoachId(coachId);
      resolvedCoachRef.current = null;
      setMobileDrawerOpen(false);
    },
    []
  );

  const messages = activeConversation?.messages || [];
  const activeCoach = getCoach(activeCoachId);

  return (
    <div className="flex h-full" data-testid="coach-page">
      <div className="hidden md:flex">
        <CoachSidebar
          activeCoachId={activeCoachId}
          onCoachSelect={handleCoachSelect}
          onSettings={() => setSettingsOpen(true)}
        />
      </div>

      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-80 bg-background shadow-xl animate-in slide-in-from-left">
            <CoachSidebar
              activeCoachId={activeCoachId}
              onCoachSelect={handleCoachSelect}
              onSettings={() => {
                setMobileDrawerOpen(false);
                setSettingsOpen(true);
              }}
              onClose={() => setMobileDrawerOpen(false)}
              isMobileDrawer
            />
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSettingsOpen(false)}
          />
          <div className="relative bg-background rounded-xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <CoachSettingsPanel onClose={() => setSettingsOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 p-3 border-b md:hidden">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setMobileDrawerOpen(true)}
            data-testid="coach-mobile-menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span
            className="font-semibold text-sm"
            style={{ color: activeCoach.color }}
          >
            {activeCoach.name}
          </span>
          <span className="text-xs text-muted-foreground">{activeCoach.shortDescription}</span>
        </div>
        <CoachChatArea
          messages={messages}
          streamingContent={streamingContent}
          streamingActions={streamingActions}
          isStreaming={isStreaming}
          isThinking={isThinking}
          isSending={isSending}
          userName={userName}
          coachId={activeCoachId}
          onSend={handleSend}
          isLoadingGreeting={isSending && messages.length === 0 && !streamingContent}
        />
      </div>
    </div>
  );
}
