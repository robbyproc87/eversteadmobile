"use client";

import { forwardRef } from "react";

interface JournalPaperProps {
  children: React.ReactNode;
  className?: string;
}

export const JournalPaper = forwardRef<HTMLDivElement, JournalPaperProps>(
  function JournalPaper({ children, className = "" }, ref) {
    return (
      <div
        ref={ref}
        className={`journal-paper relative min-h-[calc(100vh-220px)] ${className}`}
        data-testid="journal-paper"
      >
        <div className="journal-paper-margin" />
        {children}
      </div>
    );
  }
);
