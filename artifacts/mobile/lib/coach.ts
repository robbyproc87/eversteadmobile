export interface CoachDefinition {
  id: string;
  name: string;
  title: string;
  shortDescription: string;
  description: string;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  domains: string[];
}

export const COACHES: Record<string, CoachDefinition> = {
  sage: {
    id: "sage",
    name: "Sage",
    title: "Your personal coach",
    shortDescription: "Wisdom across all areas of life",
    description: "Wisdom across all areas of life. Your primary guide.",
    color: "#FBBF24",
    gradientFrom: "#FDE68A",
    gradientTo: "#D97706",
    domains: ["general", "goals", "reflection", "accountability", "life-design"],
  },
  summit: {
    id: "summit",
    name: "Summit",
    title: "Professional & financial growth",
    shortDescription: "Productivity & performance",
    description: "Career strategy, leadership, financial discipline.",
    color: "#3B82F6",
    gradientFrom: "#93C5FD",
    gradientTo: "#1D4ED8",
    domains: [
      "career",
      "leadership",
      "finance",
      "negotiation",
      "professional-goals",
      "business",
    ],
  },
  zen: {
    id: "zen",
    name: "Zen",
    title: "Meditation & mindfulness",
    shortDescription: "Meditation & mindfulness",
    description: "Inner peace, presence, emotional processing.",
    color: "#8B5CF6",
    gradientFrom: "#C4B5FD",
    gradientTo: "#6D28D9",
    domains: [
      "meditation",
      "mindfulness",
      "stress",
      "anxiety",
      "emotional-health",
      "sleep",
      "breathwork",
    ],
  },
  forge: {
    id: "forge",
    name: "Forge",
    title: "Discipline & physical performance",
    shortDescription: "Health & fitness",
    description: "Fitness, habits, pushing past comfort zones.",
    color: "#EF4444",
    gradientFrom: "#FCA5A5",
    gradientTo: "#B91C1C",
    domains: [
      "fitness",
      "exercise",
      "habits",
      "discipline",
      "accountability",
      "nutrition",
      "energy",
    ],
  },
  muse: {
    id: "muse",
    name: "Muse",
    title: "Creativity & learning",
    shortDescription: "Creativity & innovation",
    description: "Books, ideas, creative expression, new perspectives.",
    color: "#10B981",
    gradientFrom: "#6EE7B7",
    gradientTo: "#047857",
    domains: [
      "reading",
      "learning",
      "creativity",
      "writing",
      "courses",
      "ideas",
      "curiosity",
    ],
  },
};

export const COACH_IDS = ["sage", "summit", "zen", "forge", "muse"] as const;

export function getCoach(id: string | undefined | null): CoachDefinition {
  if (!id) return COACHES.sage;
  return COACHES[id] || COACHES.sage;
}

export const GREETING_TRIGGER = "__SAGE_GREETING__";
