import type { LifeArchitectureData } from "./api";

export type SectionId =
  | "foundation"
  | "pillars"
  | "blueprints"
  | "rituals"
  | "guardrails"
  | "vision";

export interface SectionMeta {
  id: SectionId;
  label: string;
  tagline: string;
  description: string;
  icon: string;
  color: string;
  bg: string;
  metaphor: string;
  sagePrompt: string;
  heavy: boolean;
}

export const SECTIONS: SectionMeta[] = [
  {
    id: "foundation",
    label: "Foundation",
    tagline: "Values & non-negotiables",
    description:
      "The bedrock truths your year stands on — what you'll never compromise.",
    icon: "square",
    color: "#7c5e3c",
    bg: "#efe4d2",
    metaphor: "The slab beneath everything",
    sagePrompt:
      "I'm here to help you uncover the foundation your year will stand on. Tell me — what are 3 to 5 values you refuse to live without this year? And what are the non-negotiables that protect them?",
    heavy: true,
  },
  {
    id: "pillars",
    label: "Pillars",
    tagline: "3–5 life domains",
    description:
      "The columns that hold up your life — the few areas you'll invest in deeply.",
    icon: "columns",
    color: "#8a6cb2",
    bg: "#e7dff2",
    metaphor: "Columns rising from the slab",
    sagePrompt:
      "Now we shape the columns. What 3 to 5 life domains will you commit to this year? Health, craft, relationships, finance, spirit — pick what matters and tell me why each one made the cut.",
    heavy: true,
  },
  {
    id: "blueprints",
    label: "Blueprints",
    tagline: "Targets per pillar",
    description:
      "Concrete one-year targets under each pillar — the shape of what you're building.",
    icon: "file-text",
    color: "#5b8def",
    bg: "#dbe7fb",
    metaphor: "The drawn plans for each column",
    sagePrompt:
      "For each of your pillars, what's the one-year target that would make this year unmistakably meaningful? Give me titles, rough timelines, and why each matters.",
    heavy: true,
  },
  {
    id: "rituals",
    label: "Rituals",
    tagline: "Daily & weekly habits",
    description:
      "The repeated motions that turn pillars into reality — small, daily, sacred.",
    icon: "repeat",
    color: "#4a9c6d",
    bg: "#d6ecdf",
    metaphor: "The gears keeping it all moving",
    sagePrompt:
      "Plans without rituals stay paper. What daily and weekly rituals will compound into your blueprints? Tell me each one, how often, and which pillar it serves.",
    heavy: true,
  },
  {
    id: "guardrails",
    label: "Guardrails",
    tagline: "Life rules",
    description:
      "The 'never agains' and 'always wills' — rules that keep you from drifting.",
    icon: "shield",
    color: "#d4534a",
    bg: "#f5dcd9",
    metaphor: "The fences around the build",
    sagePrompt:
      "What rules will you set so you don't drift? These are firm 'always' and 'never' lines — the guardrails that protect everything you've built above.",
    heavy: false,
  },
  {
    id: "vision",
    label: "The Vision",
    tagline: "Present-tense narrative",
    description:
      "A short, present-tense paragraph describing the life you're building.",
    icon: "sun",
    color: "#e6a23c",
    bg: "#fbeed1",
    metaphor: "The skyline, fully drawn",
    sagePrompt:
      "Now write the year as if it's already true. Describe a normal day a year from now — in present tense, vivid and specific. I'll help you sharpen it.",
    heavy: true,
  },
];

export function getSection(id: string): SectionMeta {
  return SECTIONS.find((s) => s.id === id) ?? SECTIONS[0];
}

/** Server section numbers (1-6) follow the SECTIONS order, which
 *  matches web's SECTION_METADATA numbering. */
export function sectionNumberFor(id: SectionId): number {
  const index = SECTIONS.findIndex((s) => s.id === id);
  return index >= 0 ? index + 1 : 1;
}

export function isSectionComplete(
  data: LifeArchitectureData,
  id: SectionId,
): boolean {
  switch (id) {
    case "foundation":
      return (
        data.foundation.values.length > 0 ||
        data.foundation.nonNegotiables.length > 0
      );
    case "pillars":
      return data.pillars.length >= 3;
    case "blueprints":
      return data.blueprints.length > 0;
    case "rituals":
      return data.rituals.length > 0;
    case "guardrails":
      return data.guardrails.length > 0;
    case "vision":
      return data.vision.narrative.trim().length > 20;
    default:
      return false;
  }
}

export function completionCount(data: LifeArchitectureData): number {
  return SECTIONS.filter((s) => isSectionComplete(data, s.id)).length;
}

export function nextSection(id: SectionId): SectionId | null {
  const idx = SECTIONS.findIndex((s) => s.id === id);
  if (idx < 0 || idx >= SECTIONS.length - 1) return null;
  return SECTIONS[idx + 1].id;
}

let _idCounter = 0;
export function localId(prefix: string = "id"): string {
  _idCounter += 1;
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${_idCounter.toString(36)}_${r}`;
}

export function shouldShowBreakBefore(id: SectionId): boolean {
  // Show break interstitial before these heavy sections to give a breath.
  return id === "blueprints" || id === "guardrails";
}
