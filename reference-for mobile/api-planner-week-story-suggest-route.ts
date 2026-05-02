import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limiter";

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateLimitResult = checkRateLimit(`planner-suggest:${user.id}`, 20, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rateLimitResult.retryAfter },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { date, weekId } = body;

    if (!date || !weekId) {
      return NextResponse.json({ error: "date and weekId are required" }, { status: 400 });
    }

    const week = await prisma.plannerWeek.findFirst({
      where: { id: weekId, userId: user.id },
    });
    if (!week) {
      return NextResponse.json({ error: "Planner week not found" }, { status: 404 });
    }

    const targetDate = new Date(date + "T00:00:00.000Z");
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const [journalEntries, dailyPlan] = await Promise.all([
      prisma.journalEntry.findMany({
        where: {
          userId: user.id,
          isPrivate: false,
          createdAt: { gte: targetDate, lt: nextDay },
        },
        select: { title: true, content: true },
        take: 5,
      }),
      prisma.dailyPlan.findFirst({
        where: { userId: user.id, date: targetDate },
        include: {
          priorities: { orderBy: { ordinal: "asc" } },
          wentWells: { orderBy: { ordinal: "asc" } },
          gratitudes: { orderBy: { ordinal: "asc" } },
          todos: { orderBy: { ordinal: "asc" } },
        },
      }),
    ]);

    const hasData = journalEntries.length > 0 || dailyPlan;

    if (!hasData) {
      return NextResponse.json({
        suggestion: null,
        message: "No journal or planner data found for this day. Write your own story!",
      });
    }

    const parts: string[] = [];

    if (dailyPlan?.dailyGoal) {
      parts.push(`Your goal for the day was: "${dailyPlan.dailyGoal}".`);
    }

    const completedPriorities = (dailyPlan?.priorities || [])
      .filter((p: { text: string | null }) => p.text)
      .map((p: { text: string | null }) => p.text);
    if (completedPriorities.length > 0) {
      parts.push(`You focused on these priorities: ${completedPriorities.join(", ")}.`);
    }

    const completedTodos = (dailyPlan?.todos || []).filter((t: { completed: boolean }) => t.completed);
    const totalTodos = (dailyPlan?.todos || []).length;
    if (totalTodos > 0) {
      parts.push(`You completed ${completedTodos.length} of ${totalTodos} tasks.`);
    }

    const wentWellItems = (dailyPlan?.wentWells || [])
      .filter((w: { text: string | null }) => w.text)
      .map((w: { text: string | null }) => w.text);
    if (wentWellItems.length > 0) {
      parts.push(`Things that went well: ${wentWellItems.join(", ")}.`);
    }

    const gratitudeItems = (dailyPlan?.gratitudes || [])
      .filter((g: { text: string | null }) => g.text)
      .map((g: { text: string | null }) => g.text);
    if (gratitudeItems.length > 0) {
      parts.push(`You expressed gratitude for: ${gratitudeItems.join(", ")}.`);
    }

    if (journalEntries.length > 0) {
      const journalSummaries = journalEntries.map((e: { title: string | null; content: string | null }) => {
        const title = e.title || "Untitled";
        const snippet = (e.content || "").slice(0, 200);
        return `"${title}": ${snippet}`;
      });
      parts.push(`From your journal: ${journalSummaries.join("; ")}.`);
    }

    // TODO: Replace with AI-generated narrative when AI Coach is integrated
    const suggestion = parts.join(" ");

    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error("Story suggest error:", error);
    return NextResponse.json({ error: "Failed to generate suggestion" }, { status: 500 });
  }
}
