import type { NudgeContext } from "./api";

export interface NudgeMessage {
  id: string;
  text: string;
  coachId: string;
  cta?: { label: string; route: string };
  minProactivity: number;
}

function inMorning(hour: number) {
  return hour >= 6 && hour < 11;
}
function inEvening(hour: number) {
  return hour >= 19 && hour < 23;
}

export function selectNudge(
  context: NudgeContext,
  proactivityLevel: number,
): NudgeMessage | null {
  if (proactivityLevel <= 10) return null;

  const candidates: NudgeMessage[] = [];

  if (
    context.currentPage === "Today" &&
    !context.hasTodayPlan &&
    inMorning(context.currentHour)
  ) {
    candidates.push({
      id: "plan-your-day",
      text: "You haven't planned your day yet. Want to start?",
      coachId: "sage",
      cta: { label: "Plan today", route: "/planner" },
      minProactivity: 20,
    });
  }

  if (
    context.currentPage === "Today" &&
    !context.hasTodayGratitude &&
    inEvening(context.currentHour)
  ) {
    candidates.push({
      id: "evening-gratitude",
      text: "What went well today? A quick gratitude takes 30 seconds.",
      coachId: "sage",
      cta: { label: "Add gratitude", route: "/planner" },
      minProactivity: 30,
    });
  }

  if (
    typeof context.lastMeditationDaysAgo === "number" &&
    context.lastMeditationDaysAgo >= 3
  ) {
    candidates.push({
      id: "meditation-break",
      text:
        context.lastMeditationDaysAgo >= 7
          ? "It's been over a week. Time to reset with a meditation?"
          : "Time for a meditation break?",
      coachId: "zen",
      cta: { label: "Meditate", route: "/meditation" },
      minProactivity: 40,
    });
  }

  if (
    context.todosTotal > 0 &&
    context.todosComplete === context.todosTotal &&
    inEvening(context.currentHour)
  ) {
    candidates.push({
      id: "celebrate-completion",
      text: "You finished everything today. Nice work.",
      coachId: "sage",
      minProactivity: 50,
    });
  }

  if (context.pagesRead7d >= 50) {
    candidates.push({
      id: "reading-momentum",
      text: "Great progress on your reading this week.",
      coachId: "muse",
      minProactivity: 60,
    });
  }

  if (context.journalStreak >= 5) {
    candidates.push({
      id: "journal-streak",
      text: `Your journal streak is at ${context.journalStreak} days. Keep it going.`,
      coachId: "muse",
      minProactivity: 50,
    });
  }

  const eligible = candidates.filter((c) => c.minProactivity <= proactivityLevel);
  if (eligible.length === 0) return null;
  return eligible[0];
}

export function pathnameToPageName(pathname: string): string | null {
  const path = pathname.split("?")[0];
  if (path.startsWith("/sage")) return null;
  if (path === "/" || path === "" || path.startsWith("/(tabs)") && path.endsWith("index"))
    return "Today";
  if (path.includes("planner")) return "Planner";
  if (path.includes("journal")) return "Journal";
  if (path.includes("meditation")) return "Meditation";
  if (path.includes("growth-library")) return "Books";
  if (path.includes("trends")) return "Trends";
  if (path.includes("life-architecture")) return "LifeArchitecture";
  return "Today";
}
