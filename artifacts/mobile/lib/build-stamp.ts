import Constants from "expo-constants";
import * as Updates from "expo-updates";

/**
 * The "is my phone actually current" stamp shown on the login screen.
 *
 * This exists because the recurring cost on this project has been not
 * being able to tell a stale install from a broken one. A stamp derived
 * only from app.json's version reads the same forever and answers
 * nothing, so this carries the two things that actually move: the
 * native build number, which changes with every EAS build, and the OTA
 * update's publish date, which changes with every `eas update`.
 *
 * Reads as one of:
 *   v1.0.0 (12) · OTA Jul 25   - running an over-the-air update
 *   v1.0.0 (12) · built in     - running the bundle shipped in the build
 *   v1.0.0 · dev               - Metro / development client
 */
export function buildStamp(): string {
  const version = Constants.expoConfig?.version ?? "1.0";
  const build = Constants.nativeBuildVersion;
  const head = build ? `v${version} (${build})` : `v${version}`;

  if (__DEV__) return `${head} · dev`;

  try {
    if (Updates.isEmbeddedLaunch) return `${head} · built in`;
    const created = Updates.createdAt;
    if (created) {
      const stamp = created.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      return `${head} · OTA ${stamp}`;
    }
    return `${head} · OTA`;
  } catch {
    // expo-updates is inert in environments without a native build
    // (Expo Go, web). The version alone is still better than nothing.
    return head;
  }
}
