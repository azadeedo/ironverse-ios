import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { createBrowserRouter, Outlet, RouterProvider, useLocation, useNavigate } from 'react-router-dom'
import { Apple, Dumbbell, House, LayoutGrid, TrendingUp } from 'lucide-react'
import { seedIfNeeded } from './db/seed'
import { autoSnapshotIfDue } from './lib/backup'
import { ensureEquipmentProfiles } from './lib/equipment'
import { db } from './db'
import { registerCustomExercises } from './data/exercises'
import { Spinner, ToastHost } from './components/ui'
import { RestTimerBar } from './components/RestTimerBar'
import { LaunchStatus, UpdatePrompt } from './components/UpdatePrompt'
import { isAppStoreEdition } from './lib/edition'
import { TourOverlay } from './components/Tour'
import { ProLocked } from './components/ProGate'
import { hasPro, proFeatureForPath, usePro } from './lib/pro'

const TodayScreen = lazy(() => import('@/screens/TodayScreen'))
const WorkoutScreen = lazy(() => import('@/screens/WorkoutScreen'))
const SessionScreen = lazy(() => import('@/screens/SessionScreen'))
const ExercisesScreen = lazy(() => import('@/screens/ExercisesScreen'))
const ExerciseDetailScreen = lazy(() => import('@/screens/ExerciseDetailScreen'))
const FoodScreen = lazy(() => import('@/screens/FoodScreen'))
const ProgressScreen = lazy(() => import('@/screens/ProgressScreen'))
const MoreScreen = lazy(() => import('@/screens/MoreScreen'))
const SettingsScreen = lazy(() => import('@/screens/SettingsScreen'))
const OnboardingScreen = lazy(() => import('@/screens/OnboardingScreen'))
const CardioScreen = lazy(() => import('@/screens/CardioScreen'))
const HydrationScreen = lazy(() => import('@/screens/HydrationScreen'))
const PlanScreen = lazy(() => import('@/screens/PlanScreen'))
const BuildProgramScreen = lazy(() => import('@/screens/workout/BuildProgramScreen'))
const BackupScreen = lazy(() => import('@/screens/BackupScreen'))
const ProgramsScreen = lazy(() => import('@/screens/ProgramsScreen'))
const ReviewScreen = lazy(() => import('@/screens/ReviewScreen'))
const PhotosScreen = lazy(() => import('@/screens/PhotosScreen'))
const PRsScreen = lazy(() => import('@/screens/PRsScreen'))
const HistoryScreen = lazy(() => import('@/screens/HistoryScreen'))
const ToolsScreen = lazy(() => import('@/screens/ToolsScreen'))
const SearchScreen = lazy(() => import('@/screens/SearchScreen'))
const AchievementsScreen = lazy(() => import('@/screens/AchievementsScreen'))
const WhatsNewScreen = lazy(() => import('@/screens/WhatsNewScreen'))
const ProgramScreen = lazy(() => import('@/screens/ProgramScreen'))
const ProgramDayScreen = lazy(() => import('@/screens/ProgramDayScreen'))
const CalorieCentre = lazy(() => import('@/screens/CalorieCentre'))
const ProgressHub = lazy(() => import('@/screens/ProgressHub'))
const WorkoutReplay = lazy(() => import('@/screens/WorkoutReplay'))
const DevicesScreen = lazy(() => import('@/screens/DevicesScreen'))
const MealPlanScreen = lazy(() => import('@/screens/MealPlanScreen'))
const Anatomy3DScreen = lazy(() => import('@/screens/Anatomy3DScreen'))
const AnatomyScreen = lazy(() => import('@/screens/AnatomyScreen'))
const FoodPhotoDiary = lazy(() => import('@/screens/food/FoodPhotoDiary'))
const FoodScoreScreen = lazy(() => import('@/screens/food/FoodScoreScreen'))
const FastFoodGuide = lazy(() => import('@/screens/food/FastFoodGuide'))
const DosetteScreen = lazy(() => import('@/screens/DosetteScreen'))
const NutritionRange = lazy(() => import('@/screens/food/NutritionRange'))
const WeekReviewScreen = lazy(() => import('@/screens/ProgramReviews').then((m) => ({ default: m.WeekReviewScreen })))
const ProgramCompleteScreen = lazy(() => import('@/screens/ProgramReviews').then((m) => ({ default: m.ProgramCompleteScreen })))
const PRQuestScreen = lazy(() => import('@/screens/QuestScreens').then((m) => ({ default: m.PRQuestScreen })))
const BodyScreen = lazy(() => import('@/screens/QuestScreens').then((m) => ({ default: m.BodyScreen })))
const SkillsScreen = lazy(() => import('@/screens/QuestScreens').then((m) => ({ default: m.SkillsScreen })))
const ResearchScreen = lazy(() => import('@/screens/QuestScreens').then((m) => ({ default: m.ResearchScreen })))
const FirstRunScreen = lazy(() => import('@/screens/firstRun/FirstRunScreen'))
const ProScreen = lazy(() => import('@/screens/ProScreen'))
const FeedbackScreen = lazy(() => import('@/screens/FeedbackScreen'))
const StrengthJourneyScreen = lazy(() => import('@/screens/QuestScreens').then((m) => ({ default: m.StrengthJourneyScreen })))

function S({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="flex h-[70svh] items-center justify-center"><Spinner /></div>}>
      {children}
    </Suspense>
  )
}

const TABS = [
  { path: '/', label: 'Today', icon: House, match: (p: string) => p === '/' },
  { path: '/workout', label: 'Workout', icon: Dumbbell, match: (p: string) => p.startsWith('/workout') || p.startsWith('/session') || p.startsWith('/plan') || p.startsWith('/exercise') || p.startsWith('/programs') || p.startsWith('/prs') || p.startsWith('/history') || p.startsWith('/tools') || p.startsWith('/program') || ['/pr-quest', '/body', '/skills', '/research', '/strength-journey'].some((x) => p.startsWith(x)) },
  { path: '/food', label: 'Food', icon: Apple, match: (p: string) => p.startsWith('/food') },
  { path: '/progress', label: 'Progress', icon: TrendingUp, match: (p: string) => p.startsWith('/progress') || p.startsWith('/review') || p.startsWith('/photos') },
  { path: '/more', label: 'More', icon: LayoutGrid, match: (p: string) => ['/more', '/settings', '/cardio', '/hydration', '/backup', '/search', '/achievements', '/whats-new', '/feedback', '/pro'].some((x) => p.startsWith(x)) },
]

function Shell() {
  const location = useLocation()
  const navigate = useNavigate()
  const hideNav = /^\/session|^\/onboarding|^\/welcome|^\/pro$/.test(location.pathname)
  // App Store build: Pro screens show an upgrade card for free users (the screen itself is untouched)
  const tier = usePro((s) => s.tier)
  const lockedFeature = proFeatureForPath(location.pathname)
  const locked = !!lockedFeature && !hasPro(tier)
  // App Store build: open (or resume) first-time setup until it is finished
  useEffect(() => {
    if (!isAppStoreEdition()) return
    void import('./lib/firstRun').then(async (m) => {
      if (await m.isFirstRunDone()) return
      const me = await db.profile.get('me')
      const draft = await m.loadDraft()
      if (!me?.onboarded || (draft && draft.step >= 6)) {
        if (!/^\/welcome|^\/backup/.test(window.location.pathname)) navigate(`/welcome${draft && draft.step > 0 ? `?step=${draft.step}` : ''}`, { replace: true })
      }
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="flex h-full flex-col">
      <div key={location.pathname} className="page-in scroll-y flex-1" style={{ paddingBottom: hideNav ? 0 : 'calc(var(--sab) + 78px)' }}>
        {locked ? <ProLocked feature={lockedFeature!} /> : <Outlet />}
      </div>
      {!hideNav && <RestTimerBar />}
      {!hideNav && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface2/90 backdrop-blur-xl" style={{ paddingBottom: 'var(--sab)' }}>
          <div className="mx-auto flex max-w-lg items-stretch">
            {TABS.map((t) => {
              const active = t.match(location.pathname)
              const Icon = t.icon
              return (
                <button key={t.path} type="button" data-tour={`tab-${t.label.toLowerCase()}`} onClick={() => navigate(t.path)}
                  className={`pressable flex flex-1 flex-col items-center gap-0.5 py-2 ${active ? 'text-brand' : 'text-ink3'}`}>
                  <Icon size={23} strokeWidth={active ? 2.4 : 2} />
                  <span className="text-[10px] font-semibold">{t.label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      )}
      <ToastHost />
      <TourOverlay />
      <UpdatePrompt />
      <LaunchStatus />
    </div>
  )
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <S><TodayScreen /></S> },
      { path: 'onboarding', element: <S><OnboardingScreen /></S> },
      { path: 'welcome', element: <S><FirstRunScreen /></S> },
      { path: 'pro', element: <S><ProScreen /></S> },
      { path: 'feedback', element: <S><FeedbackScreen /></S> },
      { path: 'workout', element: <S><WorkoutScreen /></S> },
      { path: 'plan', element: <S><PlanScreen /></S> },
      { path: 'plan/build', element: <S><BuildProgramScreen /></S> },
      { path: 'session/:logId', element: <S><SessionScreen /></S> },
      { path: 'exercises', element: <S><ExercisesScreen /></S> },
      { path: 'exercise/:id', element: <S><ExerciseDetailScreen /></S> },
      { path: 'food', element: <S><FoodScreen /></S> },
      { path: 'progress', element: <S><ProgressScreen /></S> },
      { path: 'cardio', element: <S><CardioScreen /></S> },
      { path: 'hydration', element: <S><HydrationScreen /></S> },
      { path: 'more', element: <S><MoreScreen /></S> },
      { path: 'settings', element: <S><SettingsScreen /></S> },
      { path: 'backup', element: <S><BackupScreen /></S> },
      { path: 'programs', element: <S><ProgramsScreen /></S> },
      { path: 'review', element: <S><ReviewScreen /></S> },
      { path: 'photos', element: <S><PhotosScreen /></S> },
      { path: 'prs', element: <S><PRsScreen /></S> },
      { path: 'history', element: <S><HistoryScreen /></S> },
      { path: 'tools', element: <S><ToolsScreen /></S> },
      { path: 'search', element: <S><SearchScreen /></S> },
      { path: 'achievements', element: <S><AchievementsScreen /></S> },
      { path: 'whats-new', element: <S><WhatsNewScreen /></S> },
      { path: 'program', element: <S><ProgramScreen /></S> },
      { path: 'program/day/:week/:day', element: <S><ProgramDayScreen /></S> },
      { path: 'program/review/:week', element: <S><WeekReviewScreen /></S> },
      { path: 'program/complete', element: <S><ProgramCompleteScreen /></S> },
      { path: 'calories', element: <S><CalorieCentre /></S> },
      { path: 'hub', element: <S><ProgressHub /></S> },
      { path: 'replay/:logId', element: <S><WorkoutReplay /></S> },
      { path: 'devices', element: <S><DevicesScreen /></S> },
      { path: 'meal-plan', element: <S><MealPlanScreen /></S> },
      { path: 'food-photos', element: <S><FoodPhotoDiary /></S> },
      { path: 'health-scan', element: <S><FoodScoreScreen /></S> },
      { path: 'fast-food', element: <S><FastFoodGuide /></S> },
      { path: 'pill-box', element: <S><DosetteScreen /></S> },
      { path: 'nutrition-week', element: <S><NutritionRange /></S> },
      { path: 'anatomy', element: <S><AnatomyScreen /></S> },
      { path: 'anatomy/3d', element: <S><Anatomy3DScreen /></S> },
      { path: 'pr-quest', element: <S><PRQuestScreen /></S> },
      { path: 'body', element: <S><BodyScreen /></S> },
      { path: 'skills', element: <S><SkillsScreen /></S> },
      { path: 'research', element: <S><ResearchScreen /></S> },
      { path: 'strength-journey', element: <S><StrengthJourneyScreen /></S> },
      { path: '*', element: <S><TodayScreen /></S> },
    ],
  },
])

export default function App() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    void seedIfNeeded()
      .then(async () => {
        void ensureEquipmentProfiles()
        // App Store build: the owner-only once-routines below never start on a stranger's phone (lib/edition.ts)
        const owner = !isAppStoreEdition()
        if (owner) void import('./lib/ownerFoods').then((m) => m.ensureOwnerFoodsOnce()).catch(() => {})
        if (!owner) void import('./native/bridge').then((m) => m.initNative()).catch(() => {})
        // Pro: trial clock + what the App Store says this Apple Account owns
        if (!owner) void usePro.getState().refresh().then(() => import('./lib/pro')).then((m) => m.syncEntitlement()).catch(() => {})
        void autoSnapshotIfDue()
        // v6: user-created exercises join the registry before any screen renders
        try { registerCustomExercises(await db.customExercises.toArray()) } catch { /* table missing on a failed upgrade */ }
        // v7: program plans from the old weekday-template generator → the 48 written workouts (plan id kept, backup kept)
        try { const { ensureProgramUpgraded } = await import('./lib/programStore'); await ensureProgramUpgraded(); if (owner) { const { ensureProgramActive } = await import('./lib/programStore'); await ensureProgramActive(); { const { restartProgramOnce } = await import('./lib/programStore'); await restartProgramOnce() } const { fixSeedProfileOnce } = await import('./lib/programStore'); await fixSeedProfileOnce(); const o = await import('./lib/owner'); await o.applyOwnerProfileOnce() } const ct = await import('./lib/calorieTarget'); await ct.migrateAutoChangeToProposal(); await ct.evaluateProposal() } catch (e) { console.warn('program upgrade skipped', e) }
      })
      .finally(() => setReady(true))
    if (navigator.storage?.persist) void navigator.storage.persist()
  }, [])
  if (!ready) {
    return <div className="flex h-full items-center justify-center bg-surface"><Spinner /></div>
  }
  return <RouterProvider router={router} />
}
