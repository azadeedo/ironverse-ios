import Dexie, { type Table } from 'dexie'
import type {
  BarcodeEntry, CardioLog, CreatineLog, CustomExercise, DailyCheckin, DayAdjust, EquipmentProfile, ExerciseMeta,
  FoodItem, FoodLogEntry, Measurement, Plan, ProgramOverride, ProgressPhoto,
  Profile, Recipe, ReminderConfig, Setting, Snapshot, WaterLog, WeighIn, WorkoutLog,
} from './types'

// ============================================================
// SCHEMA HISTORY — never delete or recreate this database.
//
// v1 (original): profile, plans, workoutLogs, foods, foodLog, weighIns,
//                measurements, waterLog, creatineLog, cardioLog, reminders,
//                settings.
// v2 (2026-09):  ADDS tables only. No v1 table is changed or dropped, so every
//                existing row survives. New fields on v1 records are optional
//                and resolved through db/defaults.ts at read time.
// v3 (2026-10):  ADDS customExercises + checkins for the 12-week program. Same
//                rule: nothing existing is touched; a pre-upgrade snapshot is
//                taken by lib/migrate.ts before the new version opens.
// ============================================================

export class IronverseDB extends Dexie {
  // ---- v1 ----
  profile!: Table<Profile, string>
  plans!: Table<Plan, string>
  workoutLogs!: Table<WorkoutLog, string>
  foods!: Table<FoodItem, string>
  foodLog!: Table<FoodLogEntry, string>
  weighIns!: Table<WeighIn, string>
  measurements!: Table<Measurement, string>
  waterLog!: Table<WaterLog, string>
  creatineLog!: Table<CreatineLog, string>
  cardioLog!: Table<CardioLog, string>
  reminders!: Table<ReminderConfig, string>
  settings!: Table<Setting, string>
  // ---- v2 ----
  snapshots!: Table<Snapshot, string>
  equipmentProfiles!: Table<EquipmentProfile, string>
  recipes!: Table<Recipe, string>
  progressPhotos!: Table<ProgressPhoto, string>
  exerciseMeta!: Table<ExerciseMeta, string>
  barcodeCache!: Table<BarcodeEntry, string>
  dayAdjust!: Table<DayAdjust, string>
  programOverrides!: Table<ProgramOverride, string>
  // ---- v3 ----
  customExercises!: Table<CustomExercise, string>
  checkins!: Table<DailyCheckin, string>

  constructor() {
    super('iron-verse')

    this.version(1).stores({
      profile: 'id',
      plans: 'id, active, createdAt',
      workoutLogs: 'id, date, planId',
      foods: 'id, name, custom, favourite, useCount',
      foodLog: 'id, date, meal, createdAt',
      weighIns: 'id, date',
      measurements: 'id, date',
      waterLog: 'id, date',
      creatineLog: 'id, date',
      cardioLog: 'id, date, kind',
      reminders: 'id',
      settings: 'key',
    })

    // v2 — ADDITIVE. Tables omitted here keep their v1 definition untouched.
    this.version(2)
      .stores({
        snapshots: 'id, createdAt, date',
        equipmentProfiles: 'id, name',
        recipes: 'id, name, useCount',
        progressPhotos: 'id, date, pose',
        exerciseMeta: 'exerciseId, injured',
        barcodeCache: 'barcode, fetchedAt',
        dayAdjust: 'date, sourceDate',
        programOverrides: 'id, date, scope, coach',
      })
      .upgrade(async (tx) => {
        // Backfill only. Never rewrite user values that already exist.
        const ts = new Date().toISOString()
        const profiles = await tx.table('profile').toArray()
        for (const p of profiles) {
          const patch: Record<string, unknown> = {}
          if (p.halalMode === undefined) patch.halalMode = true
          if (p.energyUnit === undefined) patch.energyUnit = 'kcal'
          if (p.equipmentProfileId === undefined) patch.equipmentProfileId = 'home'
          if (Object.keys(patch).length > 0) {
            await tx.table('profile').update(p.id, { ...patch, updatedAt: ts })
          }
        }
      })

    // v3 — ADDITIVE. Two new tables; every v1/v2 table keeps its definition.
    this.version(3).stores({
      customExercises: 'id, name, category',
      checkins: 'date',
    })
  }
}

export const db = new IronverseDB()

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key)
  return row ? (row.value as T) : fallback
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value })
}

export async function getProfile(): Promise<Profile | undefined> {
  return db.profile.get('me')
}

export async function saveProfile(p: Profile): Promise<void> {
  await db.profile.put({ ...p, updatedAt: new Date().toISOString() })
}

/**
 * The active plan for where he is training right now.
 *
 * v4 builds one plan per location, so prefer an active plan whose
 * `equipmentProfileId` matches the current equipment profile. Everything else is
 * unchanged: with no match — including a plan saved before v4, which has no
 * `equipmentProfileId` at all — this returns the first active plan exactly as it
 * always did.
 */
export async function getActivePlan(): Promise<Plan | undefined> {
  const plans = await db.plans.toArray()
  // v6: an active 12-week program is THE plan wherever he trains (its exercises are fixed)
  const program = plans.find((p) => p.active && p.program === 'p12')
  if (program) return program
  const fallback = plans.find((p) => p.active)
  try {
    const me = await db.profile.get('me')
    const eqId = me?.equipmentProfileId
    if (eqId) {
      const match = plans.find((p) => p.active && p.equipmentProfileId === eqId)
      if (match) return match
    }
  } catch {
    // profile unreadable — fall through to the original behaviour
  }
  return fallback
}

// ---------- v2 settings keys (typed, so agents don't invent variants) ----------
export const SETTING_KEYS = {
  aiKey: 'ai:anthropicKey',
  lastExportAt: 'backup:lastExportAt',
  lastSnapshotDate: 'backup:lastSnapshotDate',
  lastEnergyUnitUsed: 'food:lastEnergyUnit',
  weeklyBudgetOptIn: 'food:weeklyBudget',
  // written by @/components/ui (useAppPrefs) — listed here so the canonical
  // key list stays the whole truth about what lives in the settings table
  uiPrefs: 'ui:prefs',
  whatsNewSeenVersion: 'ui:whatsNewSeenVersion',
  // v6 — 12-week program
  programSetup: 'p12:setup',
  stickingPoints: 'p12:sticking',
  migrationLog: 'app:migrationLog',
} as const
