"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Star, ChevronRight, Check, ArrowDown, ArrowUp, Minus } from "lucide-react";

export interface QualityMetrics {
  attentionQuality?: number;
  mindWanderingCount?: number;
  emotionalTurbulence?: number;
  reactivity?: number;
  tensionAfter?: number;
  stressAfter?: number;
  insightText?: string;
  insightScore?: number;
  rating?: number;
}

interface PostSessionReviewProps {
  open: boolean;
  onComplete: (metrics: QualityMetrics) => void;
  onDismiss: () => void;
  meditationType?: string;
  sessionDuration: number;
  tensionBefore?: number;
  stressBefore?: number;
}

const ATTENTION_LABELS = [
  "Very scattered",
  "Mostly distracted",
  "Mixed focus",
  "Mostly focused",
  "Deep focus",
];

const INSIGHT_LABELS = [
  "No particular insights",
  "Subtle observation",
  "Clear insight",
  "Transformative realization",
];

export function PostSessionReview({
  open,
  onComplete,
  onDismiss,
  meditationType,
  sessionDuration,
  tensionBefore,
  stressBefore,
}: PostSessionReviewProps) {
  const [step, setStep] = useState(0);
  const [metrics, setMetrics] = useState<QualityMetrics>({});

  const totalSteps = 5;

  const handleNext = () => {
    if (step < totalSteps - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleFinish = () => {
    onComplete(metrics);
    setStep(0);
    setMetrics({});
  };

  const handleDismiss = () => {
    onDismiss();
    setStep(0);
    setMetrics({});
  };

  const update = (partial: Partial<QualityMetrics>) => {
    setMetrics((prev) => ({ ...prev, ...partial }));
  };

  const renderShiftArrow = (before: number | undefined, after: number | undefined) => {
    if (before === undefined || after === undefined) return null;
    const diff = after - before;
    if (diff < 0) return <ArrowDown className="h-4 w-4 text-green-500" />;
    if (diff > 0) return <ArrowUp className="h-4 w-4 text-red-400" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && handleDismiss()}>
      <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl" data-testid="post-session-review">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-center">
            {step < totalSteps - 1 ? "Session Review" : "Summary"}
          </SheetTitle>
          <div className="flex justify-center gap-1.5 pt-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-8 rounded-full transition-colors ${
                  i <= step ? "bg-purple-500" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </SheetHeader>

        <div className="py-6 min-h-[280px]">
          {step === 0 && (
            <div className="space-y-5" data-testid="step-attention">
              <h3 className="text-lg font-medium text-center">Quality of Attention</h3>
              <p className="text-sm text-muted-foreground text-center">
                How well were you able to sustain focus?
              </p>
              <div className="grid grid-cols-5 gap-2">
                {ATTENTION_LABELS.map((label, i) => {
                  const val = i + 1;
                  return (
                    <button
                      key={val}
                      onClick={() => update({ attentionQuality: val })}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        metrics.attentionQuality === val
                          ? "border-purple-500 bg-purple-500/10 text-foreground"
                          : "border-border hover:border-purple-500/50 text-muted-foreground"
                      }`}
                      data-testid={`button-attention-${val}`}
                    >
                      <div className="text-xl font-semibold">{val}</div>
                      <div className="text-[10px] mt-1 leading-tight">{label}</div>
                    </button>
                  );
                })}
              </div>
              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm text-muted-foreground">Mind wandering count (optional)</label>
                  <span className="text-sm font-mono">{metrics.mindWanderingCount ?? "—"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => update({ mindWanderingCount: Math.max(0, (metrics.mindWanderingCount ?? 0) - 1) })}
                    data-testid="button-wandering-minus"
                  >
                    -
                  </Button>
                  <Slider
                    value={[metrics.mindWanderingCount ?? 0]}
                    onValueChange={([v]) => update({ mindWanderingCount: v })}
                    min={0}
                    max={50}
                    step={1}
                    className="flex-1"
                    data-testid="slider-wandering"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => update({ mindWanderingCount: Math.min(50, (metrics.mindWanderingCount ?? 0) + 1) })}
                    data-testid="button-wandering-plus"
                  >
                    +
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6" data-testid="step-difficulty">
              <h3 className="text-lg font-medium text-center">Relationship to Difficulty</h3>
              <p className="text-sm text-muted-foreground text-center">
                How did you relate to challenging moments?
              </p>
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Emotional Turbulence</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val}
                        onClick={() => update({ emotionalTurbulence: val })}
                        className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                          metrics.emotionalTurbulence === val
                            ? "border-purple-500 bg-purple-500/10"
                            : "border-border hover:border-purple-500/50"
                        }`}
                        data-testid={`button-turbulence-${val}`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Very calm</span>
                    <span>Very turbulent</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Reactivity</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val}
                        onClick={() => update({ reactivity: val })}
                        className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                          metrics.reactivity === val
                            ? "border-purple-500 bg-purple-500/10"
                            : "border-border hover:border-purple-500/50"
                        }`}
                        data-testid={`button-reactivity-${val}`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Non-reactive</span>
                    <span>Very reactive</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5" data-testid="step-embodied">
              <h3 className="text-lg font-medium text-center">Embodied State</h3>
              <p className="text-sm text-muted-foreground text-center">
                How does your body feel now compared to before?
              </p>
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium">Body Tension (After)</label>
                    <div className="flex items-center gap-2">
                      {tensionBefore !== undefined && (
                        <span className="text-xs text-muted-foreground">Before: {tensionBefore}</span>
                      )}
                      {renderShiftArrow(tensionBefore, metrics.tensionAfter)}
                      <span className="text-sm font-mono" data-testid="text-tension-after">{metrics.tensionAfter ?? "—"}</span>
                    </div>
                  </div>
                  <Slider
                    value={[metrics.tensionAfter ?? tensionBefore ?? 5]}
                    onValueChange={([v]) => update({ tensionAfter: v })}
                    min={1}
                    max={10}
                    step={1}
                    data-testid="slider-tension-after"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Fully relaxed</span>
                    <span>Very tense</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium">Stress / Agitation (After)</label>
                    <div className="flex items-center gap-2">
                      {stressBefore !== undefined && (
                        <span className="text-xs text-muted-foreground">Before: {stressBefore}</span>
                      )}
                      {renderShiftArrow(stressBefore, metrics.stressAfter)}
                      <span className="text-sm font-mono" data-testid="text-stress-after">{metrics.stressAfter ?? "—"}</span>
                    </div>
                  </div>
                  <Slider
                    value={[metrics.stressAfter ?? stressBefore ?? 5]}
                    onValueChange={([v]) => update({ stressAfter: v })}
                    min={1}
                    max={10}
                    step={1}
                    data-testid="slider-stress-after"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Calm</span>
                    <span>Very stressed</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5" data-testid="step-insight">
              <h3 className="text-lg font-medium text-center">Insight & Learning</h3>
              <p className="text-sm text-muted-foreground text-center">
                Did any insights arise during your session?
              </p>
              <Textarea
                placeholder="Describe any insights, observations, or realizations..."
                value={metrics.insightText ?? ""}
                onChange={(e) => update({ insightText: e.target.value })}
                className="min-h-[100px] resize-none"
                data-testid="textarea-insight"
              />
              <div className="space-y-2">
                <label className="text-sm font-medium">Depth of insight</label>
                <div className="grid grid-cols-4 gap-2">
                  {INSIGHT_LABELS.map((label, i) => (
                    <button
                      key={i}
                      onClick={() => update({ insightScore: i })}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        metrics.insightScore === i
                          ? "border-purple-500 bg-purple-500/10 text-foreground"
                          : "border-border hover:border-purple-500/50 text-muted-foreground"
                      }`}
                      data-testid={`button-insight-${i}`}
                    >
                      <div className="text-lg font-semibold">{i}</div>
                      <div className="text-[10px] mt-1 leading-tight">{label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5" data-testid="step-summary">
              <h3 className="text-lg font-medium text-center">Session Summary</h3>
              {meditationType && (
                <p className="text-sm text-muted-foreground text-center">{meditationType} · {Math.round(sessionDuration / 60)} min</p>
              )}
              <div className="space-y-3 rounded-xl bg-muted/50 p-4">
                {metrics.attentionQuality && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Attention</span>
                    <span>{metrics.attentionQuality}/5 — {ATTENTION_LABELS[metrics.attentionQuality - 1]}</span>
                  </div>
                )}
                {metrics.emotionalTurbulence && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Turbulence</span>
                    <span>{metrics.emotionalTurbulence}/5</span>
                  </div>
                )}
                {metrics.reactivity && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Reactivity</span>
                    <span>{metrics.reactivity}/5</span>
                  </div>
                )}
                {metrics.tensionAfter !== undefined && tensionBefore !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tension</span>
                    <span className="flex items-center gap-1">
                      {tensionBefore} → {metrics.tensionAfter}
                      {renderShiftArrow(tensionBefore, metrics.tensionAfter)}
                    </span>
                  </div>
                )}
                {metrics.stressAfter !== undefined && stressBefore !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Stress</span>
                    <span className="flex items-center gap-1">
                      {stressBefore} → {metrics.stressAfter}
                      {renderShiftArrow(stressBefore, metrics.stressAfter)}
                    </span>
                  </div>
                )}
                {metrics.insightScore !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Insight</span>
                    <span>{INSIGHT_LABELS[metrics.insightScore]}</span>
                  </div>
                )}
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">Overall rating</p>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button
                      key={r}
                      onClick={() => update({ rating: r })}
                      className="p-1"
                      data-testid={`button-summary-rating-${r}`}
                    >
                      <Star
                        className={`h-7 w-7 transition-colors ${
                          metrics.rating && r <= metrics.rating
                            ? "text-yellow-500 fill-current"
                            : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2 pb-4">
          {step > 0 && step < totalSteps - 1 && (
            <Button variant="ghost" onClick={handleBack} data-testid="button-review-back">
              Back
            </Button>
          )}
          <div className="flex-1" />
          {step < totalSteps - 1 ? (
            <>
              <Button variant="ghost" onClick={handleNext} data-testid="button-review-skip">
                Skip
              </Button>
              <Button onClick={handleNext} data-testid="button-review-next">
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          ) : (
            <Button onClick={handleFinish} className="bg-purple-600 hover:bg-purple-500" data-testid="button-review-finish">
              <Check className="h-4 w-4 mr-2" />
              Save & Finish
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
