// app/finance/page.tsx
import { Suspense } from "react"
import FinanceWorkspace from "@/components/finance-workspace"

export default function FinancePage() {
  return (
    <Suspense fallback={null}>
      <FinanceWorkspace />
    </Suspense>
  )
}
