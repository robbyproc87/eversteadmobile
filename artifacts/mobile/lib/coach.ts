export interface CoachDefinition {
  id: string;
  name: string;
  title: string;
  shortDescription: string;
  description: string;
  color: string;
  gradientFrom: string;
  gradientTo: string;
}

export const COACHES: Record<string, CoachDefinition> = {
  sage: {
    id: "sage",
    name: "Sage",
    title: "Your AI coach",
    shortDescription: "Wise, warm guide",
    description:
      "Ask me anything about your goals, habits, or personal growth. I'm here to guide and support your journey.",
    color: "#f2c76e",
    gradientFrom: "#fff5d6",
    gradientTo: "#c89a40",
  },
  summit: {
    id: "summit",
    name: "Summit",
    title: "Goal-crushing strategist",
    shortDescription: "High-performance push",
    description:
      "I help you set bold goals, break them down, and stay accountable. Let's go climb something.",
    color: "#5b8def",
    gradientFrom: "#c5d8ff",
    gradientTo: "#2c5fc7",
  },
  zen: {
    id: "zen",
    name: "Zen",
    title: "Mindfulness guide",
    shortDescription: "Calm, present focus",
    description:
      "I'll help you slow down, breathe, and find clarity. Bring me whatever's swirling in your mind.",
    color: "#8B5CF6",
    gradientFrom: "#dccdf2",
    gradientTo: "#6e4caf",
  },
  forge: {
    id: "forge",
    name: "Forge",
    title: "Resilience coach",
    shortDescription: "Grit through hard things",
    description:
      "When life gets heavy, I'm here. We turn pressure into strength, one rep at a time.",
    color: "#d4534a",
    gradientFrom: "#f5b8b3",
    gradientTo: "#a83228",
  },
  muse: {
    id: "muse",
    name: "Muse",
    title: "Creativity catalyst",
    shortDescription: "Spark new ideas",
    description:
      "Stuck? Curious? Let's explore. I'll help you play with ideas and find unexpected directions.",
    color: "#4a9c6d",
    gradientFrom: "#bce6cd",
    gradientTo: "#2a6e48",
  },
};

export const COACH_IDS = ["sage", "summit", "zen", "forge", "muse"] as const;

export function getCoach(id: string | undefined | null): CoachDefinition {
  if (!id) return COACHES.sage;
  return COACHES[id] || COACHES.sage;
}

export const GREETING_TRIGGER = "__SAGE_GREETING__";
