import { Platform } from "react-native";

// Thin wrapper around react-native-health-connect (Android only).
// Loaded lazily so iOS/web bundles never touch the native module.

/**
 * How activeKcal was arrived at.
 *
 * Providers disagree about which calorie record they publish: Oura writes
 * ActiveCaloriesBurned, Samsung Health writes only TotalCaloriesBurned.
 * The number alone therefore isn't self-describing, and a coach reasoning
 * about effort needs to know which it is holding.
 */
export type ActiveKcalSource = "measured" | "derived" | "total";

export interface HealthSnapshot {
  steps: number | null;
  sleepH: number | null;
  /** Minutes of logged exercise today. */
  activeMin: number | null;
  /** Calories burned today — read activeKcalSource before trusting it. */
  activeKcal: number | null;
  activeKcalSource: ActiveKcalSource | null;
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
  // Samsung Health publishes only TotalCaloriesBurned; active burn is
  // recovered from it with the basal rate. Both are needed for any
  // Samsung-sourced user to see a calorie figure at all.
  { accessType: "read", recordType: "TotalCaloriesBurned" },
  { accessType: "read", recordType: "BasalMetabolicRate" },
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

/**
 * Which of the reads we want have not been granted.
 *
 * Connecting is deliberately an any-of check, so an existing user who
 * granted an earlier, smaller permission set counts as connected and is
 * never sent back to the prompt. That would otherwise hide new metrics
 * forever: the card would look connected while silently missing data it
 * had never been allowed to ask for.
 */
export async function missingHealthPermissions(): Promise<string[]> {
  const hc = getModule();
  if (!hc) return [];
  try {
    const ok = await hc.initialize();
    if (!ok) return [];
    const granted = await hc.getGrantedPermissions();
    return REQUIRED_PERMISSIONS.filter(
      (req) =>
        !granted.some(
          (g) => g.recordType === req.recordType && g.accessType === "read",
        ),
    ).map((r) => r.recordType);
  } catch {
    return [];
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
    return {
      steps: null,
      sleepH: null,
      activeMin: null,
      activeKcal: null,
      activeKcalSource: null,
    };

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
  let activeKcalSource: ActiveKcalSource | null = null;

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

    // Calories, in order of trustworthiness. Providers publish different
    // record types — Oura writes active burn, Samsung Health writes only
    // total — so a single read leaves a large share of users with nothing.
    try {
      const res = await hc.readRecords("ActiveCaloriesBurned", {
        timeRangeFilter: todayRange,
      });
      const records = res?.records ?? [];
      if (records.length > 0) {
        activeKcal = Math.round(
          records.reduce((sum, r) => sum + (r.energy?.inKilocalories ?? 0), 0),
        );
        activeKcalSource = "measured";
      }
    } catch {
      // fall through to the total-based path
    }

    if (activeKcal === null) {
      try {
        const res = await hc.readRecords("TotalCaloriesBurned", {
          timeRangeFilter: todayRange,
        });
        const records = res?.records ?? [];
        if (records.length > 0) {
          const totalKcal = records.reduce(
            (sum, r) => sum + (r.energy?.inKilocalories ?? 0),
            0,
          );
          // Prorate basal over the span the total records actually cover,
          // not the whole elapsed day. Subtracting a full day of basal from
          // six hours of total burn would read as a large negative.
          const coveredMs = records.reduce((sum, r) => {
            const start = new Date(r.startTime).getTime();
            const end = new Date(r.endTime).getTime();
            return end > start ? sum + (end - start) : sum;
          }, 0);

          const basalPerDay = await readBasalKcalPerDay(hc, now);

          if (basalPerDay !== null && coveredMs > 0) {
            const basalOverWindow = basalPerDay * (coveredMs / 86_400_000);
            // Active burn cannot be negative; a floor of zero is more
            // honest than a nonsense figure when basal is overstated.
            activeKcal = Math.max(0, Math.round(totalKcal - basalOverWindow));
            activeKcalSource = "derived";
          } else {
            // No basal rate to subtract. Report the total as a total and
            // let the label and the coaches say so, rather than passing
            // basal burn off as effort.
            activeKcal = Math.round(totalKcal);
            activeKcalSource = "total";
          }
        }
      } catch {
        activeKcal = null;
        activeKcalSource = null;
      }
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
    return {
      steps: null,
      sleepH: null,
      activeMin: null,
      activeKcal: null,
      activeKcalSource: null,
    };
  }

  return { steps, sleepH, activeMin, activeKcal, activeKcalSource };
}

/**
 * The most recent basal metabolic rate, in kcal/day.
 *
 * BMR is a slow-moving figure and providers don't necessarily write it
 * daily, so this looks back a week and takes the latest reading rather
 * than requiring one from today. Returns null when nothing is available,
 * which is what downgrades a derived figure to a plain total.
 */
async function readBasalKcalPerDay(
  hc: NonNullable<HealthConnectModule>,
  now: Date,
): Promise<number | null> {
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  try {
    const res = await hc.readRecords("BasalMetabolicRate", {
      timeRangeFilter: {
        operator: "between",
        startTime: weekAgo.toISOString(),
        endTime: now.toISOString(),
      },
    });
    const records = res?.records ?? [];
    if (records.length === 0) return null;

    const latest = records.reduce((newest, r) =>
      new Date(r.time).getTime() > new Date(newest.time).getTime() ? r : newest,
    );
    const perDay = latest.basalMetabolicRate?.inKilocaloriesPerDay ?? null;
    // A zero or absurd rate is worse than none - it would silently turn a
    // total into a "derived" figure that is really just the total again.
    if (perDay === null || perDay <= 0 || perDay > 10_000) return null;
    return perDay;
  } catch {
    return null;
  }
}
