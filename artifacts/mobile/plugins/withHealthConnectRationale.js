// See the note in withHealthConnectDelegate.js on why this imports via
// `expo/config-plugins` rather than `@expo/config-plugins`.
const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Declares the Android 14+ health-permissions rationale activity.
 *
 * react-native-health-connect's own plugin adds
 * `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE` to MainActivity,
 * which is what Health Connect looked for when it shipped as a separate
 * app. From Android 14 it lives in the platform and looks for an
 * activity-alias exposing VIEW_PERMISSION_USAGE under the
 * HEALTH_PERMISSIONS category instead. Everstead targets SDK 36.
 *
 * Without it the permission dialog opens and immediately closes itself.
 * Confirmed on a Fold 7 against build 1.0.1 (versionCode 9), where the
 * old androidx filter was verifiably present in the installed manifest
 * and Health Connect still refused:
 *
 *   E PermissionsActivity: App should support rationale intent, finishing!
 *   I wm_finish_activity: ...PermissionsActivity,app-request
 *
 * The alias points at MainActivity, which already handles the older
 * rationale action, so both eras of the check resolve to the same screen.
 */

const ALIAS_NAME = "ViewPermissionUsageActivity";

function withHealthConnectRationale(config) {
  return withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    if (!application) {
      throw new Error(
        "[withHealthConnectRationale] No <application> node in AndroidManifest.",
      );
    }

    if (!Array.isArray(application["activity-alias"])) {
      application["activity-alias"] = [];
    }

    const already = application["activity-alias"].some(
      (a) => a?.$?.["android:name"] === ALIAS_NAME,
    );

    if (!already) {
      application["activity-alias"].push({
        $: {
          "android:name": ALIAS_NAME,
          "android:exported": "true",
          "android:targetActivity": ".MainActivity",
          "android:permission": "android.permission.START_VIEW_PERMISSION_USAGE",
        },
        "intent-filter": [
          {
            action: [
              {
                $: { "android:name": "android.intent.action.VIEW_PERMISSION_USAGE" },
              },
            ],
            category: [
              {
                $: { "android:name": "android.intent.category.HEALTH_PERMISSIONS" },
              },
            ],
          },
        ],
      });
    }

    // Fail the build rather than ship another APK where Connect does nothing.
    const present = application["activity-alias"].some(
      (a) => a?.$?.["android:name"] === ALIAS_NAME,
    );
    if (!present) {
      throw new Error(
        "[withHealthConnectRationale] activity-alias was not added to the manifest.",
      );
    }

    return cfg;
  });
}

module.exports = withHealthConnectRationale;
