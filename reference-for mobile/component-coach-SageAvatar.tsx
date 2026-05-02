"use client";

import { cn } from "@/lib/utils";
import { SageOrb } from "./SageOrb";

interface SageAvatarProps {
  size?: "sm" | "md" | "lg" | "xl";
  pulse?: boolean;
  className?: string;
}

const sizeMap = {
  sm: 24,
  md: 40,
  lg: 56,
  xl: 56,
};

export function SageAvatar({ size = "md", pulse = false, className }: SageAvatarProps) {
  return (
    <SageOrb
      size={sizeMap[size]}
      pulse={pulse}
      className={className}
    />
  );
}
