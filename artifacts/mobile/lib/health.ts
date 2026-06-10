import { Platform } from "react-native";

// Thin wrapper around react-native-health-connect (Android only).
// Loaded lazily so iOS/web bundles never touch the native module.

export interface HealthSnapshot {
  steps: number | null;
  sleepH: number | null;
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
] as const;

export async function hasHealthPermissions(): Promise<boolean> {
  const hc = getModule();
  if (!hc) return false;
  try {
    const ok = await hc.initialize();
    if (!ok) return false;
    const granted = await hc.getGrantedPermissions();
    return REQUIRED_PERMISSIONS.every((req) =>
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

/** Steps since local midnight, and last night's sleep in hours. */
export async function readTodayHealth(): Promise<HealthSnapshot> {
  const hc = getModule();
  if (!hc) return { steps: null, sleepH: null };

  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  // Sleep sessions that ended this morning typically start yesterday
  // evening; look back to yesterday 15:00 and keep sessions ending today.
  const sleepWindowStart = new Date(midnight);
  sleepWindowStart.setHours(-9, 0, 0, 0);

  let steps: number | null = null;
  let sleepH: number | null = null;

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
      if (records.length > 0) {
        steps = records.reduce(
          (sum, r) => sum + (typeof r.count === "number" ? r.count : 0),
          0,
        );
      } else {
        steps = 0;
      }
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
  } catch {
    return { steps: null, sleepH: null };
  }

  return { steps, sleepH };
}
