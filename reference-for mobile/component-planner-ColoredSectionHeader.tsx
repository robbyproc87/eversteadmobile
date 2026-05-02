"use client";

import { cn } from "@/lib/utils";

export type ColorVariant = "blue" | "amber" | "green" | "purple";

export const colorMap: Record<ColorVariant, { bg: string; text: string; border: string; accent: string }> = {
  blue: {
    bg: "bg-blue-500/8 dark:bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/15 dark:border-blue-500/20",
    accent: "bg-blue-500",
  },
  amber: {
    bg: "bg-amber-500/8 dark:bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/15 dark:border-amber-500/20",
    accent: "bg-amber-500",
  },
  green: {
    bg: "bg-green-500/8 dark:bg-green-500/10",
    text: "text-green-600 dark:text-green-400",
    border: "border-green-500/15 dark:border-green-500/20",
    accent: "bg-green-500",
  },
  purple: {
    bg: "bg-violet-500/8 dark:bg-violet-500/10",
    text: "text-violet-600 dark:text-violet-400",
    border: "border-violet-500/15 dark:border-violet-500/20",
    accent: "bg-violet-500",
  },
};

interface ColoredSectionHeaderProps {
  title: string;
  color: ColorVariant;
  icon?: React.ReactNode;
  className?: string;
}

export function ColoredSectionHeader({ title, color, icon, className }: ColoredSectionHeaderProps) {
  const colors = colorMap[color];
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border",
        colors.bg,
        colors.border,
        className
      )}
      data-testid={`section-header-${color}`}
    >
      {icon && <span className={colors.text}>{icon}</span>}
      <span className={cn("text-sm font-semibold", colors.text)}>{title}</span>
    </div>
  );
}
