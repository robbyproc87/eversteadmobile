"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MediaThumb {
  id: string;
  url: string;
  mimeType: string;
}

interface JournalEntry {
  id: string;
  userId: string;
  content?: string | null;
  inkData?: any;
  mood?: string | null;
  tags: string[];
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  hasMedia?: boolean;
  mediaCount?: number;
  media?: MediaThumb[];
}

interface JournalCalendarProps {
  entries: JournalEntry[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  onDayClick: (date: Date, entries: JournalEntry[]) => void;
  onAddPhoto?: (date: Date, entries: JournalEntry[], files: File[]) => void;
}

const MOOD_COLORS: Record<string, string> = {
  HAPPY: "from-amber-400 to-orange-400 dark:from-amber-500 dark:to-orange-500",
  CALM: "from-sky-400 to-blue-400 dark:from-sky-500 dark:to-blue-500",
  SAD: "from-slate-400 to-slate-500 dark:from-slate-500 dark:to-slate-600",
  ANXIOUS: "from-purple-400 to-violet-500 dark:from-purple-500 dark:to-violet-600",
  ENERGETIC: "from-rose-400 to-pink-500 dark:from-rose-500 dark:to-pink-600",
  TIRED: "from-indigo-400 to-indigo-500 dark:from-indigo-500 dark:to-indigo-600",
  GRATEFUL: "from-emerald-400 to-teal-500 dark:from-emerald-500 dark:to-teal-600",
  FRUSTRATED: "from-red-400 to-red-500 dark:from-red-500 dark:to-red-600",
  NEUTRAL: "from-zinc-400 to-zinc-500 dark:from-zinc-500 dark:to-zinc-600",
};

const DAY_HEADERS = ["M", "T", "W", "T", "F", "S", "S"];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let startDayOfWeek = firstDay.getDay();
  startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  const days: (Date | null)[] = [];

  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(null);
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function JournalCalendar({ entries, currentMonth, onMonthChange, onDayClick, onAddPhoto }: JournalCalendarProps) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const days = useMemo(() => getMonthDays(year, month), [year, month]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingDay, setPendingDay] = useState<{ date: Date; entries: JournalEntry[] } | null>(null);

  const entriesByDay = useMemo(() => {
    const map = new Map<string, JournalEntry[]>();
    for (const entry of entries) {
      const d = new Date(entry.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    return map;
  }, [entries]);

  const handlePrev = () => {
    onMonthChange(new Date(year, month - 1, 1));
  };

  const handleNext = () => {
    onMonthChange(new Date(year, month + 1, 1));
  };

  const handleCameraClick = (e: React.MouseEvent, day: Date, dayEntries: JournalEntry[]) => {
    e.stopPropagation();
    setPendingDay({ date: day, entries: dayEntries });
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && pendingDay && onAddPhoto) {
      onAddPhoto(pendingDay.date, pendingDay.entries, Array.from(e.target.files));
    }
    e.target.value = "";
    setPendingDay(null);
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleFileChange}
        data-testid="input-calendar-photo"
      />

      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight" data-testid="text-calendar-month">
          {formatMonthYear(currentMonth)}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={handlePrev}
            data-testid="button-prev-month"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleNext}
            data-testid="button-next-month"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DAY_HEADERS.map((label, i) => (
          <div
            key={i}
            className="text-center text-sm font-medium text-muted-foreground py-2"
          >
            {label}
          </div>
        ))}

        {days.map((day, i) => {
          if (!day) {
            return <div key={`empty-${i}`} className="aspect-square" />;
          }

          const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
          const dayEntries = entriesByDay.get(key) || [];
          const hasEntry = dayEntries.length > 0;
          const topMood = dayEntries[0]?.mood;
          const moodGradient = topMood ? MOOD_COLORS[topMood] : null;
          const today = isToday(day);
          const dayHasMedia = dayEntries.some((e) => e.hasMedia);
          const firstThumb = dayEntries.find((e) => e.media && e.media.length > 0)?.media?.[0];

          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              onClick={() => onDayClick(day, dayEntries)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onDayClick(day, dayEntries); }}
              className={`
                aspect-square rounded-md relative group cursor-pointer
                ${hasEntry
                  ? `bg-gradient-to-br ${moodGradient || "from-primary/80 to-primary dark:from-primary/70 dark:to-primary/90"}`
                  : "bg-primary/70 dark:bg-primary/50"
                }
                ${today ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}
              `}
              data-testid={`calendar-day-${day.getDate()}`}
            >
              {firstThumb && (
                <img
                  src={firstThumb.url}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-40 rounded-md"
                  loading="lazy"
                />
              )}
              <span className="absolute top-1 left-1.5 text-sm font-semibold text-white drop-shadow-md">
                {day.getDate()}
              </span>
              {hasEntry && (
                <div className="absolute bottom-1 right-1.5 flex items-center gap-0.5 pointer-events-none">
                  {dayHasMedia && (
                    <ImageIcon className="h-2.5 w-2.5 text-white/90 drop-shadow-sm" />
                  )}
                  {dayEntries.length > 1 && (
                    <span className="text-[10px] font-medium text-white/90 bg-black/30 rounded px-1">
                      {dayEntries.length}
                    </span>
                  )}
                </div>
              )}
              {onAddPhoto && (
                <button
                  onClick={(e) => handleCameraClick(e, day, dayEntries)}
                  className="absolute bottom-0.5 left-0.5 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity pointer-events-auto z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  aria-label="Add photo to this day"
                  data-testid="calendar-add-photo"
                >
                  <Camera className="h-3 w-3 text-white" />
                </button>
              )}
              {hasEntry && dayEntries[0].content && !firstThumb && (
                <div className="absolute inset-0 flex items-end p-1.5 pointer-events-none">
                  <p className="text-[9px] leading-tight text-white/80 line-clamp-2 drop-shadow-sm">
                    {dayEntries[0].content.slice(0, 40)}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
