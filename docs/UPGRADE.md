# Ironverse upgrade — shared brief for every agent

Read this fully, then `docs/ARCHITECTURE.md`, then the files in your own scope.

## Rule zero — ADD, NEVER REMOVE
Every tab, screen and behaviour that exists today must still exist and still work
when you're done. The dark navy + amber look, the Today/Workout/Food/Progress/More
tab bar, all of it. If something must change shape to fit a new feature, keep the
old path working alongside the new one. Deleting a feature to make room is a
failure, not a trade-off.

## Rule one — THE OWNER'S REAL DATA MUST SURVIVE
He has real weigh-ins, workout logs and food history in IndexedDB right now.

- **The schema migration is already done.** `db.version(2)` adds tables only and
  backfills defaults. DO NOT add another `version()` or edit `src/db/index.ts`.
  If you genuinely need a new table, say so in your summary instead.
- **Every new field on an existing record is already optional.** Read them through
  `src/db/defaults.ts` helpers (`halalMode`, `energyUnit`, `dietTags`,
  `substitutesOf`, `ramadanConfig`, `prayerConfig`, …) so a v1 row renders
  exactly like a v2 row. Never assume a v2 field exists.
- Backup/restore and daily snapshots are built and verified — don't rebuild them.

## Design rules
- **No emoji anywhere in the UI.** Icons are `lucide-react` SVG components, which
  is what the whole app already uses — stay consistent with that.
- Big tap targets (44px+). He logs sets with sweaty hands between supersets.
- Offline-first. The ONLY things allowed to need the network are the AI photo
  estimate and the barcode lookup, and both must fail gracefully with a clear
  message — never a silent failure or a spinner that never ends.
- Dark navy surfaces (`bg-surface`/`surface2`/`surface3`), amber `brand` accent,
  `.shout` for italic-caps headings, `.big-num` for stat numerals.
- UI kit: `@/components/ui` (PageHeader, Card, StatCard, Button, IconButton,
  Sheet, Modal, ConfirmDialog, Input, TextArea, Select, Field, Segmented, Chips,
  ListRow, ListGroup, EmptyState, Fab, SearchBar, Badge, Toggle, ProgressBar,
  Spinner, Section). Charts: `@/components/charts` (LineChart with optional
  dashed secondary series, BarChart, ProgressRing).
- Honest copy. Estimates are labelled as estimates. Nothing guilt-based.

## Shared libraries (already built — use, don't duplicate)
- `@/db/defaults` — read-time defaults for every v2 field. **Always go through this.**
- `@/lib/energy` — `toKcal`/`fromKcal`, `looksLikeKilojoules`, `kjSuggestion`,
  `checkMacros` (the 4/4/9 sanity check), `fmtEnergy(kcal, unit)`.
  **Storage is always kcal.** Display honours `energyUnit(profile)`.
- `@/lib/halal` — `filterHalal`, `isHalalHidden`, `isHalalCaution`,
  `cautionReason`, `substitutesForQuery`, `autoDietTags`, `primaryTagLabel`.
- `@/lib/equipment` — `ensureEquipmentProfiles`, `getCurrentProfile`,
  `setCurrentProfile`, `isAvailable`, `availableExercises`, `bestSubstitute`,
  `adaptToProfile(exercises, profile)` → `{ exercises, swaps, dropped }`.
  Every swap carries a human reason ("no cable here → smith machine row").
- `@/lib/plates` — `nearestLoad`, `nextLoadUp`, `barLoads`. Loads must always be
  buildable from the CURRENT equipment profile's bars/plates/dumbbells.
- `@/lib/backup` — `exportBackup`, `inspectBackup`, `restoreFromPayload`,
  `takeSnapshot`, `daysSinceExport`, `toCsv`, `shareOrDownload`.
- `@/lib/nutrition` — `bmr`, `tdeeFormula`, `recommendedTargets`, `adaptiveTdee`,
  `projectedKgPerWeek`, `weightTrend`, `metCalories`.
- `@/lib/plangen` — `generatePlan`, `dayForDate`, `WEEK_LABELS`.
- `@/lib/store` — `useUI()`: toasts + the global rest timer (`startRest(sec)`
  drives the floating RestTimerBar from anywhere).
- Settings keys live in `SETTING_KEYS` (`@/db`) — use them, don't invent strings.

## New tables available (v2, already created, all empty)
`snapshots`, `equipmentProfiles`, `recipes`, `progressPhotos`, `exerciseMeta`,
`barcodeCache`, `dayAdjust`, `programOverrides`. Types are in `@/db/types`.

## New routes already wired
`/backup`, `/programs`, `/review`, `/photos` (stub screens exist — replace the
one in your scope). Do not edit `src/App.tsx`; routing is done.

## Working rules
- Only create/modify files in YOUR scope. Never touch another agent's files.
- `npx tsc --noEmit` must be clean for YOUR files before you finish. Other
  modules may be mid-build — ignore their errors.
- Never run `npm install`, `npm run dev` or `npm run build`.
- No dead buttons. Everything persists. ConfirmDialog before anything destructive.
- No medical claims. Training guidance is practical coaching, not prescription.

---

# v3 — the workout makeover (2026-09-14)

## The bug this round fixed
`adaptToProfile()` only replaced exercises that were MISSING. His home kit is a
subset of a commercial gym, so switching Home → Flex 24/7 changed nothing and
all 44 gym machines sat unused. `localiseSession()` (in `@/lib/equipment`) now
asks the right question for each slot: *what is the best way to train this
movement pattern with the kit in THIS room* — upgrading at the gym, degrading
gracefully at home, always with a stated reason. `adaptToProfile` is kept and
still exported; nothing was removed.

## New shared libraries (v3)
- `@/lib/quality` — movement pattern + tier model. `inferQuality` (authored
  `quality` on the exercise wins, heuristics fill gaps), `qualityScore` (lower
  is better), `isIsolation` / `sameRole` (a compound is NEVER replaced by an
  isolation), `isRealUpgrade` + `UPGRADE_MARGIN` (no churn for marginal gains),
  `upgradeReason`.
- `@/lib/supersets` — antagonist pairing, time model, `applySupersets` /
  `clearSupersets`. Never pairs two heavy compounds.
- `@/lib/setmodes` — drop sets, rest-pause, myo-reps, clusters, AMRAP/timed.
- `@/lib/progression` — `nextSessionTarget`, `plateauCheck`, `staleness`,
  `readinessAdjustment`.
- `@/lib/volume` — `plannedWeeklyVolume`, landmarks, `weakPoints`,
  `recoveryStatus`.

## Rules that still bind every change
- Flex 24/7 is a FULL commercial gym. It is not a limited subset of anything.
- Never bump the Dexie schema version. New data rides on existing tables.
- Authored exercise `quality` data beats inference — fill it in, don't widen
  the regexes.
