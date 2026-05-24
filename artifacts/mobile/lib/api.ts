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

export const PREVIEW_TOKEN = "dev-bypass";

export async function isPreviewSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token === PREVIEW_TOKEN;
}

async function getAuthHeaders(): Promise<{
  headers: Record<string, string>;
  preview: boolean;
}> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const preview = token === PREVIEW_TOKEN;
  return {
    headers: {
      "Content-Type": "application/json",
      ...(token && !preview ? { Authorization: `Bearer ${token}` } : {}),
    },
    preview,
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

export class PreviewAuthError extends ApiError {
  constructor() {
    super(
      "Sign in to see your data",
      401,
      "Preview Mode",
    );
    this.name = "PreviewAuthError";
  }
}

export function isPreviewAuthError(err: unknown): boolean {
  return err instanceof PreviewAuthError;
}

export class PaymentRequiredError extends ApiError {
  feature?: string;
  constructor(feature?: string, message?: string) {
    super(message ?? "Subscription required", 402, "Payment Required", {
      error: "subscription_required",
      feature,
    });
    this.name = "PaymentRequiredError";
    this.feature = feature;
  }
}

export function isPaymentRequiredError(err: unknown): err is PaymentRequiredError {
  if (err instanceof PaymentRequiredError) return true;
  if (err instanceof ApiError && err.status === 402) return true;
  return false;
}

export interface CoachSettings {
  id?: string;
  proactivityLevel: number;
  accessJournal: boolean;
  accessPlanner: boolean;
  accessMeditation: boolean;
  accessBooks: boolean;
  accessMood: boolean;
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
  const { headers, preview } = await getAuthHeaders();
  if (preview) {
    throw new PreviewAuthError();
  }
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
    if (res.status === 402) {
      const feature =
        body && typeof body === "object"
          ? ((body as Record<string, unknown>).feature as string | undefined)
          : undefined;
      throw new PaymentRequiredError(feature, extractErrorMessage(body, fallback));
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

  getOnboardingState: () =>
    apiFetch<{
      onboardingComplete?: boolean;
      onboardingProgress?: Record<string, unknown> | null;
      onboardingType?: "quick" | "deep" | null;
      onboardingResumeAt?: number | null;
    }>("/onboarding"),

  saveOnboardingPartial: (
    progress: Record<string, unknown>,
    type: "quick" | "deep",
    stepIndex: number,
  ) =>
    apiFetch<unknown>("/onboarding/partial", {
      method: "POST",
      body: JSON.stringify({ progress, type, stepIndex }),
    }),

  saveOnboarding: (
    data: Record<string, unknown>,
    type: "quick" | "deep",
  ) =>
    apiFetch<unknown>("/onboarding", {
      method: "POST",
      body: JSON.stringify({ ...data, onboardingType: type }),
    }),

  saveWentWells: (
    dailyPlanId: string,
    items: Array<{ ordinal: number; text: string }>,
  ) =>
    apiFetch<unknown>("/planner/daily/went-wells", {
      method: "PUT",
      body: JSON.stringify({ dailyPlanId, items }),
    }),

  suggestGratitude: (context?: { focus?: string; date?: string }) =>
    apiFetch<{ suggestion?: string; suggestions?: string[]; text?: string }>(
      "/coach/suggest",
      {
        method: "POST",
        body: JSON.stringify({ type: "gratitude-prompt", context: context || {} }),
      },
    ),

  getDailyContent: () =>
    apiFetch<{
      greeting?: string;
      quote?: { text: string; author: string } | null;
      song?: { title: string; artist: string; reason: string } | null;
    }>("/daily-content"),

  generateMeditation: (input: { meditationType: string; durationS: number; voice?: string }) =>
    apiFetch<GeneratedMeditationDetail>("/meditation/generate", {
      method: "POST",
      body: JSON.stringify({ voice: "nova", ...input }),
    }),

  updateMeditationSession: (
    id: string,
    metrics: {
      rating?: number;
      attentionQuality?: number;
      mindWanderingCount?: number;
      emotionalTurbulence?: number;
      reactivity?: number;
      tensionAfter?: number;
      stressAfter?: number;
      insightText?: string;
      insightScore?: number;
    },
  ) =>
    apiFetch<MeditationSession>("/meditation/sessions", {
      method: "PATCH",
      body: JSON.stringify({ id, ...metrics }),
    }),

  getDailyMindfulnessCheckin: () =>
    apiFetch<{
      id?: string;
      awarenessRating?: number;
      wellbeingRating?: number;
      date?: string;
    } | null>("/meditation/daily-checkin"),

  saveDailyMindfulnessCheckin: (input: { awarenessRating: number; wellbeingRating: number }) =>
    apiFetch<{ id: string; awarenessRating: number; wellbeingRating: number; date: string }>(
      "/meditation/daily-checkin",
      { method: "POST", body: JSON.stringify(input) },
    ),

  getJournalPrompt: (context?: { mood?: string | null; templateId?: string | null }) =>
    apiFetch<{ prompt: string }>("/journal/prompt", {
      method: "POST",
      body: JSON.stringify(context || {}),
    }),

  requestJournalMediaUpload: (entryId: string, mime: string) =>
    apiFetch<{ path: string; token: string; signedUrl: string }>(
      `/journal/${encodeURIComponent(entryId)}/media?action=upload`,
      { method: "POST", body: JSON.stringify({ mime }) },
    ),

  confirmJournalMedia: (
    entryId: string,
    input: { path: string; mime: string; width?: number; height?: number; bytes: number },
  ) =>
    apiFetch<{ id: string; path: string; mime: string }>(
      `/journal/${encodeURIComponent(entryId)}/media?action=confirm`,
      { method: "POST", body: JSON.stringify(input) },
    ),

  listJournalEntryMedia: (entryId: string) =>
    apiFetch<Array<{ id: string; path: string; mime: string; signedUrl?: string }>>(
      `/journal/${encodeURIComponent(entryId)}/media`,
    ),

  listAllJournalMedia: (cursor?: string) =>
    apiFetch<{
      items: Array<{ id: string; entryId: string; path: string; mime: string; signedUrl?: string; createdAt: string }>;
      nextCursor?: string | null;
    }>(`/journal/media${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`),

  transcribeJournalAudio: (entryId: string, mediaId: string) =>
    apiFetch<{ text: string; status: "complete" | "failed" | "pending" }>(
      `/journal/${encodeURIComponent(entryId)}/audio-transcribe`,
      { method: "POST", body: JSON.stringify({ mediaId }) },
    ),
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

// ---------- Life Architecture ----------

export type LifeArchitectureCadence = "daily" | "weekly" | "monthly";

export interface LAValue {
  id: string;
  text: string;
}

export interface LAPillar {
  id: string;
  name: string;
  description?: string | null;
}

export interface LABlueprint {
  id: string;
  pillarId: string;
  title: string;
  targetDate?: string | null;
  description?: string | null;
}

export interface LARitual {
  id: string;
  name: string;
  cadence: LifeArchitectureCadence;
  pillarIds: string[];
}

export interface LAGuardrail {
  id: string;
  rule: string;
}

export interface LifeArchitectureFoundation {
  values: LAValue[];
  nonNegotiables: string[];
}

export interface LifeArchitectureVision {
  narrative: string;
}

export interface LifeArchitectureData {
  foundation: LifeArchitectureFoundation;
  pillars: LAPillar[];
  blueprints: LABlueprint[];
  rituals: LARitual[];
  guardrails: LAGuardrail[];
  vision: LifeArchitectureVision;
}

export interface LifeArchitectureSnapshotMeta {
  id: string;
  createdAt: string;
  note?: string | null;
}

export interface LifeArchitectureSnapshot extends LifeArchitectureData {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  versions?: LifeArchitectureSnapshotMeta[];
}

export const EMPTY_LIFE_ARCHITECTURE: LifeArchitectureData = {
  foundation: { values: [], nonNegotiables: [] },
  pillars: [],
  blueprints: [],
  rituals: [],
  guardrails: [],
  vision: { narrative: "" },
};

export const lifeArchitectureApi = {
  get: () =>
    apiFetch<LifeArchitectureSnapshot | null>("/life-architecture").catch(
      (err) => {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      },
    ),

  save: (data: LifeArchitectureData & { note?: string }) =>
    apiFetch<LifeArchitectureSnapshot>("/life-architecture", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ---------- Growth Library helpers ----------

/**
 * Force https:// on remote image URLs and reject anything else (data:, file:, etc).
 * Returns undefined for unsafe/empty values so callers can fall back to a placeholder.
 */
export function normalizeImageUrl(
  url: string | null | undefined,
): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("http://")) return "https://" + trimmed.slice(7);
  if (trimmed.startsWith("//")) return "https:" + trimmed;
  return undefined;
}

// ---------- Growth Library: Books ----------

export interface Book {
  id: string;
  title: string;
  author?: string | null;
  coverUrl?: string | null;
  totalPages?: number | null;
  pagesRead?: number | null;
  googleBooksId?: string | null;
  createdAt?: string;
}

export interface GoogleBookResult {
  googleBooksId: string;
  title: string;
  author?: string;
  coverUrl?: string;
  totalPages?: number;
}

interface GoogleBooksApiResponse {
  items?: Array<{
    id: string;
    volumeInfo?: {
      title?: string;
      authors?: string[];
      pageCount?: number;
      imageLinks?: {
        thumbnail?: string;
        smallThumbnail?: string;
      };
    };
  }>;
}

export const booksApi = {
  list: () => apiFetch<Book[]>("/books"),

  add: (input: {
    title: string;
    author?: string;
    coverUrl?: string;
    totalPages?: number;
    googleBooksId?: string;
  }) =>
    apiFetch<Book>("/books", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateProgress: (id: string, pagesRead: number) =>
    apiFetch<Book>(`/books/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ pagesRead }),
    }),

  remove: (id: string) =>
    apiFetch<unknown>(`/books/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  searchGoogle: async (query: string): Promise<GoogleBookResult[]> => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
      trimmed,
    )}&maxResults=12&printType=books`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new ApiError(
        `Google Books search failed: ${res.status}`,
        res.status,
        res.statusText,
      );
    }
    const data = (await res.json()) as GoogleBooksApiResponse;
    return (data.items ?? [])
      .map((item) => {
        const v = item.volumeInfo ?? {};
        return {
          googleBooksId: item.id,
          title: v.title ?? "Untitled",
          author: v.authors?.join(", "),
          coverUrl: normalizeImageUrl(
            v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail,
          ),
          totalPages: v.pageCount,
        } satisfies GoogleBookResult;
      })
      .filter((b) => b.title);
  },
};

// ---------- Growth Library: Courses ----------

export interface Course {
  id: string;
  title: string;
  url?: string | null;
  platform?: string | null;
  thumbnailUrl?: string | null;
  totalModules?: number | null;
  completedModules?: number | null;
  createdAt?: string;
}

export interface OgMetadata {
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
}

export const coursesApi = {
  list: () => apiFetch<Course[]>("/courses"),

  add: (input: {
    title: string;
    url?: string;
    platform?: string;
    thumbnailUrl?: string;
    totalModules?: number;
  }) =>
    apiFetch<Course>("/courses", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateProgress: (id: string, completedModules: number) =>
    apiFetch<Course>(`/courses/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ completedModules }),
    }),

  remove: (id: string) =>
    apiFetch<unknown>(`/courses/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  /**
   * Fetch OpenGraph metadata for a URL using the public microlink.io service.
   * No API key required for low-volume usage.
   */
  scrapeOg: async (rawUrl: string): Promise<OgMetadata> => {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      throw new ApiError("URL is required", 0, "Bad Request");
    }
    const normalized = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const res = await fetch(
      `https://api.microlink.io/?url=${encodeURIComponent(normalized)}`,
    );
    if (!res.ok) {
      throw new ApiError(
        `Could not read that link (${res.status})`,
        res.status,
        res.statusText,
      );
    }
    const json = (await res.json()) as {
      status?: string;
      data?: {
        title?: string;
        description?: string;
        image?: { url?: string };
        publisher?: string;
      };
    };
    if (json.status !== "success" || !json.data) {
      throw new ApiError(
        "Could not read that link",
        0,
        "Scrape Error",
      );
    }
    let host = "";
    try {
      host = new URL(normalized).hostname.replace(/^www\./, "");
    } catch {
      // ignore
    }
    return {
      title: json.data.title,
      description: json.data.description,
      imageUrl: normalizeImageUrl(json.data.image?.url),
      siteName: json.data.publisher || host,
    };
  },
};

// ---------- Calendar integration status ----------

export const integrationsApi = {
  /**
   * Mobile is read-only for calendar — we infer connection status by attempting
   * to read a small window. Auth (401/403) means signed out, not disconnected.
   */
  getCalendarStatus: async (): Promise<{
    connected: boolean;
    reason?: string;
  }> => {
    const now = new Date();
    const start = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const end = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    try {
      await apiFetch<unknown>(
        `/calendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
      );
      return { connected: true };
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 401 || e.status === 403) {
          return { connected: false, reason: "Sign in required" };
        }
        if (e.status === 404 || e.status === 412 || e.status === 428) {
          return { connected: false, reason: "Not connected" };
        }
      }
      return { connected: false, reason: "Not connected" };
    }
  },
};

// ---------- Coach (Sage + specialists) ----------

export const coachApi = {
  listConversations: () =>
    apiFetch<CoachConversationListItem[]>("/coach/conversations"),

  getConversation: (id: string) =>
    apiFetch<CoachConversationDetail>(
      `/coach/conversations/${encodeURIComponent(id)}`,
    ),

  getSettings: () => apiFetch<CoachSettings>("/coach/settings"),

  saveSettings: (input: Partial<CoachSettings>) =>
    apiFetch<CoachSettings>("/coach/settings", {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  async *streamChat(
    body: CoachChatRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<CoachStreamChunk> {
    const { headers, preview } = await getAuthHeaders();
    if (preview) {
      throw new PreviewAuthError();
    }
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
