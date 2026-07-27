// Imported via `expo/config-plugins`, not `@expo/config-plugins`. The
// latter is a transitive dependency and pnpm's strict node_modules layout
// leaves it unresolvable from this directory, which would fail prebuild.
// `expo` is a direct dependency and re-exports the same API.
const { withMainActivity } = require("expo/config-plugins");

/**
 * Registers the Health Connect permission delegate on MainActivity.
 *
 * react-native-health-connect keeps its ActivityResultLauncher in a
 * `lateinit` property on the HealthConnectPermissionDelegate object, and
 * the only thing that assigns it is setPermissionDelegate(activity).
 * The library never calls that itself — bare RN apps are expected to add
 * it to their own MainActivity.onCreate, and the library's bundled Expo
 * plugin only touches the manifest.
 *
 * Managed Expo generates MainActivity at prebuild, so there is no file to
 * edit by hand. Without this, requestPermission() throws
 * UninitializedPropertyAccessException the first time a user taps Connect
 * and the process dies. Observed on a Fold 7, build 87ef0387:
 *
 *   kotlin.UninitializedPropertyAccessException: lateinit property
 *   requestPermission has not been initialized
 *     at HealthConnectPermissionDelegate.launchPermissionsDialog(...:45)
 *
 * registerForActivityResult must run before the activity reaches STARTED,
 * so the call goes immediately after super.onCreate.
 */

const IMPORT_LINE =
  "import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate";
const DELEGATE_CALL = "HealthConnectPermissionDelegate.setPermissionDelegate(this)";

function withHealthConnectDelegate(config) {
  return withMainActivity(config, (cfg) => {
    const { language } = cfg.modResults;
    if (language !== "kt") {
      throw new Error(
        `[withHealthConnectDelegate] Expected a Kotlin MainActivity, got "${language}". ` +
          "The injection below is Kotlin-specific and would silently no-op.",
      );
    }

    let src = cfg.modResults.contents;

    if (!src.includes(IMPORT_LINE)) {
      const withImport = src.replace(
        /^(package .+\n)/m,
        `$1\n${IMPORT_LINE}\n`,
      );
      if (withImport === src) {
        throw new Error(
          "[withHealthConnectDelegate] Could not find a package declaration in MainActivity.",
        );
      }
      src = withImport;
    }

    if (!src.includes(DELEGATE_CALL)) {
      const withCall = src.replace(
        /(super\.onCreate\([^)]*\))/,
        `$1\n    ${DELEGATE_CALL}`,
      );
      if (withCall === src) {
        throw new Error(
          "[withHealthConnectDelegate] Could not find super.onCreate(...) in MainActivity. " +
            "Expo may have changed the generated template — update this plugin rather than " +
            "shipping a build where Health Connect crashes on first use.",
        );
      }
      src = withCall;
    }

    // Fail the build rather than produce an APK that repeats the crash.
    if (!src.includes(DELEGATE_CALL) || !src.includes(IMPORT_LINE)) {
      throw new Error(
        "[withHealthConnectDelegate] Injection did not take effect.",
      );
    }

    cfg.modResults.contents = src;
    return cfg;
  });
}

module.exports = withHealthConnectDelegate;
