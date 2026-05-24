import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { api, type BillingStatus } from "./api";
import { useAuth } from "@/contexts/AuthContext";

export const PRO_FEATURES = [
  "ai_coaching",
  "ai_meditation",
  "life_architecture_edit",
  "unlimited_journal",
  "meditation_metrics",
  "ambient_sounds",
  "cross_coach_reference",
  "pre_post_checkin",
] as const;

export type ProFeature = (typeof PRO_FEATURES)[number];

export const FREE_JOURNAL_LIMIT_PER_MONTH = 30;

export interface PlanInfo {
  plan: string;
  isPro: boolean;
  isTrial: boolean;
  trialDaysLeft: number;
  trialEndsAt: string | null;
  canAccess: (feature: ProFeature | string) => boolean;
  loading: boolean;
  billing: BillingStatus | undefined;
}

function computeTrialDays(trialEndsAt: string | null | undefined): number {
  if (!trialEndsAt) return 0;
  const end = new Date(trialEndsAt).getTime();
  if (Number.isNaN(end)) return 0;
  const diffMs = end - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function usePlan(): PlanInfo {
  const { session } = useAuth();
  const isPreview = session?.access_token === "dev-bypass";

  const billingQuery = useQuery<BillingStatus>({
    queryKey: ["billing", "status"],
    queryFn: api.getBillingStatus,
    enabled: !!session && !isPreview,
    staleTime: 60 * 1000,
    retry: 1,
  });

  return useMemo<PlanInfo>(() => {
    const billing = billingQuery.data;
    const plan = (billing?.plan ?? "free").toLowerCase();
    const trialEndsAt = billing?.trialEndsAt ?? null;
    const trialDaysLeft = computeTrialDays(trialEndsAt);
    const isTrial = plan === "trial" || (!!trialEndsAt && trialDaysLeft > 0);
    const isPro = plan === "pro" || plan === "premium" || billing?.active === true || isTrial;

    return {
      plan,
      isPro,
      isTrial,
      trialDaysLeft,
      trialEndsAt,
      canAccess: () => isPro,
      loading: billingQuery.isLoading,
      billing,
    };
  }, [billingQuery.data, billingQuery.isLoading]);
}

export const CHECKOUT_URL = "https://my.everstead.app/billing/checkout";
