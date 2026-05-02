"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Type,
  PenLine,
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Minus,
  Strikethrough,
  Undo2,
  Redo2,
  ImageIcon,
  Sparkles,
  Mic,
  Pen,
  Pencil,
  Highlighter,
  Eraser,
  ChevronDown,
} from "lucide-react";
import type { Editor } from "@tiptap/react";

const PEN_COLORS = [
  { hex: "#1a1a1a", label: "Black" },
  { hex: "#4B5563", label: "Gray" },
  { hex: "#1D4ED8", label: "Blue" },
  { hex: "#DC2626", label: "Red" },
  { hex: "#16A34A", label: "Green" },
  { hex: "#9333EA", label: "Purple" },
  { hex: "#F59E0B", label: "Amber" },
  { hex: "#DB2777", label: "Pink" },
];

export type VoiceMode = "vtt" | "recording";

interface JournalBottomToolbarProps {
  mode: "type" | "write";
  onModeChange: (mode: "type" | "write") => void;
  editor: Editor | null;
  onAddPhoto?: () => void;
  onAIPrompt?: () => void;
  onMic?: () => void;
  isRecording?: boolean;
  micDisabled?: boolean;
  voiceMode?: VoiceMode;
  onVoiceModeChange?: (mode: VoiceMode) => void;
  recordingElapsed?: number;
  writeToolState?: {
    tool: "pen" | "pencil" | "highlighter" | "eraser";
    size: number;
    penColor: string;
    onToolChange: (tool: "pen" | "pencil" | "highlighter" | "eraser") => void;
    onSizeChange: (size: number) => void;
    onPenColorChange: (color: string) => void;
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
  };
  photoUploading?: boolean;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function JournalBottomToolbar({
  mode,
  onModeChange,
  editor,
  onAddPhoto,
  onAIPrompt,
  onMic,
  isRecording = false,
  micDisabled = false,
  voiceMode = "vtt",
  onVoiceModeChange,
  recordingElapsed = 0,
  writeToolState,
  photoUploading,
}: JournalBottomToolbarProps) {
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{ bottom: number; right: number } | null>(null);
  const chevronRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const openVoiceMenu = useCallback(() => {
    if (!chevronRef.current) return;
    const rect = chevronRef.current.getBoundingClientRect();
    setMenuPos({
      bottom: window.innerHeight - rect.top + 8,
      right: window.innerWidth - rect.right,
    });
    setShowVoiceMenu(true);
  }, []);

  useEffect(() => {
    if (!showVoiceMenu) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inMenu = menuRef.current?.contains(target);
      const inChevron = chevronRef.current?.contains(target);
      if (!inMenu && !inChevron) {
        setShowVoiceMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showVoiceMenu]);

  return (
    <div className="journal-bottom-toolbar" data-testid="journal-bottom-toolbar">
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          active={mode === "type"}
          onClick={() => onModeChange("type")}
          title="Type mode"
          testId="toolbar-mode-type"
        >
          <Type className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={mode === "write"}
          onClick={() => onModeChange("write")}
          title="Write mode"
          testId="toolbar-mode-write"
        >
          <PenLine className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <div className="h-5 w-px bg-white/10" />

      {mode === "type" && editor ? (
        <div className="flex items-center gap-0.5 overflow-x-auto">
          <ToolbarButton
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold (Ctrl+B)"
            testId="toolbar-bold"
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic (Ctrl+I)"
            testId="toolbar-italic"
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Strikethrough"
            testId="toolbar-strike"
          >
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("heading", { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            title="Heading 1"
            testId="toolbar-h1"
          >
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("heading", { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="Heading 2"
            testId="toolbar-h2"
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet List"
            testId="toolbar-bullet-list"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered List"
            testId="toolbar-ordered-list"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Blockquote"
            testId="toolbar-blockquote"
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={false}
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Horizontal Rule"
            testId="toolbar-hr"
          >
            <Minus className="h-4 w-4" />
          </ToolbarButton>
        </div>
      ) : mode === "write" && writeToolState ? (
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            active={writeToolState.tool === "pen"}
            onClick={() => writeToolState.onToolChange("pen")}
            title="Pen"
            testId="toolbar-pen"
          >
            <Pen className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={writeToolState.tool === "pencil"}
            onClick={() => writeToolState.onToolChange("pencil")}
            title="Pencil"
            testId="toolbar-pencil"
          >
            <Pencil className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={writeToolState.tool === "highlighter"}
            onClick={() => writeToolState.onToolChange("highlighter")}
            title="Highlighter"
            testId="toolbar-highlighter"
          >
            <Highlighter className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={writeToolState.tool === "eraser"}
            onClick={() => writeToolState.onToolChange("eraser")}
            title="Eraser"
            testId="toolbar-eraser"
          >
            <Eraser className="h-4 w-4" />
          </ToolbarButton>

          <div className="h-4 w-px bg-white/10 mx-0.5" />

          {PEN_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={c.label}
              onClick={() => writeToolState.onPenColorChange(c.hex)}
              disabled={writeToolState.tool === "eraser"}
              data-testid={`toolbar-color-${c.label.toLowerCase()}`}
              className={`h-5 w-5 rounded-full transition-all flex-shrink-0 ${
                writeToolState.penColor === c.hex && writeToolState.tool !== "eraser"
                  ? "ring-2 ring-white ring-offset-1 ring-offset-transparent scale-110"
                  : "opacity-70 hover:opacity-100 hover:scale-105"
              } ${writeToolState.tool === "eraser" ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
              style={{ backgroundColor: c.hex }}
            />
          ))}

          <div className="h-4 w-px bg-white/10 mx-0.5" />

          <div className="flex items-center gap-1.5 px-1">
            <span className="text-[10px] text-white/50 uppercase">Size</span>
            <Slider
              value={[writeToolState.size]}
              onValueChange={([v]) => writeToolState.onSizeChange(v)}
              min={1}
              max={20}
              step={1}
              className="w-14"
              data-testid="toolbar-size-slider"
            />
          </div>
        </div>
      ) : null}

      <div className="h-5 w-px bg-white/10" />

      <div className="flex items-center gap-0.5">
        {mode === "type" && editor ? (
          <>
            <ToolbarButton
              active={false}
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              title="Undo (Ctrl+Z)"
              testId="toolbar-undo"
            >
              <Undo2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              active={false}
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              title="Redo (Ctrl+Shift+Z)"
              testId="toolbar-redo"
            >
              <Redo2 className="h-4 w-4" />
            </ToolbarButton>
          </>
        ) : mode === "write" && writeToolState ? (
          <>
            <ToolbarButton
              active={false}
              onClick={writeToolState.onUndo}
              disabled={!writeToolState.canUndo}
              title="Undo (Ctrl+Z)"
              testId="toolbar-undo"
            >
              <Undo2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              active={false}
              onClick={writeToolState.onRedo}
              disabled={!writeToolState.canRedo}
              title="Redo (Ctrl+Shift+Z)"
              testId="toolbar-redo"
            >
              <Redo2 className="h-4 w-4" />
            </ToolbarButton>
          </>
        ) : null}

        <ToolbarButton
          active={false}
          onClick={onAddPhoto}
          disabled={photoUploading}
          title="Add photo"
          testId="toolbar-add-photo"
        >
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={false}
          onClick={onAIPrompt}
          title="AI writing prompt"
          testId="toolbar-ai-prompt"
        >
          <Sparkles className="h-4 w-4" />
        </ToolbarButton>

        <div className="flex items-center">
          <button
            type="button"
            onClick={onMic}
            disabled={micDisabled}
            title={micDisabled ? "Editor loading..." : isRecording ? "Stop recording" : voiceMode === "vtt" ? "Voice to Text" : "Voice Recording"}
            className={`flex items-center justify-center h-8 rounded-l-md pl-2 pr-1 transition-colors ${
              isRecording
                ? "bg-red-500/30 text-white"
                : micDisabled
                  ? "text-white/30 cursor-not-allowed"
                  : "text-white/70 hover:text-white hover:bg-white/10 cursor-pointer"
            }`}
            data-testid="toolbar-mic"
          >
            <span className="relative flex items-center gap-1">
              <Mic className="h-4 w-4" />
              {isRecording && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              )}
              {isRecording && voiceMode === "recording" && (
                <span className="text-[11px] font-mono text-red-300 ml-1" data-testid="recording-timer">
                  {formatElapsed(recordingElapsed)}
                </span>
              )}
            </span>
          </button>
          <button
            ref={chevronRef}
            type="button"
            onClick={() => { if (!isRecording) openVoiceMenu(); }}
            disabled={isRecording}
            title={isRecording ? "Stop recording to change mode" : "Voice mode options"}
            className={`flex items-center justify-center h-8 w-5 rounded-r-md transition-colors ${
              isRecording
                ? "bg-red-500/30 text-white/40 cursor-not-allowed"
                : "text-white/70 hover:text-white hover:bg-white/10 cursor-pointer"
            }`}
            data-testid="toolbar-mic-menu"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        {showVoiceMenu && menuPos && typeof document !== "undefined" && createPortal(
          <div
            ref={menuRef}
            className="fixed bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[160px] z-[9999]"
            style={{ bottom: menuPos.bottom, right: menuPos.right }}
          >
            <button
              type="button"
              onClick={() => { onVoiceModeChange?.("vtt"); setShowVoiceMenu(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2 ${
                voiceMode === "vtt" ? "text-primary font-medium" : "text-foreground"
              }`}
              data-testid="voice-mode-vtt"
            >
              <Type className="h-3.5 w-3.5" />
              Voice to Text
            </button>
            <button
              type="button"
              onClick={() => { onVoiceModeChange?.("recording"); setShowVoiceMenu(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2 ${
                voiceMode === "recording" ? "text-primary font-medium" : "text-foreground"
              }`}
              data-testid="voice-mode-recording"
            >
              <Mic className="h-3.5 w-3.5" />
              Voice Recording
            </button>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  children,
  active,
  onClick,
  disabled,
  title,
  testId,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center justify-center h-8 w-8 rounded-md transition-colors ${
        active
          ? "bg-white/20 text-white"
          : "text-white/70 hover:text-white hover:bg-white/10"
      } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
      data-testid={testId}
    >
      {children}
    </button>
  );
}
