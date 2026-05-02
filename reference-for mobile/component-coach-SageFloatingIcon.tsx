"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { SageQuickChat } from "./SageQuickChat";
import { SageOrb } from "./SageOrb";

export function SageFloatingIcon() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const handleClose = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen]);

  if (pathname === "/coach") return null;

  const pageName = pathname === "/"
    ? "Today"
    : pathname.startsWith("/planner")
      ? "Planner"
      : pathname.startsWith("/journal")
        ? "Journal"
        : pathname.startsWith("/meditation")
          ? "Meditation"
          : pathname.startsWith("/growth/books")
            ? "Books"
            : pathname.startsWith("/growth/courses")
              ? "Courses"
              : pathname.startsWith("/trends")
                ? "Trends"
                : pathname.slice(1);

  if (isOpen) {
    return (
      <>
        <div
          className="fixed inset-0 z-40"
          onClick={handleClose}
        />
        <SageQuickChat
          currentPage={pageName}
          currentPath={pathname}
          onClose={handleClose}
        />
      </>
    );
  }

  return (
    <button
      onClick={() => setIsOpen(true)}
      className="fixed bottom-6 right-6 z-30 flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
      data-testid="sage-floating-icon"
      aria-label="Open Sage coach"
    >
      <SageOrb size={48} pulse />
    </button>
  );
}
