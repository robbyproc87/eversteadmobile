# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   ├── mobile/             # Expo/React Native mobile app (Everstead)
│   └── mockup-sandbox/     # Component preview sandbox
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `artifacts/mobile` (`@workspace/mobile`) — Everstead

Expo/React Native mobile app called "Everstead" — a personal wellness and productivity companion.

- **Backend**: External API at `https://my.everstead.app/api/` (NOT the local api-server)
- **Auth**: Supabase Auth with Google OAuth via `expo-auth-session`, token persistence via `expo-secure-store`
- **Navigation**: 4-tab bottom bar (Today, Planner, Journal, Meditate) + floating Sage orb (bottom-right, gold circle) opens AI coach modal + hamburger drawer (Growth Library, Trends, Settings, Sage link)
- **Branding**: Gold accent `#f2c76e`, dark `#1a1a1a`, warm cream background `#faf8f3`
- **Fonts**: Inter (400, 500, 600, 700) via `@expo-google-fonts/inter`

Key files:
- `app/_layout.tsx` — Root layout with font loading, providers (SafeArea, QueryClient, Auth, Drawer, GestureHandler, Keyboard), Sage orb overlay, drawer overlay
- `app/(tabs)/_layout.tsx` — 4-tab bar with NativeTabs (liquid glass iOS 26+) fallback to classic Tabs; auth redirect to `/login`
- `app/(tabs)/index.tsx` — Today dashboard (hamburger menu, greeting, stats strip, focus card, quick actions [Journal, Plan Today, Meditate], activity feed)
- `app/(tabs)/planner.tsx`, `app/(tabs)/journal.tsx`, `app/(tabs)/meditation.tsx` — Tab screens with hamburger menu header
- `app/sage.tsx` — Full-screen modal for Sage AI coach chat (opened via floating orb or drawer)
- `app/growth-library.tsx` — Combined Books & Courses screen with tab switcher
- `app/life-architecture.tsx` — Pro-only standalone screen (drawer entry between Trends and Sage). Architectural visual dashboard (foundation slab → pillars → blueprints marks → rituals band → guardrails fence → vision arch) with collapsible per-section cards, Evolve buttons, and version history modal. Falls back to upgrade prompt for free tier (uses `/billing/status`).
- `app/life-architecture-section.tsx` — Modal section editor with two tabs: "Talk with Sage" (uses existing `/coach/chat` SSE stream with `currentPage="Life Architecture: <Section>"` and a section-specific opening prompt) and "Shape it" (per-section structured form). Footer has Save and Save & continue (advances to next section). Break interstitial appears before Blueprints and Guardrails.
- `lib/life-architecture.ts` — Section metadata (id, label, icon, colors, sage prompt, metaphor), completion checks, ordering, `localId()` helper, `shouldShowBreakBefore()`.
- `components/life-architecture/ArchitectureVisual.tsx` — Visual metaphor: foundation slab + columns + blueprint marks + ritual band + guardrail posts + vision arch; layers light up as sections complete; progress bar at bottom.
- `components/life-architecture/SectionCard.tsx` — Collapsible section card with badge, metaphor, description, per-section preview (FoundationPreview, PillarsPreview, BlueprintsPreview grouped by pillar, RitualsPreview, GuardrailsPreview, VisionPreview), and Evolve/Begin button.
- `components/life-architecture/SectionForm.tsx` — Per-section editing forms: Foundation (values + non-negotiables), Pillars (name + why), Blueprints (grouped under each pillar with target date), Rituals (cadence chips + pillar tags), Guardrails (rules), Vision (multiline narrative).
- `components/life-architecture/SageChatPanel.tsx` — Embedded Sage chat scoped to a section: streams via `coachApi.streamChat` with section-specific `currentPage`, primes with the section's opening prompt, handles 402 by escalating to upgrade prompt.
- `components/life-architecture/BreakInterstitial.tsx` — Modal interlude shown before Blueprints and Guardrails to give the user a breath between heavy sections.
- `components/life-architecture/VersionHistoryModal.tsx` — Lists past `LifeArchitectureSnapshot` versions returned by `/life-architecture` (id, createdAt, optional note).
- API surface (in `lib/api.ts`): `lifeArchitectureApi.get()` → `GET /life-architecture` (returns null on 404), `lifeArchitectureApi.save(data)` → `POST /life-architecture`. Types: `LifeArchitectureData`, `LifeArchitectureSnapshot`, `LAValue`, `LAPillar`, `LABlueprint`, `LARitual`, `LAGuardrail`. `EMPTY_LIFE_ARCHITECTURE` constant for initial state.
- `app/login.tsx` — Login screen with Google OAuth
- `app/journal-entry.tsx` — Journal entry editor with Type/Write mode toggle (state preserved via mounted-but-hidden surfaces); Write mode renders InkPad and a tools/colors toolbar; on save, when canvas has strokes, posts rendered page PNGs to `/journal/transcribe`
- `components/journal/InkPad.tsx` — Multi-page lined-paper canvas using `react-native-svg` + `perfect-freehand`; pen/pencil/highlighter/eraser tools, undo/redo, draggable template overlay, dot pen cursor, page navigation; PNG export via HTMLCanvas on web and `react-native-view-shot` (`captureRef`) on native
- `components/SageOrb.tsx` — Floating gold orb with pulse animation, visible on all screens except Sage modal and login
- `components/AppDrawer.tsx` — Slide-out drawer with logo, menu items, Sage link, and user profile
- `components/AuthGuard.tsx` — Auth protection wrapper for screens
- `contexts/DrawerContext.tsx` — Drawer open/close state management
- `contexts/AuthContext.tsx` — Auth state management, Google OAuth flow
- `lib/supabase.ts` — Supabase client with SecureStore adapter (web: localStorage fallback), auto-detects swapped env vars
- `lib/api.ts` — Typed fetch wrapper for external Everstead backend
- `constants/colors.ts` — Brand color palette

Important notes:
- Supabase secrets (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) were stored swapped by user — supabase.ts auto-detects which is URL vs key
- API calls use `lib/api.ts` with Bearer token from Supabase session, NOT the monorepo's local api-server hooks
- The dev script explicitly passes `EXPO_PUBLIC_SUPABASE_*` env vars for Metro bundler inlining

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
