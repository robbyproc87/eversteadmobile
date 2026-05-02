"use client";

import { useRef, useEffect } from "react";
import { CoachMessageBubble } from "./CoachMessageBubble";
import { CoachTypingIndicator } from "./CoachTypingIndicator";
import { CoachInput } from "./CoachInput";
import { CoachEmptyState } from "./CoachEmptyState";
import { CoachChatHeader } from "./CoachChatHeader";
import { getCoach } from "@/lib/coach/coach-definitions";
import type { CoachAction } from "@/lib/coach/coach-types";
import { usePlan } from "@/hooks/usePlan";
import { UpgradePrompt } from "@/components/plan/UpgradePrompt";

interface Message {
  id: string;
  role: string;
  content: string;
  actions?: CoachAction[] | null;
  createdAt?: string;
}

interface CoachChatAreaProps {
  messages: Message[];
  streamingContent: string;
  streamingActions?: CoachAction[];
  isStreaming: boolean;
  isSending: boolean;
  isThinking?: boolean;
  userName?: string;
  coachId?: string;
  onSend: (message: string) => void;
  isLoadingGreeting?: boolean;
}

export function CoachChatArea({
  messages,
  streamingContent,
  streamingActions,
  isStreaming,
  isSending,
  isThinking,
  userName,
  coachId = "sage",
  onSend,
  isLoadingGreeting,
}: CoachChatAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { isFree } = usePlan();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent, streamingActions]);

  const showEmpty = messages.length === 0 && !isStreaming && !streamingContent;
  const coach = getCoach(coachId);

  return (
    <div className="flex flex-col h-full" data-testid="coach-chat-area">
      <div className="hidden md:block">
        <CoachChatHeader coachId={coachId} />
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-6">
        {showEmpty ? (
          <CoachEmptyState userName={userName} coachId={coachId} isLoadingGreeting={isLoadingGreeting || isSending} />
        ) : (
          <>
            {messages.map((msg) => (
              <CoachMessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                createdAt={msg.createdAt}
                coachId={coachId}
                actions={msg.actions}
              />
            ))}
            {(streamingContent || (streamingActions && streamingActions.length > 0)) && (
              <CoachMessageBubble
                role="assistant"
                content={streamingContent}
                isStreaming={isStreaming}
                coachId={coachId}
                actions={streamingActions}
              />
            )}
            {isThinking && !streamingContent && (
              <CoachTypingIndicator coachId={coachId} />
            )}
            {isSending && !streamingContent && !isStreaming && !isThinking && (
              <CoachTypingIndicator coachId={coachId} />
            )}
          </>
        )}
      </div>

      {isFree ? (
        <div className="p-4 border-t" data-testid="coach-upgrade-prompt">
          <UpgradePrompt
            feature={`${coach.name} & AI Coaches`}
            description="Your coaches are waiting. Get unlimited conversations with all 5 AI coaches personalized to your goals."
          />
        </div>
      ) : (
        <CoachInput
          onSend={onSend}
          disabled={isStreaming || isSending}
          placeholder={`Message ${coach.name}...`}
        />
      )}
    </div>
  );
}
