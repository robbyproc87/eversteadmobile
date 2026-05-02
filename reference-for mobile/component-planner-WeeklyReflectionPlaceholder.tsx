"use client";

import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface WeeklyReflectionPlaceholderProps {
  onUnlock: () => void;
}

export default function WeeklyReflectionPlaceholder({ onUnlock }: WeeklyReflectionPlaceholderProps) {
  return (
    <div className="flex items-center justify-center py-12 px-4" data-testid="weekly-reflection-placeholder">
      <Card className="max-w-lg w-full p-8 text-center space-y-5">
        <div className="flex justify-center">
          <div className="rounded-full bg-muted p-3">
            <Clock className="h-6 w-6 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="text-lg font-semibold" data-testid="text-placeholder-heading">
            Weekly Reflection
          </h3>
          <p className="text-sm text-muted-foreground">
            Your reflection space opens Saturday
          </p>
        </div>

        <div className="text-left space-y-3 text-sm text-muted-foreground">
          <p>
            Robin Sharma's Sunday Ritual is a powerful weekly practice. When Saturday arrives, you'll work through these steps:
          </p>
          <div className="space-y-2 pl-1">
            <p>
              <span className="font-medium text-foreground">1. Weekly Story</span> — Write the narrative of how you lived each day
            </p>
            <p>
              <span className="font-medium text-foreground">2. Past Week Exceptionals</span> — Unpack the goals you set last week
            </p>
            <p>
              <span className="font-medium text-foreground">3. Weekly Review</span> — Score your week and set next week's direction
            </p>
          </div>
          <p>
            Complete them in order for the most impactful reflection.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={onUnlock}
          data-testid="button-start-early"
        >
          Start Early
        </Button>
      </Card>
    </div>
  );
}
