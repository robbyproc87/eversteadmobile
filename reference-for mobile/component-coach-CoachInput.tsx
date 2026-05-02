"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { SendHorizonal } from "lucide-react";

interface CoachInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function CoachInput({ onSend, disabled, placeholder = "Message Sage..." }: CoachInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex items-end gap-2 p-4 border-t bg-background" data-testid="coach-input-area">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          adjustHeight();
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none border rounded-xl px-4 py-2.5 text-sm bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60 disabled:opacity-50"
        data-testid="coach-message-input"
      />
      <Button
        size="icon"
        onClick={handleSubmit}
        disabled={!value.trim() || disabled}
        data-testid="coach-send-button"
      >
        <SendHorizonal className="h-4 w-4" />
      </Button>
    </div>
  );
}
