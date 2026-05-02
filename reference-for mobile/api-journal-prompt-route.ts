import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, getProfile } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limiter";
import { canAccess } from "@/lib/plan/access";
import { assembleCoachContext } from "@/lib/coach/context-assembler";
import { prisma } from "@/lib/prisma";
import { JOURNAL_TEMPLATES } from "@/lib/journal/templates";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const VALID_TEMPLATE_IDS = new Set(JOURNAL_TEMPLATES.map((t) => t.id));

function getTimeOfDay(tz?: string | null): string {
  const now = tz
    ? new Date(new Date().toLocaleString("en-US", { timeZone: tz }))
    : new Date();
  const hour = now.getHours();
  if (hour < 6) return "late night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const allowed = await canAccess(user.id, "ai_coaching");
  if (!allowed) {
    return NextResponse.json({ error: "Pro feature", code: "PLAN_LIMIT" }, { status: 402 });
  }

  const rateLimitResult = checkRateLimit(`journal-prompt:${user.id}`, 10, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rateLimitResult.retryAfter },
      { status: 429 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const mood = body.mood || null;
    const rawTemplateId: unknown = body.templateId;
    const templateId =
      typeof rawTemplateId === "string" && VALID_TEMPLATE_IDS.has(rawTemplateId)
        ? rawTemplateId
        : null;

    const [profile, dbUser] = await Promise.all([
      getProfile(user.id),
      prisma.user.findUnique({ where: { id: user.id }, select: { tz: true } }),
    ]);

    const userName = profile?.name || user.email || "there";
    const memberSince = profile?.created_at
      ? new Date(profile.created_at).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })
      : "recently";
    const timeOfDay = getTimeOfDay(dbUser?.tz);

    let contextString = "";
    try {
      const ctx = await assembleCoachContext(user.id, userName, memberSince, "journal");
      contextString = ctx.contextString;
    } catch {
      contextString = "";
    }

    const templateName =
      templateId && templateId !== "blank"
        ? JOURNAL_TEMPLATES.find((t) => t.id === templateId)?.name ?? templateId
        : null;

    const systemPrompt = `You are Sage, the lead coach on the Everstead self-development platform. Your job right now is to generate ONE personalized journal writing prompt for the user.

The prompt should:
- Be warm, thoughtful, and specific to the user's situation
- Be a single question or invitation (1-2 sentences max)
- Feel natural and conversational, not clinical
- Encourage reflection, insight, or gratitude
- Take into account the time of day, their mood (if provided), and the template they chose (if any)

Context about the user:
${contextString || "No additional context available."}

Current time of day: ${timeOfDay}
${mood ? `Current mood: ${mood}` : "No mood selected yet."}
${templateName ? `Chosen template: ${templateName}` : "No specific template chosen."}

Return ONLY the prompt text — no quotes, no prefixes, no explanations.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 150,
      messages: [{ role: "user", content: "Generate a personalized journal prompt for me right now." }],
      system: systemPrompt,
    });

    const promptText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    return NextResponse.json({ prompt: promptText });
  } catch (error) {
    console.error("Journal prompt error:", error);
    return NextResponse.json({ error: "Failed to generate prompt" }, { status: 500 });
  }
}
