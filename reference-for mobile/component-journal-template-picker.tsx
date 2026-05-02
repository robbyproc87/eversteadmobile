"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Sunrise,
  Moon,
  Zap,
  Clock,
} from "lucide-react";
import { JOURNAL_TEMPLATES } from "@/lib/journal/templates";
import type { JournalTemplate } from "@/lib/journal/templates";

const ICON_MAP: Record<string, React.ElementType> = {
  "file-text": FileText,
  sunrise: Sunrise,
  moon: Moon,
  zap: Zap,
};

const STORAGE_KEY = "everstead-default-journal-template";

export function getDefaultTemplate(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setDefaultTemplate(templateId: string | null) {
  if (typeof window === "undefined") return;
  if (templateId) {
    localStorage.setItem(STORAGE_KEY, templateId);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

interface TemplatePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (template: JournalTemplate) => void;
}

export function TemplatePicker({ open, onClose, onSelect }: TemplatePickerProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" data-testid="template-picker-dialog">
        <DialogHeader>
          <DialogTitle className="text-xl font-serif">Choose a Template</DialogTitle>
          <DialogDescription>
            Pick a structure for your entry, or start with a blank page.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 mt-2">
          {JOURNAL_TEMPLATES.map((template) => {
            const Icon = ICON_MAP[template.icon] || FileText;
            return (
              <button
                key={template.id}
                onClick={() => onSelect(template)}
                className="flex flex-col items-start gap-2 p-4 rounded-xl border bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors text-left group"
                data-testid={`template-card-${template.id}`}
              >
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Icon className="h-4.5 w-4.5 text-primary" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium leading-tight">{template.name}</p>
                  <p className="text-xs text-muted-foreground leading-snug">{template.description}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
                  <Clock className="h-3 w-3" />
                  {template.estimatedMinutes > 0 ? `~${template.estimatedMinutes} min` : "Instant"}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const blank = JOURNAL_TEMPLATES.find((t) => t.id === "blank");
              if (blank) onSelect(blank);
            }}
            className="text-muted-foreground"
            data-testid="button-skip-template"
          >
            Skip — just open
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
