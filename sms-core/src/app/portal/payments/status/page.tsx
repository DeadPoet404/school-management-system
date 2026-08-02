"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { fetchIntentStatus, type IntentStatus } from "@/lib/api/payments"

const currency = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatDate(iso: string | undefined | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString()
}

export default function PaymentStatusPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const reference = searchParams.get("reference")
  const missingReference = !reference

  const [status, setStatus] = React.useState<IntentStatus | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const restart = () => {
    setLoading(true)
    setError(null)
    setStatus(null)
  }

  React.useEffect(() => {
    if (missingReference) return

    let cancelled = false
    let attempts = 0
    let timer: ReturnType<typeof setTimeout>

    const check = async (verify: boolean) => {
      try {
        const data = await fetchIntentStatus(reference, verify)
        if (cancelled) return
        setStatus(data)
        setLoading(false)

        if (data.status === "PENDING" || data.status === "INITIALIZED") {
          if (attempts < 12) {
            attempts += 1
            timer = setTimeout(() => void check(false), 5000)
          }
        }
      } catch (e) {
        if (cancelled) return
        setLoading(false)
        setError(e instanceof Error ? e.message : "Unable to check payment status.")
      }
    }

    void check(true)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [reference, missingReference])

  const succeeded = status?.status === "SUCCEEDED"

  if (missingReference) {
    return (
      <div className="mx-auto max-w-xl px-6 py-12">
        <Card>
          <CardContent className="py-10 text-center">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-amber-600" />
            <p className="text-sm font-medium">No payment reference was provided.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push("/portal")}>
              Back to Fees
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      {loading && (
        <Card className="text-center">
          <CardContent className="py-12">
            <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Checking your payment status...</p>
            {reference && (
              <p className="mt-1 text-xs text-muted-foreground/70">Reference: {reference}</p>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && error && (
        <Card>
          <CardContent className="py-10 text-center">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-amber-600" />
            <p className="text-sm font-medium">We could not confirm the payment just yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={restart}>
              Check again
            </Button>
            <Button variant="ghost" size="sm" className="mt-4 ml-2" onClick={() => router.push("/portal")}>
              Back to Fees
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && status && !error && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2">
              {succeeded ? (
                <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              ) : (
                <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
              )}
            </div>
            <CardTitle className="text-lg">
              {succeeded ? "Payment Successful" : "Payment Pending"}
            </CardTitle>
            <CardDescription>Reference: {status.reference}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between rounded-lg bg-muted px-4 py-2.5">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">{currency.format(status.amount)}</span>
            </div>
            <div className="flex justify-between px-1">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium">{status.status}</span>
            </div>
            {status.channel && (
              <div className="flex justify-between px-1">
                <span className="text-muted-foreground">Method</span>
                <span className="font-medium">{status.channel}</span>
              </div>
            )}
            {status.paidAt && (
              <div className="flex justify-between px-1">
                <span className="text-muted-foreground">Paid on</span>
                <span className="font-medium">{formatDate(status.paidAt)}</span>
              </div>
            )}
            <div className="flex justify-center gap-2 pt-2">
              {!succeeded && (
                <Button variant="outline" onClick={restart}>
                  Re-check
                </Button>
              )}
              <Button onClick={() => router.push("/portal")}>Back to Fees</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
