import { Platform } from "react-native";

// Thin wrapper around react-native-health-connect (Android only).
// Loaded lazily so iOS/web bundles never touch the native module.

export interface HealthSnapshot {
  steps: number | null;
  sleepH: number | null;
  /** Minutes of logged exercise today. */
  activeMin: number | null;
  /** Calories burned through activity today. */
  activeKcal: number | null;
}

type HealthConnectModule = typeof import("react-native-health-connect");

let cachedModule: HealthConnectModule | null | undefined;

function getModule(): HealthConnectModule | null {
  if (Platform.OS !== "android") return null;
  if (cachedModule !== undefined) return cachedModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cachedModule = require("react-native-health-connect");
  } catch {
    cachedModule = null;
  }
  return cachedModule ?? null;
}

export async function isHealthConnectAvailable(): Promise<boolean> {
  const hc = getModule();
  if (!hc) return false;
  try {
    const status = await hc.getSdkStatus();
    return status === hc.SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

const REQUIRED_PERMISSIONS = [
  { accessType: "read", recordType: "Steps" },
  { accessType: "read", recordType: "SleepSession" },
  { accessType: "read", recordType: "ActiveCaloriesBurned" },
  { accessType: "read", recordType: "ExerciseSession" },
] as const;

/**
 * True once the user has granted at least one of the reads we ask for.
 *
 * Health Connect lets a user approve permissions individually, so
 * requiring all four would leave someone who granted only steps stuck
 * on the connect prompt forever while their data was already readable.
 * Each read is guarded separately, so a partial grant degrades to
 * fewer metrics rather than none.
 */
export async function hasHealthPermissions(): Promise<boolean> {
  const hc = getModule();
  if (!hc) return false;
  try {
    const ok = await hc.initialize();
    if (!ok) return false;
    const granted = await hc.getGrantedPermissions();
    return REQUIRED_PERMISSIONS.some((req) =>
      granted.some(
        (g) => g.recordType === req.recordType && g.accessType === "read",
      ),
    );
  } catch {
    return false;
  }
}

export async function requestHealthPermissions(): Promise<boolean> {
  const hc = getModule();
  if (!hc) return false;
  try {
    const ok = await hc.initialize();
    if (!ok) return false;
    await hc.requestPermission([...REQUIRED_PERMISSIONS]);
    return hasHealthPermissions();
  } catch {
    return false;
  }
}

/**
 * Today's movement since local midnight, and last night's sleep.
 * Any single read failing (not granted, no provider data) yields null
 * for that metric rather than sinking the whole snapshot.
 */
export async function readTodayHealth(): Promise<HealthSnapshot> {
  const hc = getModule();
  if (!hc)
    return { steps: null, sleepH: null, activeMin: null, activeKcal: null };

  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  // Sleep sessions that ended this morning typically start yesterday
  // evening; look back to yesterday 15:00 and keep sessions ending today.
  const sleepWindowStart = new Date(midnight);
  sleepWindowStart.setHours(-9, 0, 0, 0);

  let steps: number | null = null;
  let sleepH: number | null = null;
  let activeMin: number | null = null;
  let activeKcal: number | null = null;

  try {
    await hc.initialize();

    try {
      const res = await hc.readRecords("Steps", {
        timeRangeFilter: {
          operator: "between",
          startTime: midnight.toISOString(),
          endTime: now.toISOString(),
        },
      });
      const records = res?.records ?? [];
      // No records means the provider wrote nothing, which is not the
      // same claim as "you took zero steps". Only report a number when
      // there is data behind it; the card shows an em dash otherwise.
      steps =
        records.length > 0
          ? records.reduce(
              (sum, r) => sum + (typeof r.count === "number" ? r.count : 0),
              0,
            )
          : null;
    } catch {
      steps = null;
    }

    try {
      const res = await hc.readRecords("SleepSession", {
        timeRangeFilter: {
          operator: "between",
          startTime: sleepWindowStart.toISOString(),
          endTime: now.toISOString(),
        },
      });
      const records = res?.records ?? [];
      const totalMs = records
        .filter((r) => new Date(r.endTime).getTime() >= midnight.getTime())
        .reduce((sum, r) => {
          const start = new Date(r.startTime).getTime();
          const end = new Date(r.endTime).getTime();
          return end > start ? sum + (end - start) : sum;
        }, 0);
      sleepH = totalMs > 0 ? Math.round((totalMs / 3_600_000) * 10) / 10 : null;
    } catch {
      sleepH = null;
    }

    const todayRange = {
      operator: "between" as const,
      startTime: midnight.toISOString(),
      endTime: now.toISOString(),
    };

    try {
      const res = await hc.readRecords("ActiveCaloriesBurned", {
        timeRangeFilter: todayRange,
      });
      const records = res?.records ?? [];
      activeKcal =
        records.length > 0
          ? Math.round(
              records.reduce((sum, r) => sum + (r.energy?.inKilocalories ?? 0), 0),
            )
          : null;
    } catch {
      activeKcal = null;
    }

    try {
      const res = await hc.readRecords("ExerciseSession", {
        timeRangeFilter: todayRange,
      });
      const records = res?.records ?? [];
      activeMin =
        records.length > 0
          ? Math.round(
              records.reduce((sum, r) => {
                const start = new Date(r.startTime).getTime();
                const end = new Date(r.endTime).getTime();
                return end > start ? sum + (end - start) : sum;
              }, 0) / 60_000,
            )
          : null;
    } catch {
      activeMin = null;
    }
  } catch {
    return { steps: null, sleepH: null, activeMin: null, activeKcal: null };
  }

  return { steps, sleepH, activeMin, activeKcal };
}
