import type { Feather } from "@expo/vector-icons";

// The six techniques the server accepts for AI generation
// (VALID_TYPES in web /api/meditation/generate). Keep in sync.
export interface MeditationTechnique {
  type: string;
  durationS: number;
  icon: keyof typeof Feather.glyphMap;
  description: string;
}

export const MEDITATION_TECHNIQUES: MeditationTechnique[] = [
  {
    type: "Box Breathing",
    durationS: 300,
    icon: "square",
    description: "Four counts in, hold, out, hold. Steadies the system fast.",
  },
  {
    type: "4-7-8 Breathing",
    durationS: 300,
    icon: "wind",
    description: "A long exhale that downshifts the body toward rest.",
  },
  {
    type: "Body Scan",
    durationS: 600,
    icon: "user",
    description: "Walk attention head to toe and let tension name itself.",
  },
  {
    type: "Focused Attention",
    durationS: 600,
    icon: "target",
    description: "One anchor, returned to again and again.",
  },
  {
    type: "Loving-Kindness",
    durationS: 600,
    icon: "heart",
    description: "Direct warmth at yourself and others, on purpose.",
  },
  {
    type: "Open Awareness",
    durationS: 1200,
    icon: "eye",
    description: "No anchor. Let whatever arises pass through.",
  },
];
