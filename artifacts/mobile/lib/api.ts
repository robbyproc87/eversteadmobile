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

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
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
    ).catch(() => [] as CalendarEvent[]),

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
};
