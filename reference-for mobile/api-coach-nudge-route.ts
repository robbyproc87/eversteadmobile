import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const currentPage = searchParams.get("page") || "Today";

  try {
    const settings = await prisma.coachSettings.findUnique({
      where: { userId: user.id },
    });

    const proactivityLevel = settings?.proactivityLevel ?? 50;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const [plannerData, meditationData, bookProgressData, gratitudeData] = await Promise.all([
      prisma.dailyPlan.findFirst({
        where: {
          userId: user.id,
          date: {
            gte: todayStart,
            lt: todayEnd,
          },
        },
        include: {
          todos: true,
        },
      }),
      prisma.meditationSession.findMany({
        where: { userId: user.id },
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { startedAt: true },
      }),
      prisma.bookProgress.aggregate({
        where: {
          userId: user.id,
          loggedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        _sum: { pagesRead: true },
      }),
      prisma.dailyPlanGratitude.findMany({
        where: {
          dailyPlan: {
            userId: user.id,
            date: {
              gte: todayStart,
              lt: todayEnd,
            },
          },
        },
        take: 1,
      }),
    ]);

    const hasTodayPlan = !!plannerData;
    const hasTodayGratitude = (gratitudeData?.length || 0) > 0;

    let lastMeditationDaysAgo: number | undefined;
    if (meditationData.length > 0 && meditationData[0].startedAt) {
      const diffMs = now.getTime() - new Date(meditationData[0].startedAt).getTime();
      lastMeditationDaysAgo = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    const todosComplete = plannerData?.todos?.filter((t: any) => t.done).length || 0;
    const todosTotal = plannerData?.todos?.length || 0;

    const nudgeContext = {
      currentPage,
      hasTodayPlan,
      hasTodayGratitude,
      lastMeditationDaysAgo,
      pagesRead7d: bookProgressData._sum?.pagesRead || 0,
      currentHour: now.getHours(),
      dayOfWeek: now.getDay(),
      todosComplete,
      todosTotal,
      journalStreak: 0,
      plannerStreak: 0,
    };

    return NextResponse.json({ context: nudgeContext, proactivityLevel });
  } catch (error) {
    console.error("Nudge context error:", error);
    return NextResponse.json({ error: "Failed to get nudge context" }, { status: 500 });
  }
}
