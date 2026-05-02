"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import Image from "@tiptap/extension-image";
import { Paragraph } from "@tiptap/extension-paragraph";
import { useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";

const ParagraphWithPlaceholder = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      "data-ph": {
        default: null,
        keepOnSplit: false,
        parseHTML: (el) => el.getAttribute("data-ph") || null,
        renderHTML: (attrs) => {
          if (!attrs["data-ph"]) return {};
          return { "data-ph": attrs["data-ph"] };
        },
      },
    };
  },
});

interface JournalTiptapEditorProps {
  initialContent: Record<string, unknown> | null;
  onUpdate: (json: Record<string, unknown>, plainText: string) => void;
  onEditorReady?: (editor: Editor) => void;
  placeholder?: string;
  autoFocus?: boolean;
  editable?: boolean;
  editorRef?: React.MutableRefObject<Editor | null>;
}

export function JournalTiptapEditor({
  initialContent,
  onUpdate,
  onEditorReady,
  placeholder = "Start writing your thoughts...",
  autoFocus = true,
  editable = true,
  editorRef,
}: JournalTiptapEditorProps) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const onEditorReadyRef = useRef(onEditorReady);
  onEditorReadyRef.current = onEditorReady;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        paragraph: false,
        heading: { levels: [1, 2] },
        horizontalRule: {},
        blockquote: {},
        bulletList: {},
        orderedList: {},
        bold: {},
        italic: {},
        strike: {},
      }),
      ParagraphWithPlaceholder,
      Placeholder.configure({
        placeholder: ({ node }) => {
          const perNode = (node.attrs as Record<string, unknown>)["data-ph"];
          if (typeof perNode === "string" && perNode) return perNode;
          return placeholder;
        },
        showOnlyCurrent: true,
        includeChildren: false,
      }),
      Typography,
      Image.configure({ inline: false, allowBase64: true }),
    ],
    content: initialContent || { type: "doc", content: [{ type: "paragraph" }] },
    editable,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        class: "journal-tiptap-content",
        "data-testid": "tiptap-editor",
      },
    },
    onCreate: ({ editor: ed }) => {
      if (editorRef) editorRef.current = ed;
      onEditorReadyRef.current?.(ed);
    },
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON();
      const text = ed.getText();
      onUpdateRef.current(json, text);
    },
  });

  useEffect(() => {
    if (editorRef && editor) {
      editorRef.current = editor;
    }
  }, [editor, editorRef]);

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  if (!editor) return null;

  return <EditorContent editor={editor} />;
}
