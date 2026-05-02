import { supabase } from "./supabase";

const API_BASE = "https://my.everstead.app/api";

export interface DashboardStats {
  weeklyScore?: number;
  journalStreak?: number;
  plannerStreak?: number;
  pagesRead?: number;
  daysPlanned?: number;
}

export interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description?: string;
  timestamp: string;
  icon?: string;
}

export interface TodayPlan {
  focus?: string;
  focusDescription?: string;
  tasks?: Array<{
    id: string;
    title: string;
    completed: boolean;
  }>;
}

export interface BillingStatus {
  plan?: string;
  active?: boolean;
  trialEndsAt?: string;
}

export interface DailyPlanTodo {
  id: string;
  text: string;
  completed: boolean;
  ordinal: number;
  source: string;
}

export interface DailyPlanItem {
  id: string;
  ordinal: number;
  text: string | null;
}

export interface DailyPlanData {
  id: string;
  dailyGoal: string | null;
  todos: DailyPlanTodo[];
  priorities: DailyPlanItem[];
  wentWells: DailyPlanItem[];
  gratitudes: DailyPlanItem[];
}

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

export interface NudgeContext {
  currentPage: string;
  hasTodayPlan: boolean;
  hasTodayGratitude: boolean;
  lastMeditationDaysAgo?: number;
  pagesRead7d: number;
  currentHour: number;
  dayOfWeek: number;
  todosComplete: number;
  todosTotal: number;
  journalStreak: number;
  plannerStreak: number;
}

export interface NudgeResponse {
  context: NudgeContext;
  proactivityLevel: number;
}

export interface TrulyExceptional {
  id?: string;
  category: string;
  ordinal: number;
  text: string | null;
  source?: string | null;
  status?: string | null;
  importance?: string | null;
}

export interface WeeklyStoryDay {
  id: string;
  dayOfWeek: number;
  narrative: string | null;
  aiSuggested: boolean;
}

export interface WeeklyStoryObservation {
  id: string;
  content: string | null;
}

export interface WeekData {
  id: string;
  weekStart: string;
  weekScore: number | null;
  weeklyReviewInsights: string | null;
  wdsNotes: string | null;
  trulyExceptionals: TrulyExceptional[];
  weeklyStoryDays: WeeklyStoryDay[];
  weeklyStoryObservation: WeeklyStoryObservation | null;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export class ApiError extends Error {
  status: number;
  statusText: string;
  body?: unknown;

  constructor(message: string, status: number, statusText: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

function extractErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    for (const key of ["message", "error", "detail"]) {
      const val = obj[key];
      if (typeof val === "string" && val.trim().length > 0) return val;
    }
  }
  if (typeof body === "string" && body.trim().length > 0) return body;
  return fallback;
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const headers = await getAuthHeaders();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...headers,
        ...(options?.headers || {}),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network request failed";
    throw new ApiError(`Network error: ${msg}`, 0, "Network Error");
  }

  if (!res.ok) {
    const fallback = `API error: ${res.status} ${res.statusText}`;
    let body: unknown;
    try {
      const text = await res.text();
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
      }
    } catch {
      // ignore body read errors
    }
    throw new ApiError(extractErrorMessage(body, fallback), res.status, res.statusText, body);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export const api = {
  getDashboardStats: () => apiFetch<DashboardStats>("/dashboard/stats"),
  getDashboardActivity: () => apiFetch<ActivityItem[]>("/dashboard/activity"),
  getTodayPlan: () => apiFetch<TodayPlan>("/plan/today"),
  getBillingStatus: () => apiFetch<BillingStatus>("/billing/status"),

  getDailyPlan: (date: string) =>
    apiFetch<DailyPlanData>(`/planner/daily?date=${date}`),

  getCalendarEvents: (startISO: string, endISO: string) =>
    apiFetch<CalendarEvent[]>(
      `/calendar/events?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`,
    ),

  createCalendarEvent: (input: {
    title: string;
    description?: string;
    start: string;
    end: string;
    timeZone?: string;
  }) =>
    apiFetch<CalendarEvent>("/calendar/events", {
      method: "POST",
      body: JSON.stringify({
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...input,
      }),
    }),

  updateCalendarEvent: (
    id: string,
    input: {
      title?: string;
      description?: string;
      start?: string;
      end?: string;
      timeZone?: string;
    },
  ) =>
    apiFetch<CalendarEvent>(`/calendar/events/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...input,
      }),
    }),

  deleteCalendarEvent: (id: string) =>
    apiFetch<unknown>(`/calendar/events/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  savePriorities: (
    dailyPlanId: string,
    items: Array<{ ordinal: number; text: string }>,
  ) =>
    apiFetch<unknown>("/planner/daily/priorities", {
      method: "PUT",
      body: JSON.stringify({ dailyPlanId, items }),
    }),

  saveGratitudes: (
    dailyPlanId: string,
    items: Array<{ ordinal: number; text: string }>,
  ) =>
    apiFetch<unknown>("/planner/daily/gratitudes", {
      method: "PUT",
      body: JSON.stringify({ dailyPlanId, items }),
    }),

  addTodo: (dailyPlanId: string, text: string, source = "manual") =>
    apiFetch<DailyPlanTodo>("/planner/daily/todos", {
      method: "POST",
      body: JSON.stringify({ dailyPlanId, text, source }),
    }),

  updateTodo: (
    id: string,
    patch: { text?: string; completed?: boolean; ordinal?: number },
  ) =>
    apiFetch<DailyPlanTodo>("/planner/daily/todos", {
      method: "PUT",
      body: JSON.stringify({ id, ...patch }),
    }),

  deleteTodo: (id: string) =>
    apiFetch<unknown>("/planner/daily/todos", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    }),

  getNudge: (page: string) =>
    apiFetch<NudgeResponse>(`/coach/nudge?page=${encodeURIComponent(page)}`),

  getWeek: (weekStart: string) =>
    apiFetch<WeekData>(`/planner/week?weekStart=${weekStart}`),

  updateWeek: (
    id: string,
    fields: {
      wdsNotes?: string | null;
      weekScore?: number | null;
      weeklyReviewInsights?: string | null;
    },
  ) =>
    apiFetch<unknown>("/planner/week", {
      method: "PUT",
      body: JSON.stringify({ id, ...fields }),
    }),

  saveTrulyExceptionals: (
    weekId: string,
    items: Array<{
      category: string;
      ordinal: number;
      text: string;
      source?: string;
    }>,
  ) =>
    apiFetch<unknown>("/planner/week/truly-exceptionals", {
      method: "PUT",
      body: JSON.stringify({ weekId, items }),
    }),

  saveWeeklyStory: (
    weekId: string,
    days: Array<{ dayOfWeek: number; narrative: string }>,
  ) =>
    apiFetch<unknown>("/planner/week/story", {
      method: "PUT",
      body: JSON.stringify({ weekId, days }),
    }),

  saveWeeklyObservation: (weekId: string, content: string) =>
    apiFetch<unknown>("/planner/week/story/observation", {
      method: "PUT",
      body: JSON.stringify({ weekId, content }),
    }),

  setNextWeekTEs: (
    currentWeekId: string,
    items: Array<{ category: string; ordinal: number; text: string }>,
  ) =>
    apiFetch<unknown>("/planner/week/review/set-next-week", {
      method: "PUT",
      body: JSON.stringify({ currentWeekId, items }),
    }),
};
