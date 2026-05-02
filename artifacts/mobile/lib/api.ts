import { fetch as expoFetch } from "expo/fetch";

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

  listJournalEntries: (q?: string) => {
    const qp = q && q.trim().length > 0 ? `?q=${encodeURIComponent(q)}` : "";
    return apiFetch<JournalEntry[]>(`/journal${qp}`);
  },

  getJournalEntry: (id: string) =>
    apiFetch<JournalEntry>(`/journal/${encodeURIComponent(id)}`),

  createJournalEntry: (input: JournalEntryInput) =>
    apiFetch<JournalEntry>("/journal", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateJournalEntry: (id: string, input: JournalEntryInput & { forceUnlock?: boolean }) =>
    apiFetch<JournalEntry>(`/journal/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  deleteJournalEntry: (id: string) =>
    apiFetch<unknown>(`/journal/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  transcribeJournalEntry: (entryId: string, pages: string[]) =>
    apiFetch<TranscribeResponse>("/journal/transcribe", {
      method: "POST",
      body: JSON.stringify({ entryId, pages }),
    }),

  listMeditationSessions: () =>
    apiFetch<MeditationSession[]>("/meditation/sessions"),

  createMeditationSession: (input: {
    durationS: number;
    rating?: number;
    meditationType?: string;
    generatedMeditationId?: string;
    tensionBefore?: number;
    stressBefore?: number;
  }) =>
    apiFetch<MeditationSession>("/meditation/sessions", {
      method: "POST",
      body: JSON.stringify({
        startedAt: new Date(Date.now() - input.durationS * 1000).toISOString(),
        endedAt: new Date().toISOString(),
        rating: input.rating,
        meditationType: input.meditationType,
        generatedMeditationId: input.generatedMeditationId,
        tensionBefore: input.tensionBefore,
        stressBefore: input.stressBefore,
      }),
    }),

  rateMeditationSession: (id: string, rating: number) =>
    apiFetch<MeditationSession>("/meditation/sessions", {
      method: "PATCH",
      body: JSON.stringify({ id, rating }),
    }),

  listGeneratedMeditations: () =>
    apiFetch<GeneratedMeditation[]>("/meditation/generated"),

  getGeneratedMeditation: (id: string) =>
    apiFetch<GeneratedMeditationDetail>(
      `/meditation/generated/${encodeURIComponent(id)}`,
    ),

  deleteGeneratedMeditation: (id: string) =>
    apiFetch<unknown>(`/meditation/generated/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  listMeditationTracks: () =>
    apiFetch<MeditationTrack[]>("/meditation/tracks"),
};

export interface MeditationSession {
  id: string;
  userId?: string;
  trackId?: string | null;
  generatedMeditationId?: string | null;
  meditationType?: string | null;
  startedAt: string;
  endedAt?: string | null;
  rating?: number | null;
  notes?: string | null;
}

export interface GeneratedMeditation {
  id: string;
  meditationType: string;
  durationS: number;
  generatedAt: string;
}

export interface GeneratedMeditationDetail extends GeneratedMeditation {
  scriptText: string;
  audioUrl: string | null;
}

export interface MeditationTrack {
  id: string;
  title: string;
  durationS: number;
  category?: string | null;
}

export interface InkPointData {
  x: number;
  y: number;
  p?: number;
  t?: number;
}

export interface InkStrokeData {
  color: string;
  size: number;
  points: InkPointData[];
  opacity?: number;
  tool?: "pen" | "pencil" | "highlighter" | "eraser";
}

export interface JournalEntry {
  id: string;
  userId?: string;
  title?: string | null;
  content?: string | null;
  contentRich?: Record<string, unknown> | null;
  contentPlainText?: string | null;
  mood?: string | null;
  tags: string[];
  isPrivate?: boolean;
  templateId?: string | null;
  pageCount?: number;
  inkData?: InkStrokeData[] | null;
  canvasData?: InkStrokeData[][] | null;
  transcriptionStatus?: "pending" | "complete" | "failed" | null;
  createdAt: string;
  updatedAt: string;
  hasMedia?: boolean;
  mediaCount?: number;
}

export interface JournalEntryInput {
  title?: string | null;
  content?: string | null;
  contentRich?: Record<string, unknown> | null;
  contentPlainText?: string | null;
  mood?: string | null;
  tags?: string[];
  isPrivate?: boolean;
  canvasData?: InkStrokeData[][] | null;
  inkData?: InkStrokeData[] | null;
  templateId?: string | null;
  pageCount?: number;
  transcriptionStatus?: "pending" | "complete" | "failed" | null;
}

export interface TranscribeResponse {
  text: string;
  status: "complete" | "failed" | "pending";
}

export const MOOD_OPTIONS: Array<{
  value: string;
  label: string;
  emoji: string;
  color: string;
}> = [
  { value: "HAPPY", label: "Happy", emoji: "😊", color: "#4a9c6d" },
  { value: "CALM", label: "Calm", emoji: "😌", color: "#5b8def" },
  { value: "SAD", label: "Sad", emoji: "😢", color: "#6b7fc7" },
  { value: "ANXIOUS", label: "Anxious", emoji: "😰", color: "#e6a23c" },
  { value: "ENERGETIC", label: "Energetic", emoji: "⚡", color: "#f08c3a" },
  { value: "TIRED", label: "Tired", emoji: "😴", color: "#8a8a8a" },
  { value: "GRATEFUL", label: "Grateful", emoji: "🙏", color: "#d4a84a" },
  { value: "FRUSTRATED", label: "Frustrated", emoji: "😤", color: "#d4534a" },
  { value: "NEUTRAL", label: "Neutral", emoji: "😐", color: "#9ca3af" },
];

export function getMoodOption(value: string | null | undefined) {
  if (!value) return null;
  return MOOD_OPTIONS.find((m) => m.value === value) ?? null;
}

// ---------- Coach (Sage + specialists) ----------

export interface CoachConversationListItem {
  id: string;
  title: string | null;
  coachType: string;
  updatedAt: string;
}

export interface CoachActionInfo {
  tool: string;
  success: boolean;
  message: string;
  navigateTo?: string | null;
}

export interface CoachChatMessage {
  id: string;
  role: string;
  content: string;
  actions?: CoachActionInfo[] | null;
  createdAt: string;
}

export interface CoachConversationDetail {
  id: string;
  title: string | null;
  coachType: string;
  messages: CoachChatMessage[];
}

export interface CoachStreamChunk {
  conversationId?: string;
  thinking?: boolean;
  action?: CoachActionInfo;
  text?: string;
  done?: boolean;
  error?: string;
}

export interface CoachChatRequest {
  conversationId: string | null;
  message: string;
  coachType: string;
  currentPage?: string;
}

export const coachApi = {
  listConversations: () =>
    apiFetch<CoachConversationListItem[]>("/coach/conversations"),

  getConversation: (id: string) =>
    apiFetch<CoachConversationDetail>(
      `/coach/conversations/${encodeURIComponent(id)}`,
    ),

  async *streamChat(
    body: CoachChatRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<CoachStreamChunk> {
    const headers = await getAuthHeaders();
    let res: Response;
    try {
      res = (await expoFetch(`${API_BASE}/coach/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal,
      })) as unknown as Response;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network request failed";
      throw new ApiError(`Network error: ${msg}`, 0, "Network Error");
    }

    if (!res.ok) {
      let text = "";
      try {
        text = await res.text();
      } catch {
        // ignore
      }
      let parsed: unknown = text;
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          // keep as text
        }
      }
      throw new ApiError(
        extractErrorMessage(parsed, `Coach chat error: ${res.status}`),
        res.status,
        res.statusText,
        parsed,
      );
    }

    const reader = (res.body as unknown as ReadableStream<Uint8Array> | null)?.getReader();
    if (!reader) {
      throw new ApiError("No response body for stream", 0, "Stream Error");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const evt of events) {
          const trimmed = evt.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trimStart();
          if (!payload) continue;
          try {
            yield JSON.parse(payload) as CoachStreamChunk;
          } catch {
            // ignore parse errors for stray lines
          }
        }
      }
    } finally {
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
    }
  },
};
