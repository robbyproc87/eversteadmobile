"use client";

import { useState, useEffect } from "react";
import { CoachOrb } from "./CoachOrb";
import { COACHES, COACH_IDS } from "@/lib/coach/coach-definitions";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const INTRO_STORAGE_KEY = "everstead_coach_intro_seen";

interface CoachIntroFlowProps {
  onClose: () => void;
}

function CoachIntroContent({ onClose }: CoachIntroFlowProps) {
  const [step, setStep] = useState(0);
  const coachIds = COACH_IDS;

  const handleComplete = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(INTRO_STORAGE_KEY, "true");
    }
    onClose();
  };

  if (step === 0) {
    return (
      <div className="text-center space-y-6 py-4">
        <div className="flex justify-center gap-3">
          {coachIds.map((id) => (
            <CoachOrb key={id} coachId={id as string} size={32} />
          ))}
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Meet Your Coaching Team</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Everstead now has five specialized coaches, each with unique expertise to guide different areas of your life.
          </p>
        </div>
        <Button onClick={() => setStep(1)} data-testid="intro-next">
          Meet the Team
        </Button>
      </div>
    );
  }

  const coachIndex = step - 1;
  if (coachIndex < coachIds.length) {
    const coachId = coachIds[coachIndex] as string;
    const coach = COACHES[coachId];
    const isLast = coachIndex === coachIds.length - 1;

    return (
      <div className="text-center space-y-5 py-4">
        <CoachOrb coachId={coachId} size={56} />
        <div className="space-y-2">
          <h3
            className="text-lg font-semibold"
            style={{ color: coach.color }}
          >
            {coach.name}
          </h3>
          <p className="text-sm font-medium text-foreground/80">{coach.title}</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {coach.description}
          </p>
          <div className="flex flex-wrap justify-center gap-1.5 pt-2">
            {coach.domains.slice(0, 4).map((domain) => (
              <span
                key={domain}
                className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
              >
                {domain}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center gap-2">
          {coachIndex > 0 && (
            <Button variant="ghost" onClick={() => setStep(step - 1)} data-testid="intro-back">
              Back
            </Button>
          )}
          <Button
            onClick={() => {
              if (isLast) {
                handleComplete();
              } else {
                setStep(step + 1);
              }
            }}
            data-testid="intro-next"
          >
            {isLast ? "Get Started" : "Next"}
          </Button>
        </div>
        <div className="flex justify-center gap-1.5">
          {coachIds.map((id, i) => (
            <div
              key={id}
              className="w-2 h-2 rounded-full transition-all"
              style={{
                backgroundColor: i === coachIndex ? COACHES[id as string].color : "hsl(var(--muted-foreground) / 0.3)",
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return null;
}

export function CoachIntroDialog() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const seen = localStorage.getItem(INTRO_STORAGE_KEY);
      if (!seen) {
        const timer = setTimeout(() => setShow(true), 1500);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => {
          localStorage.setItem(INTRO_STORAGE_KEY, "true");
          setShow(false);
        }}
      />
      <div className="relative bg-background rounded-xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95">
        <Button
          size="icon"
          variant="ghost"
          className="absolute top-3 right-3"
          onClick={() => {
            localStorage.setItem(INTRO_STORAGE_KEY, "true");
            setShow(false);
          }}
          data-testid="intro-close"
        >
          <X className="h-4 w-4" />
        </Button>
        <CoachIntroContent onClose={() => setShow(false)} />
      </div>
    </div>
  );
}
