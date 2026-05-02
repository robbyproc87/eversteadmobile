"use client";

import { useMemo } from "react";
import { SiGoogle } from "react-icons/si";
import { Star } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function OutlookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.33.75.1.43.1.85zm-3.15 0q0 .37.04.72.05.36.16.65.1.28.3.45.2.18.52.18t.51-.18q.2-.17.3-.45.1-.29.16-.65.04-.36.04-.72t-.05-.72q-.05-.36-.16-.65-.1-.28-.3-.46-.2-.17-.51-.17t-.51.17q-.21.18-.3.46-.12.29-.16.65-.05.35-.05.72zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.01V2.62q0-.46.33-.8.33-.32.8-.32h14.54q.46 0 .8.33.32.33.32.8zm-6 1.22L13.46 18h4.54v-4.78zm-14-1.26h4.19q-.09-.64-.35-1.2-.26-.56-.65-.96-.39-.4-.89-.63-.5-.22-1.1-.22-.59 0-1.1.22-.5.23-.89.63-.38.4-.64.96t-.36 1.2H1.97q.12-.93.47-1.71.35-.79.9-1.36.54-.57 1.28-.88.74-.31 1.59-.31.84 0 1.58.31.74.31 1.29.88.54.57.9 1.36.34.78.46 1.71h.18zm13 7.42V14h-4.39L22 18.38zm0-13.76H7.13v3.38h1.84q1.04 0 1.94.37.89.37 1.56.99.67.63 1.07 1.47.38.85.48 1.79h7.98V5.62z"/>
    </svg>
  );
}

const SCHEDULE_START_HOUR = 5;
const SCHEDULE_END_HOUR = 22;
const ROW_HEIGHT = 40;

export interface CalendarEvent {
  id: string;
  provider: "GOOGLE" | "MICROSOFT";
  title: string;
  description: string | null;
  start: string;
  end: string;
  isAllDay: boolean;
  eversteadOwned: boolean;
  color: string | null;
  calendarId: string;
}

function getProviderColor(provider: string, eversteadOwned: boolean): string {
  if (eversteadOwned) return "hsl(var(--primary))";
  if (provider === "GOOGLE") return "#4285f4";
  if (provider === "MICROSOFT") return "#00a4ef";
  return "#6b7280";
}

function getProviderBg(provider: string, eversteadOwned: boolean): string {
  if (eversteadOwned) return "bg-primary/10";
  if (provider === "GOOGLE") return "bg-blue-50 dark:bg-blue-950/30";
  if (provider === "MICROSOFT") return "bg-sky-50 dark:bg-sky-950/30";
  return "bg-muted/50";
}

interface PositionedEvent extends CalendarEvent {
  top: number;
  height: number;
  startDate: Date;
  endDate: Date;
  column: number;
  totalColumns: number;
}

function computeCollisionLayout(events: Omit<PositionedEvent, "column" | "totalColumns">[]): PositionedEvent[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => a.top - b.top || a.height - b.height);

  const groups: Omit<PositionedEvent, "column" | "totalColumns">[][] = [];

  for (const event of sorted) {
    const eventEnd = event.top + event.height;
    let placed = false;

    for (const group of groups) {
      const overlaps = group.some((g) => {
        const gEnd = g.top + g.height;
        return event.top < gEnd && eventEnd > g.top;
      });
      if (overlaps) {
        group.push(event);
        placed = true;
        break;
      }
    }

    if (!placed) {
      groups.push([event]);
    }
  }

  const mergedGroups: Omit<PositionedEvent, "column" | "totalColumns">[][] = [];
  for (const group of groups) {
    let merged = false;
    for (const mg of mergedGroups) {
      const mgMinTop = Math.min(...mg.map((e) => e.top));
      const mgMaxEnd = Math.max(...mg.map((e) => e.top + e.height));
      const gMinTop = Math.min(...group.map((e) => e.top));
      const gMaxEnd = Math.max(...group.map((e) => e.top + e.height));
      if (gMinTop < mgMaxEnd && gMaxEnd > mgMinTop) {
        mg.push(...group);
        merged = true;
        break;
      }
    }
    if (!merged) {
      mergedGroups.push([...group]);
    }
  }

  const result: PositionedEvent[] = [];

  for (const group of mergedGroups) {
    if (group.length === 1) {
      result.push({ ...group[0], column: 0, totalColumns: 1 });
      continue;
    }

    const sortedGroup = [...group].sort((a, b) => a.top - b.top || b.height - a.height);
    const columns: Omit<PositionedEvent, "column" | "totalColumns">[][] = [];

    for (const event of sortedGroup) {
      let placedCol = -1;
      for (let c = 0; c < columns.length; c++) {
        const colEvents = columns[c];
        const fits = colEvents.every((ce) => {
          const ceEnd = ce.top + ce.height;
          return event.top >= ceEnd || (event.top + event.height) <= ce.top;
        });
        if (fits) {
          placedCol = c;
          break;
        }
      }
      if (placedCol === -1) {
        placedCol = columns.length;
        columns.push([]);
      }
      columns[placedCol].push(event);
    }

    const totalColumns = Math.min(columns.length, 4);
    for (let c = 0; c < columns.length; c++) {
      for (const event of columns[c]) {
        result.push({ ...event, column: Math.min(c, 3), totalColumns });
      }
    }
  }

  return result;
}

export function CalendarEventBlocks({
  events,
  dayStart,
  onEventClick,
}: {
  events: CalendarEvent[];
  dayStart: Date;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const positionedEvents = useMemo(() => {
    const timedRaw = events
      .filter((e) => !e.isAllDay)
      .map((e) => {
        const startDate = new Date(e.start);
        const endDate = new Date(e.end);

        const startHour = startDate.getHours() + startDate.getMinutes() / 60;
        const endHour = endDate.getHours() + endDate.getMinutes() / 60;

        const clampedStart = Math.max(startHour, SCHEDULE_START_HOUR);
        const clampedEnd = Math.min(endHour, SCHEDULE_END_HOUR + 1);

        if (clampedEnd <= clampedStart) return null;

        const top = (clampedStart - SCHEDULE_START_HOUR) * ROW_HEIGHT;
        const height = Math.max((clampedEnd - clampedStart) * ROW_HEIGHT, 20);

        return { ...e, top, height, startDate, endDate };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    return computeCollisionLayout(timedRaw);
  }, [events]);

  const LEFT_GUTTER = 64;
  const RIGHT_PAD = 8;

  return (
    <>
      {positionedEvents.map((event) => {
        const borderColor = getProviderColor(event.provider, event.eversteadOwned);
        const bgClass = getProviderBg(event.provider, event.eversteadOwned);

        const startTime = event.startDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        const endTime = event.endDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

        const colWidthPercent = 100 / event.totalColumns;
        const leftPercent = event.column * colWidthPercent;
        const isNarrow = event.totalColumns > 1;

        return (
          <Tooltip key={event.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onEventClick(event)}
                className={`absolute rounded-md px-2 py-1 text-left cursor-pointer z-[5] overflow-hidden transition-opacity hover:opacity-90 ${bgClass}`}
                style={{
                  top: `${event.top}px`,
                  height: `${event.height}px`,
                  left: `calc(${LEFT_GUTTER}px + (100% - ${LEFT_GUTTER + RIGHT_PAD}px) * ${leftPercent / 100})`,
                  width: `calc((100% - ${LEFT_GUTTER + RIGHT_PAD}px) * ${colWidthPercent / 100} - 2px)`,
                  borderLeft: `3px solid ${borderColor}`,
                }}
                data-testid={`event-block-${event.id}`}
              >
                <div className="flex items-center gap-1 min-w-0">
                  {event.eversteadOwned ? (
                    <Star className="h-3 w-3 shrink-0 text-primary" />
                  ) : event.provider === "GOOGLE" ? (
                    <SiGoogle className="h-3 w-3 shrink-0 text-blue-500" />
                  ) : (
                    <OutlookIcon className="h-3 w-3 shrink-0 text-sky-600" />
                  )}
                  <span className="text-xs font-medium truncate">{event.title}</span>
                </div>
                {event.height >= 36 && !isNarrow && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {startTime} – {endTime}
                  </p>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              <p className="font-medium">{event.title}</p>
              <p className="text-muted-foreground">{startTime} – {endTime}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </>
  );
}

export function AllDayEvents({
  events,
  onEventClick,
}: {
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}) {
  const allDayEvents = events.filter((e) => e.isAllDay);
  if (allDayEvents.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 pl-[64px] pr-2 py-1">
      {allDayEvents.map((event) => {
        const borderColor = getProviderColor(event.provider, event.eversteadOwned);
        const bgClass = getProviderBg(event.provider, event.eversteadOwned);

        return (
          <button
            key={event.id}
            type="button"
            onClick={() => onEventClick(event)}
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs cursor-pointer hover:opacity-90 ${bgClass}`}
            style={{ borderLeft: `3px solid ${borderColor}` }}
            data-testid={`event-allday-${event.id}`}
          >
            {event.provider === "GOOGLE" ? (
              <SiGoogle className="h-2.5 w-2.5 text-blue-500" />
            ) : event.provider === "MICROSOFT" ? (
              <OutlookIcon className="h-2.5 w-2.5 text-sky-600" />
            ) : (
              <Star className="h-2.5 w-2.5 text-primary" />
            )}
            <span className="font-medium truncate max-w-[200px]">{event.title}</span>
          </button>
        );
      })}
    </div>
  );
}
