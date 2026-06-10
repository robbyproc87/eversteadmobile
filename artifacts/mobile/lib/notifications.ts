import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Daily ritual notifications: the Morning Briefing and the evening
// Turn-Down. Both are local notifications scheduled a week ahead with
// rotating copy (a single repeating trigger would repeat one line
// forever); refreshRitualSchedules() re-tops the queue on app start.

const PREFS_KEY = "everstead-ritual-prefs";
const CHANNEL_ID = "rituals";
const MORNING_PREFIX = "morning-briefing-";
const EVENING_PREFIX = "turn-down-";
const DAYS_AHEAD = 7;

export interface RitualPrefs {
  morningEnabled: boolean;
  morningHour: number;
  morningMinute: number;
  eveningEnabled: boolean;
  eveningHour: number;
  eveningMinute: number;
}

export const DEFAULT_RITUAL_PREFS: RitualPrefs = {
  morningEnabled: false,
  morningHour: 7,
  morningMinute: 30,
  eveningEnabled: false,
  eveningHour: 20,
  eveningMinute: 30,
};

// Sage's voice: a sharp, thoughtful friend. Never a cheerleader.
const MORNING_LINES = [
  "The day's still unwritten. You have a say in that.",
  "Three priorities. One day. Let's see the shape of it.",
  "Morning. What would make today actually good?",
  "Your plan is exactly as good as the first hour you give it.",
  "The week score doesn't move itself.",
  "Before the day decides for you - what do you want from it?",
  "Same day as everyone else gets. What's yours for?",
];

const EVENING_LINES = [
  "Before the day blurs - what actually went well?",
  "Close the day on purpose. Two minutes.",
  "Tomorrow goes better when tonight gets a verdict.",
  "What's worth keeping from today? Write it down.",
  "The day's done. Decide what it meant.",
  "One honest minute about today beats an hour of replaying it.",
  "Turn the day down like a bed. Then leave it.",
];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function getRitualPrefs(): Promise<RitualPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_RITUAL_PREFS;
    return { ...DEFAULT_RITUAL_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_RITUAL_PREFS;
  }
}

export async function setRitualPrefs(
  patch: Partial<RitualPrefs>,
): Promise<RitualPrefs> {
  const next = { ...(await getRitualPrefs()), ...patch };
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    // prefs persistence is best-effort
  }
  await refreshRitualSchedules(next);
  return next;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Daily rituals",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 150],
  });
}

function nextOccurrences(
  hour: number,
  minute: number,
  count: number,
): Date[] {
  const dates: Date[] = [];
  const first = new Date();
  first.setHours(hour, minute, 0, 0);
  if (first.getTime() <= Date.now()) {
    first.setDate(first.getDate() + 1);
  }
  for (let i = 0; i < count; i++) {
    const d = new Date(first);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

export async function refreshRitualSchedules(
  prefs?: RitualPrefs,
): Promise<void> {
  if (Platform.OS === "web") return;
  const p = prefs ?? (await getRitualPrefs());

  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter(
          (n) =>
            n.identifier.startsWith(MORNING_PREFIX) ||
            n.identifier.startsWith(EVENING_PREFIX),
        )
        .map((n) =>
          Notifications.cancelScheduledNotificationAsync(n.identifier),
        ),
    );

    if (!p.morningEnabled && !p.eveningEnabled) return;
    await ensureChannel();

    const jobs: Promise<unknown>[] = [];

    if (p.morningEnabled) {
      nextOccurrences(p.morningHour, p.morningMinute, DAYS_AHEAD).forEach(
        (date, i) => {
          jobs.push(
            Notifications.scheduleNotificationAsync({
              identifier: `${MORNING_PREFIX}${i}`,
              content: {
                title: "Morning briefing",
                body: MORNING_LINES[date.getDate() % MORNING_LINES.length],
                data: { url: "/(tabs)" },
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date,
                channelId: Platform.OS === "android" ? CHANNEL_ID : undefined,
              },
            }),
          );
        },
      );
    }

    if (p.eveningEnabled) {
      nextOccurrences(p.eveningHour, p.eveningMinute, DAYS_AHEAD).forEach(
        (date, i) => {
          jobs.push(
            Notifications.scheduleNotificationAsync({
              identifier: `${EVENING_PREFIX}${i}`,
              content: {
                title: "Turn-down service",
                body: EVENING_LINES[date.getDate() % EVENING_LINES.length],
                data: { url: "/turn-down" },
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date,
                channelId: Platform.OS === "android" ? CHANNEL_ID : undefined,
              },
            }),
          );
        },
      );
    }

    await Promise.all(jobs);
  } catch {
    // scheduling is best-effort; never break app startup over it
  }
}
