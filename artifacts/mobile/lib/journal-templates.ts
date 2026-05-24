export interface JournalTemplate {
  id: string;
  label: string;
  emoji: string;
  description: string;
  prefillTitle?: string;
  prefillBody: string;
}

export const JOURNAL_TEMPLATES: JournalTemplate[] = [
  {
    id: "blank",
    label: "Blank",
    emoji: "📝",
    description: "Start with an empty page.",
    prefillBody: "",
  },
  {
    id: "morning-intention",
    label: "Morning Intention",
    emoji: "🌅",
    description: "Start the day with focus and intention.",
    prefillTitle: "Morning Intention",
    prefillBody:
      "Today I want to feel…\n\nOne thing I'll do to move forward:\n\nWhat could get in my way, and how will I handle it?\n",
  },
  {
    id: "evening-reflection",
    label: "Evening Reflection",
    emoji: "🌙",
    description: "Close the day with reflection.",
    prefillTitle: "Evening Reflection",
    prefillBody:
      "What went well today?\n\nWhat could I have done differently?\n\nWhat am I taking into tomorrow?\n",
  },
  {
    id: "gratitude-focus",
    label: "Gratitude",
    emoji: "🙏",
    description: "Pause on what's good.",
    prefillTitle: "Gratitude",
    prefillBody:
      "Three things I'm grateful for:\n1. \n2. \n3. \n\nOne person I want to thank, and why:\n",
  },
  {
    id: "problem-solving",
    label: "Problem Solving",
    emoji: "🧩",
    description: "Think through a challenge clearly.",
    prefillTitle: "Working Through",
    prefillBody:
      "The situation:\n\nWhat I'm feeling about it:\n\nWhat I actually control:\n\nMy next concrete step:\n",
  },
];

export function getTemplateById(id: string | null | undefined): JournalTemplate | null {
  if (!id) return null;
  return JOURNAL_TEMPLATES.find((t) => t.id === id) ?? null;
}
