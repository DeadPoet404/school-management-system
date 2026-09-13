import { Suspense } from "react"
import SettingsWorkspace from "@/components/settings-workspace"

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsWorkspace />
    </Suspense>
  )
}
