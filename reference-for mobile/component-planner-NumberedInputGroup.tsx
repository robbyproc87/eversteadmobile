"use client";

import { cn } from "@/lib/utils";

interface NumberedInputGroupProps {
  count: number;
  values: (string | null | undefined)[];
  onChange: (index: number, value: string) => void;
  placeholder?: string;
  placeholders?: string[];
  className?: string;
  testIdPrefix?: string;
}

export function NumberedInputGroup({
  count,
  values,
  onChange,
  placeholder = "",
  placeholders,
  className,
  testIdPrefix = "numbered-input",
}: NumberedInputGroupProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="text-xs font-medium text-muted-foreground mt-2.5 w-4 text-right shrink-0">
            {i + 1}
          </span>
          <input
            type="text"
            value={values[i] ?? ""}
            onChange={(e) => onChange(i, e.target.value)}
            placeholder={placeholders ? placeholders[i] : placeholder}
            className="flex-1 bg-transparent border-b border-border/50 focus:border-primary/50 outline-none py-1.5 text-sm transition-colors placeholder:text-muted-foreground/50"
            data-testid={`${testIdPrefix}-${i + 1}`}
          />
        </div>
      ))}
    </div>
  );
}
