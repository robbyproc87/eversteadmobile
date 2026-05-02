"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from "lucide-react";

interface CalendarEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  event?: {
    id: string;
    title: string;
    description: string | null;
    start: string;
    end: string;
    eversteadOwned: boolean;
  };
  defaultStart?: string;
  defaultEnd?: string;
  dateStr: string;
}

function toLocalDateTimeInput(dateStr: string): string {
  const d = new Date(dateStr);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export function CalendarEventDialog({
  open,
  onOpenChange,
  mode,
  event,
  defaultStart,
  defaultEnd,
  dateStr,
}: CalendarEventDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [title, setTitle] = useState(event?.title || "");
  const [description, setDescription] = useState(event?.description || "");
  const [startTime, setStartTime] = useState(
    event?.start ? toLocalDateTimeInput(event.start) : defaultStart || ""
  );
  const [endTime, setEndTime] = useState(
    event?.end ? toLocalDateTimeInput(event.end) : defaultEnd || ""
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const startISO = new Date(startTime).toISOString();
      const endISO = new Date(endTime).toISOString();
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      if (mode === "create") {
        const res = await fetch("/api/calendar/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description, start: startISO, end: endISO, timeZone }),
        });
        if (!res.ok) throw new Error("Failed to create event");
        return res.json();
      } else {
        const res = await fetch(`/api/calendar/events/${event!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description, start: startISO, end: endISO, timeZone }),
        });
        if (!res.ok) throw new Error("Failed to update event");
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      onOpenChange(false);
      toast({ title: mode === "create" ? "Event created" : "Event updated" });
    },
    onError: () => {
      toast({ variant: "destructive", title: `Failed to ${mode === "create" ? "create" : "update"} event` });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/calendar/events/${event!.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete event");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      onOpenChange(false);
      toast({ title: "Event removed" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Failed to remove event" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-calendar-event">
        <DialogHeader>
          <DialogTitle data-testid="text-event-dialog-title">
            {mode === "create" ? "New Event" : "Edit Event"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs text-muted-foreground">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              data-testid="input-event-title"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Start</label>
              <Input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                data-testid="input-event-start"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">End</label>
              <Input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                data-testid="input-event-end"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              data-testid="input-event-description"
            />
          </div>
        </div>

        <DialogFooter className="flex items-center gap-2">
          {mode === "edit" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="text-destructive hover:text-destructive mr-auto gap-1"
              data-testid="button-delete-event"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Remove
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-event"
          >
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !title.trim() || !startTime || !endTime}
            className="gap-1"
            data-testid="button-save-event"
          >
            {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {mode === "create" ? "Create" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
