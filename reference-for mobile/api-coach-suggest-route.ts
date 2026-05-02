import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser, getProfile } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { assembleCoachContext } from "@/lib/coach/context-assembler";
import { canAccess } from "@/lib/plan/access";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SAGE_TONE = `You are Sage, a warm and wise personal development coach. Write in a natural, first-person voice. Be specific and draw from the user's actual data. Keep responses concise.`;

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const allowed = await canAccess(user.id, "ai_coaching");
  if (!allowed) {
    return NextResponse.json({ error: "upgrade_required" }, { status: 402 });
  }

  try {
    const body = await request.json();
    const { type, context: reqContext } = body;

    if (!type || typeof type !== "string") {
      return NextResponse.json({ error: "type is required" }, { status: 400 });
    }

    const profile = await getProfile(user.id);
    const userName = profile?.name || "there";
    const memberSince = profile?.created_at
      ? new Date(profile.created_at).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })
      : "recently";

    let prompt: string;

    switch (type) {
      case "weekly-story-day": {
        const { date } = reqContext || {};
        if (!date) {
          return NextResponse.json({ error: "date is required for weekly-story-day" }, { status: 400 });
        }
        const dayData = await fetchDayData(user.id, date);
        if (!dayData) {
          return NextResponse.json({
            suggestion: null,
            message: "No journal or planner data found for this day.",
          });
        }
        prompt = `Based on the following user data for ${date}, write a brief first-person narrative (3-5 sentences) summarizing how they lived that day. Draw from their journal entries, daily priorities, accomplishments, gratitude, and activities. Write in a warm, reflective tone — as if the user is telling a friend about their day. Focus on what felt meaningful, not just what happened. If there's limited data, write a shorter narrative and note it was a quieter day.\n\nUser's name: ${userName}\n\n${dayData}`;
        break;
      }
      case "journal-prompt": {
        const { contextString } = await assembleCoachContext(user.id, userName, memberSince);
        prompt = `Based on the user's recent context below, suggest a specific journal prompt for right now. Don't be generic ("write about your feelings") — be specific to their life. If they've been journaling about work stress, maybe prompt them to explore what success looks like. If they completed a big goal, prompt them to reflect on the journey. Keep the prompt to 1-2 sentences. Just the prompt, nothing else.\n\n${contextString}`;
        break;
      }
      case "gratitude-prompt": {
        const { contextString } = await assembleCoachContext(user.id, userName, memberSince);
        prompt = `Based on the user's day so far (from their context below), suggest a specific gratitude prompt that connects to something real in their life right now. One sentence only.\n\n${contextString}`;
        break;
      }
      case "te-suggestion": {
        const { category } = reqContext || {};
        if (!category) {
          return NextResponse.json({ error: "category is required for te-suggestion" }, { status: 400 });
        }
        const { contextString } = await assembleCoachContext(user.id, userName, memberSince);
        prompt = `Based on the user's recent reflections and past goals (from context below), suggest a specific and actionable Truly Exceptional goal for the "${category}" category. Make it concrete, measurable where possible, and connected to what they've been working on. One sentence only.\n\n${contextString}`;
        break;
      }
      case "trends-insight": {
        const trendsData = await fetchTrendsContext(user.id);
        prompt = `Based on the user's trends data below, provide ONE specific, actionable insight about their growth pattern. Be specific — reference actual numbers. Keep it to 2-3 sentences. Example: "Your weekly scores have been climbing steadily — from 5 to 7 over the past month. The weeks where you scored highest also had the most journal entries. There might be a connection worth exploring."\n\nUser: ${userName}\n\n${trendsData}`;
        break;
      }
      default:
        return NextResponse.json({ error: `Unknown suggest type: ${type}` }, { status: 400 });
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 256,
      system: SAGE_TONE,
      messages: [{ role: "user", content: prompt }],
    });

    const suggestion =
      response.content[0]?.type === "text" ? response.content[0].text.trim() : "";

    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error("Coach suggest error:", error);
    return NextResponse.json({ error: "Failed to generate suggestion" }, { status: 500 });
  }
}

async function fetchDayData(userId: string, dateStr: string): Promise<string | null> {
  const targetDate = new Date(dateStr + "T00:00:00.000Z");
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const [journalEntries, dailyPlan, meditationSessions, bookProgress] = await Promise.all([
    prisma.journalEntry.findMany({
      where: {
        userId,
        isPrivate: false,
        createdAt: { gte: targetDate, lt: nextDay },
      },
      select: { title: true, content: true, mood: true },
      take: 5,
    }),
    prisma.dailyPlan.findFirst({
      where: { userId, date: targetDate },
      include: {
        priorities: { orderBy: { ordinal: "asc" } },
        wentWells: { orderBy: { ordinal: "asc" } },
        gratitudes: { orderBy: { ordinal: "asc" } },
        todos: { orderBy: { ordinal: "asc" } },
      },
    }),
    prisma.meditationSession.findMany({
      where: { userId, startedAt: { gte: targetDate, lt: nextDay } },
      include: { track: { select: { title: true } } },
    }),
    prisma.bookProgress.findMany({
      where: { userId, loggedAt: { gte: targetDate, lt: nextDay } },
      include: { book: { select: { title: true } } },
    }),
  ]);

  const hasData = journalEntries.length > 0 || dailyPlan || meditationSessions.length > 0 || bookProgress.length > 0;
  if (!hasData) return null;

  const parts: string[] = [];

  if (dailyPlan?.dailyGoal) {
    parts.push(`Daily goal: "${dailyPlan.dailyGoal}"`);
  }

  const priorities = (dailyPlan?.priorities || [])
    .filter((p) => p.text)
    .map((p) => p.text);
  if (priorities.length > 0) {
    parts.push(`Priorities: ${priorities.join(", ")}`);
  }

  const completedTodos = (dailyPlan?.todos || []).filter((t) => t.completed).length;
  const totalTodos = (dailyPlan?.todos || []).length;
  if (totalTodos > 0) {
    parts.push(`Todos: ${completedTodos}/${totalTodos} completed`);
  }

  const wentWells = (dailyPlan?.wentWells || [])
    .filter((w) => w.text)
    .map((w) => w.text);
  if (wentWells.length > 0) {
    parts.push(`What went well: ${wentWells.join(", ")}`);
  }

  const gratitudes = (dailyPlan?.gratitudes || [])
    .filter((g) => g.text)
    .map((g) => g.text);
  if (gratitudes.length > 0) {
    parts.push(`Grateful for: ${gratitudes.join(", ")}`);
  }

  if (journalEntries.length > 0) {
    const journalSummaries = journalEntries.map((e) => {
      const title = e.title || "Untitled";
      const snippet = (e.content || "").slice(0, 200);
      const mood = e.mood ? ` (mood: ${e.mood})` : "";
      return `"${title}"${mood}: ${snippet}`;
    });
    parts.push(`Journal entries: ${journalSummaries.join("; ")}`);
  }

  if (meditationSessions.length > 0) {
    const totalMin = meditationSessions.reduce((acc, s) => {
      if (s.endedAt) {
        return acc + Math.floor((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000);
      }
      return acc;
    }, 0);
    parts.push(`Meditation: ${meditationSessions.length} session(s), ${totalMin} minutes total`);
  }

  if (bookProgress.length > 0) {
    const bookParts = bookProgress.map((p) => `${p.pagesRead} pages of "${p.book.title}"`);
    parts.push(`Reading: ${bookParts.join(", ")}`);
  }

  return parts.join("\n");
}

async function fetchTrendsContext(userId: string): Promise<string> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const [weeks, journalCount, meditations, bookPages, dailyPlans, tes] = await Promise.all([
    prisma.plannerWeek.findMany({
      where: { userId, weekStart: { gte: thirtyDaysAgo } },
      select: { weekStart: true, weekScore: true },
      orderBy: { weekStart: "asc" },
    }),
    prisma.journalEntry.count({
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.meditationSession.findMany({
      where: { userId, startedAt: { gte: thirtyDaysAgo }, endedAt: { not: null } },
      select: { startedAt: true, endedAt: true },
    }),
    prisma.bookProgress.aggregate({
      where: { userId, loggedAt: { gte: thirtyDaysAgo } },
      _sum: { pagesRead: true },
    }),
    prisma.dailyPlan.count({
      where: { userId, date: { gte: thirtyDaysAgo } },
    }),
    prisma.trulyExceptional.findMany({
      where: { week: { userId, weekStart: { gte: thirtyDaysAgo } }, text: { not: null } },
      select: { status: true },
    }),
  ]);

  const parts: string[] = [];

  const scoredWeeks = weeks.filter((w) => w.weekScore != null);
  if (scoredWeeks.length > 0) {
    const scores = scoredWeeks.map((w) => `${w.weekStart.toISOString().split("T")[0]}: ${w.weekScore}/10`);
    const avg = scoredWeeks.reduce((s, w) => s + (w.weekScore ?? 0), 0) / scoredWeeks.length;
    parts.push(`Weekly scores (last 30d): ${scores.join(", ")}. Average: ${avg.toFixed(1)}`);
  } else {
    parts.push("No weekly scores recorded in the last 30 days.");
  }

  parts.push(`Journal entries (30d): ${journalCount}`);

  const totalMedMin = meditations.reduce((sum, s) => {
    if (!s.endedAt) return sum;
    return sum + Math.floor((s.endedAt.getTime() - s.startedAt.getTime()) / 60000);
  }, 0);
  parts.push(`Meditation (30d): ${meditations.length} sessions, ${totalMedMin} total minutes`);
  parts.push(`Pages read (30d): ${bookPages._sum.pagesRead ?? 0}`);
  parts.push(`Planner days used (30d): ${dailyPlans}/30`);

  if (tes.length > 0) {
    const achieved = tes.filter((t) => t.status === "achieved").length;
    const missed = tes.filter((t) => t.status === "missed").length;
    const inProgress = tes.filter((t) => t.status === "in_progress").length;
    parts.push(`Truly Exceptionals (30d): ${achieved} achieved, ${inProgress} in progress, ${missed} missed out of ${tes.length} total`);
  }

  return parts.join("\n");
}
