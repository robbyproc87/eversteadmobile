"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Sun, Check, Pencil, Loader2 } from "lucide-react";

interface DailyMindfulness {
  id: string;
  awarenessRating: number;
  wellbeingRating: number;
}

const AWARENESS_LABELS = ["Scattered", "Distracted", "Neutral", "Present", "Deeply aware"];

export function DailyCheckIn() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [awareness, setAwareness] = useState(3);
  const [wellbeing, setWellbeing] = useState(5);

  const { data: checkin, isLoading } = useQuery<DailyMindfulness | null>({
    queryKey: ["/api/meditation/daily-checkin"],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { awarenessRating: number; wellbeingRating: number }) => {
      const res = await fetch("/api/meditation/daily-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meditation/daily-checkin"] });
      setIsEditing(false);
      toast({ title: "Check-in saved", description: "Your daily mindfulness check-in has been recorded." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to save check-in." });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({ awarenessRating: awareness, wellbeingRating: wellbeing });
  };

  const startEdit = () => {
    if (checkin) {
      setAwareness(checkin.awarenessRating);
      setWellbeing(checkin.wellbeingRating);
    }
    setIsEditing(true);
  };

  if (isLoading) return null;

  const completed = checkin && !isEditing;

  return (
    <Card data-testid="card-daily-checkin">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sun className="h-5 w-5 text-amber-500" />
            Daily Check-In
          </CardTitle>
          {completed && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs gap-1">
                <Check className="h-3 w-3" />
                Completed
              </Badge>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={startEdit} data-testid="button-checkin-edit">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {completed ? (
          <div className="flex gap-6" data-testid="checkin-completed">
            <div className="flex-1 space-y-1">
              <p className="text-xs text-muted-foreground">Awareness</p>
              <p className="text-sm font-medium">{checkin.awarenessRating}/5 — {AWARENESS_LABELS[checkin.awarenessRating - 1]}</p>
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-xs text-muted-foreground">Well-being</p>
              <p className="text-sm font-medium">{checkin.wellbeingRating}/10</p>
            </div>
          </div>
        ) : (
          <div className="space-y-5" data-testid="checkin-form">
            <div className="space-y-3">
              <label className="text-sm font-medium">Present-moment awareness</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    onClick={() => setAwareness(val)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                      awareness === val
                        ? "border-amber-500 bg-amber-500/10 text-foreground"
                        : "border-border hover:border-amber-500/50 text-muted-foreground"
                    }`}
                    data-testid={`button-awareness-${val}`}
                  >
                    {val}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{AWARENESS_LABELS[0]}</span>
                <span>{AWARENESS_LABELS[4]}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Subjective well-being</label>
                <span className="text-sm font-mono" data-testid="text-wellbeing-value">{wellbeing}</span>
              </div>
              <Slider
                value={[wellbeing]}
                onValueChange={([v]) => setWellbeing(v)}
                min={1}
                max={10}
                step={1}
                data-testid="slider-wellbeing"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Low</span>
                <span>Excellent</span>
              </div>
            </div>

            <div className="flex gap-3">
              {isEditing && (
                <Button variant="ghost" onClick={() => setIsEditing(false)} data-testid="button-checkin-form-cancel">
                  Cancel
                </Button>
              )}
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="flex-1"
                data-testid="button-checkin-save"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Save Check-In
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
