"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { CoachOrb } from "./CoachOrb";
import { getCoach } from "@/lib/coach/coach-definitions";
import { evaluateNudges, type NudgeContext, type NudgeData } from "@/lib/coach/nudge-engine";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NudgeToast() {
  const pathname = usePathname();
  const [nudge, setNudge] = useState<NudgeData | null>(null);
  const [visible, setVisible] = useState(false);
  const fetchedRef = useRef<string | null>(null);

  const pageName = pathname === "/"
    ? "Today"
    : pathname.startsWith("/planner")
      ? "Planner"
      : pathname.startsWith("/journal")
        ? "Journal"
        : pathname.startsWith("/meditation")
          ? "Meditation"
          : pathname.startsWith("/growth/books")
            ? "Books"
            : pathname.startsWith("/growth/courses")
              ? "Courses"
              : pathname.startsWith("/trends")
                ? "Trends"
                : pathname.slice(1);

  useEffect(() => {
    if (pathname === "/coach") return;
    if (fetchedRef.current === pathname) return;
    fetchedRef.current = pathname;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/coach/nudge?page=${encodeURIComponent(pageName)}`);
        if (!res.ok) return;
        const data = await res.json();

        const result = evaluateNudges(data.context as NudgeContext, data.proactivityLevel);
        if (result) {
          setNudge(result);
          setVisible(true);
        }
      } catch {
        // silently fail
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [pathname, pageName]);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        setVisible(false);
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!nudge || !visible) return null;

  const sageCoach = getCoach("sage");

  return (
    <div
      className="fixed bottom-20 right-6 z-30 max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300"
      data-testid="nudge-toast"
    >
      <div className="bg-card border rounded-xl shadow-lg p-4">
        <div className="flex items-start gap-3">
          <CoachOrb coachId="sage" size={28} />
          <div className="flex-1 min-w-0">
            <p
              className="text-xs font-semibold mb-1"
              style={{ color: sageCoach.color }}
            >
              {sageCoach.name}
            </p>
            <p className="text-sm text-foreground/80 leading-relaxed">
              {nudge.message}
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="shrink-0 h-6 w-6"
            onClick={() => setVisible(false)}
            data-testid="nudge-dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
