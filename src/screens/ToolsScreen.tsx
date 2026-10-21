// TRAINING TOOLS — the calculators that used to live in his head or on his
// phone's notes app. All of them run off data already on the device: no network,
// no accounts, nothing that stops working in a basement gym.
// Route: /tools

import { useLiveQuery } from 'dexie-react-hooks'
import { WifiOff } from 'lucide-react'
import { PageHeader, Spinner } from '@/components/ui'
import { getCurrentProfile } from '@/lib/equipment'
import { useProfileLive, useWorkoutLogsLive } from './exercises/shared'
import { OneRmTool } from './tools/OneRmTool'
import { CustomPlateCalc, PlateTool } from './tools/PlateTool'
import { RelativeTool } from './tools/RelativeTool'
import { RestTool } from './tools/RestTool'
import { WarmupTool } from './tools/WarmupTool'

export default function ToolsScreen() {
  const profile = useProfileLive()
  const logs = useWorkoutLogsLive()
  const equip = useLiveQuery(() => getCurrentProfile(), [])

  if (!equip) {
    return (
      <div>
        <PageHeader title="Tools" back="/workout" />
        <div className="flex h-[50svh] items-center justify-center"><Spinner /></div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg pb-10">
      <PageHeader title="Tools" back="/workout" subtitle={`Calculators for ${equip.name}`} />

      <OneRmTool />
      <PlateTool profile={equip} />
      <CustomPlateCalc />
      <WarmupTool profile={equip} />
      <RestTool />
      <RelativeTool logs={logs ?? []} bodyweightKg={profile?.weightKg} />

      <div className="mt-8 flex items-center justify-center gap-1.5 px-4 text-ink3">
        <WifiOff size={13} />
        <span className="text-[12px] font-medium">
          Every one of these works offline, from data already on this device.
        </span>
      </div>
    </div>
  )
}
