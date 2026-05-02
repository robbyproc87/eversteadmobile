"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { SageOrb } from "./SageOrb";
import { CoachMessageBubble } from "./CoachMessageBubble";
import { CoachTypingIndicator } from "./CoachTypingIndicator";
import { CoachInput } from "./CoachInput";
import { Button } from "@/components/ui/button";
import { X, ExternalLink } from "lucide-react";
import type {
  ConversationListItem,
  ConversationDetail,
  StreamChunk,
} from "@/lib/coach/coach-types";

function getQuickChatPlaceholder(path: string): string {
  if (path.includes("/planner") && path.includes("view=day"))
    return "Working on today's plan? I can help with priorities or suggest what to focus on.";
  if (path.includes("/planner") && path.includes("tab=blueprint"))
    return "Setting up your Blueprint? I can help you craft meaningful goals for the week.";
  if (path.includes("/planner") && path.includes("tab=weekly-review"))
    return "Reflecting on your week? I can help you think through what worked and what to adjust.";
  if (path.includes("/planner") && path.includes("tab=weekly-story"))
    return "Writing your weekly story? I can help you capture what made each day meaningful.";
  if (path.startsWith("/planner"))
    return "Working on your plan? I can help you think through priorities and goals.";
  if (path.startsWith("/journal"))
    return "Journaling? I can suggest a prompt or help you explore what's on your mind.";
  if (path.startsWith("/meditation"))
    return "Interested in meditation? I can recommend a practice or help you build consistency.";
  if (path.startsWith("/growth/books") || path.startsWith("/growth/courses"))
    return "What are you reading or learning? I can help you turn insights into action.";
  return "What's on your mind?";
}

interface SageQuickChatProps {
  currentPage: string;
  currentPath: string;
  onClose: () => void;
}

export function SageQuickChat({ currentPage, currentPath, onClose }: SageQuickChatProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);

  const { data: conversations = [] } = useQuery<ConversationListItem[]>({
    queryKey: ["coach", "conversations"],
    queryFn: async () => {
      const res = await fetch("/api/coach/conversations");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  useEffect(() => {
    if (!activeConvId && conversations.length > 0) {
      setActiveConvId(conversations[0].id);
    }
  }, [conversations, activeConvId]);

  const { data: conversation } = useQuery<ConversationDetail>({
    queryKey: ["coach", "conversation", activeConvId],
    queryFn: async () => {
      const res = await fetch(`/api/coach/conversations/${activeConvId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!activeConvId,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation?.messages, streamingContent]);

  const handleSend = useCallback(
    async (message: string) => {
      if (isStreaming || isSending) return;
      setIsSending(true);
      setStreamingContent("");

      try {
        const res = await fetch("/api/coach/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: activeConvId,
            message,
            currentPage,
            coachType: "sage",
          }),
        });

        if (!res.ok) throw new Error("Failed");

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No body");

        const decoder = new TextDecoder();
        let buffer = "";

        setIsStreaming(true);
        setIsSending(false);

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

              if (chunk.conversationId && !activeConvId) {
                setActiveConvId(chunk.conversationId);
              }

              if (chunk.text) {
                setStreamingContent((prev) => prev + chunk.text);
              }

              if (chunk.done) {
                setIsStreaming(false);
                setStreamingContent("");
                queryClient.invalidateQueries({
                  queryKey: ["coach", "conversations"],
                });
                if (activeConvId || chunk.conversationId) {
                  queryClient.invalidateQueries({
                    queryKey: [
                      "coach",
                      "conversation",
                      activeConvId || chunk.conversationId,
                    ],
                  });
                }
              }

              if (chunk.error) {
                setIsStreaming(false);
                setStreamingContent("");
              }
            } catch {
              // ignore
            }
          }
        }
      } catch (err) {
        console.error("Quick chat error:", err);
        setIsStreaming(false);
        setIsSending(false);
        setStreamingContent("");
      }
    },
    [activeConvId, isStreaming, isSending, currentPage, queryClient]
  );

  const recentMessages = (conversation?.messages || []).slice(-10);
  const placeholderText = getQuickChatPlaceholder(currentPath);

  return (
    <div
      className="fixed bottom-6 right-6 z-50 w-[360px] h-[520px] max-h-[80vh] bg-background border rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200"
      data-testid="sage-quick-chat"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <SageOrb size={28} />
        <span className="font-semibold text-sm text-amber-600 dark:text-amber-400 flex-1">
          Sage
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => {
            onClose();
            router.push("/coach");
          }}
          data-testid="sage-open-full"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={onClose}
          data-testid="sage-close"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto py-3 space-y-4">
        {recentMessages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
            <SageOrb size={40} pulse />
            <p className="text-sm text-muted-foreground max-w-[280px]">
              {placeholderText}
            </p>
          </div>
        )}
        {recentMessages.map((msg) => (
          <CoachMessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            actions={msg.actions}
          />
        ))}
        {streamingContent && (
          <CoachMessageBubble
            role="assistant"
            content={streamingContent}
            isStreaming
          />
        )}
        {isSending && !streamingContent && <CoachTypingIndicator />}
      </div>

      <CoachInput onSend={handleSend} disabled={isStreaming || isSending} />
    </div>
  );
}
