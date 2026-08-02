"use client"

import * as React from "react"
import { AlertCircle, CheckCircle2, CreditCard, Loader2, ReceiptText } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useMyFees, useCreateCheckout, type FeeInvoice } from "@/lib/api/payments"

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

function statusBadge(status: FeeInvoice["status"]) {
  switch (status) {
    case "PAID":
      return <Badge variant="default" className="bg-emerald-600">PAID</Badge>
    case "PARTIAL":
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">PARTIAL</Badge>
    default:
      return <Badge variant="outline" className="text-stone-600 dark:text-zinc-300">UNPAID</Badge>
  }
}

export default function StudentFeesPortal() {
  const fees = useMyFees()
  const createCheckout = useCreateCheckout()

  const [payerEmail, setPayerEmail] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)

  const balance = fees.data?.balance ?? 0
  const pending = fees.data?.pendingIntent ?? null
  const effectiveAmount = amount === "" && balance > 0 ? balance.toFixed(2) : amount

  const handlePayNow = async () => {
    setError(null)
    setNotice(null)

    if (!pending) {
      if (!payerEmail.trim()) {
        setError("Enter the payer email address for the Paystack checkout.")
        return
      }
      const amt = Number(effectiveAmount)
      if (!Number.isFinite(amt) || amt <= 0) {
        setError("Enter a valid amount greater than zero.")
        return
      }
      if (amt > balance) {
        setError("Payment amount cannot exceed the outstanding balance.")
        return
      }
    }

    const checkoutWindow = window.open("", "_blank", "noopener,noreferrer")
    try {
      if (pending) {
        if (pending.authorizationUrl) {
          if (checkoutWindow) checkoutWindow.location.href = pending.authorizationUrl
          else window.location.assign(pending.authorizationUrl)
        } else {
          checkoutWindow?.close()
          setNotice("A payment is already in progress. Re-check its status below.")
        }
        return
      }

      const created = await createCheckout.mutateAsync({
        payerEmail: payerEmail.trim(),
        amount: Number(effectiveAmount),
      })

      if (checkoutWindow) checkoutWindow.location.href = created.authorizationUrl
      else window.location.assign(created.authorizationUrl)

      setNotice(
        `Paystack checkout opened for ${currency.format(created.amount)}. You will be redirected back after payment.`,
      )
    } catch (e) {
      checkoutWindow?.close()
      setError(e instanceof Error ? e.message : "Unable to create the Paystack checkout.")
    }
  }

  if (fees.isLoading) {
    return (
      <div className="flex items-center justify-center p-16 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading your fee account...
      </div>
    )
  }

  if (fees.isError) {
    return (
      <div className="p-16">
        <div className="mx-auto max-w-xl rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center">
          <AlertCircle className="mx-auto mb-2 h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive">Unable to load your fee account.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {fees.error instanceof Error ? fees.error.message : "Please try again."}
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => fees.refetch()}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const studentName = fees.data?.student?.studentName ?? "Student"
  const paymentCount = fees.data?.payments?.length ?? 0

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fees &amp; Payments</h1>
          <p className="text-sm text-muted-foreground">
            {studentName} · Student ID {fees.data?.student?.studentId ?? "—"}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Paying via Paystack (Mobile Money / Card / Bank Transfer)</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-600/30 bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          {notice}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-400">{currency.format(balance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {fees.data?.invoices.filter((i) => i.status !== "PAID").length ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Payments Made</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{paymentCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" /> Make a Payment
          </CardTitle>
          <CardDescription>
            {pending
              ? "A payment is already in progress for this account."
              : "Pay any amount up to your outstanding balance. You will choose the method on the Paystack checkout."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pending ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300/50 bg-amber-50 p-4 dark:bg-amber-950/20">
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <span>
                  Payment in progress — <span className="font-medium">{pending.reference}</span> · {currency.format(pending.amount)}
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => fees.refetch()}>
                  Re-check status
                </Button>
                {pending.authorizationUrl && (
                  <Button size="sm" onClick={handlePayNow}>
                    Resume checkout
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pay-amount" className="text-xs font-medium">Amount</Label>
                <Input
                  id="pay-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={effectiveAmount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-44"
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="payer-email" className="text-xs font-medium">Payer email</Label>
                <Input
                  id="payer-email"
                  type="email"
                  value={payerEmail}
                  onChange={(e) => setPayerEmail(e.target.value)}
                  placeholder="parent@example.com"
                  className="w-full"
                />
              </div>
              <Button
                onClick={handlePayNow}
                disabled={createCheckout.isPending}
                className="flex items-center gap-2"
              >
                {createCheckout.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ReceiptText className="h-4 w-4" />
                )}
                Pay Now
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Invoices</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(fees.data?.invoices?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-16 text-center text-sm text-muted-foreground">
                    No invoices on record.
                  </TableCell>
                </TableRow>
              )}
              {fees.data?.invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.invoiceNo}</TableCell>
                  <TableCell>{inv.description}</TableCell>
                  <TableCell className="text-right">{currency.format(inv.amount)}</TableCell>
                  <TableCell className="text-right">{currency.format(inv.paidAmount)}</TableCell>
                  <TableCell>{formatDate(inv.dueDate)}</TableCell>
                  <TableCell>{statusBadge(inv.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Payment History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(fees.data?.payments?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-16 text-center text-sm text-muted-foreground">
                    No payments yet.
                  </TableCell>
                </TableRow>
              )}
              {fees.data?.payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.receiptNumber}</TableCell>
                  <TableCell>{p.paymentMethod}</TableCell>
                  <TableCell className="text-right">{currency.format(p.amountPaid)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.referenceNo}</TableCell>
                  <TableCell>{formatDate(p.dateProcessed)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
