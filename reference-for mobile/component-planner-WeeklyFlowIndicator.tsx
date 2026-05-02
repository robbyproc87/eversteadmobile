"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface FlowStep {
  id: string;
  label: string;
  completed: boolean;
}

interface WeeklyFlowIndicatorProps {
  steps: FlowStep[];
  activeStepId: string;
}

export default function WeeklyFlowIndicator({ steps, activeStepId }: WeeklyFlowIndicatorProps) {
  return (
    <div className="px-4 py-2 border-b hidden sm:block" data-testid="weekly-flow-indicator">
      <div className="flex items-center justify-center gap-0 max-w-md mx-auto">
        {steps.map((step, i) => {
          const isActive = step.id === activeStepId;
          return (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "flex items-center justify-center rounded-full text-xs font-medium w-7 h-7 transition-colors",
                    step.completed
                      ? "bg-green-500/20 text-green-600 dark:text-green-400"
                      : isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  )}
                  data-testid={`flow-step-${step.id}`}
                >
                  {step.completed ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span
                  className={cn(
                    "text-[10px] whitespace-nowrap",
                    isActive ? "text-foreground font-medium" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className="w-8 h-px bg-border mx-1 mb-4" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
