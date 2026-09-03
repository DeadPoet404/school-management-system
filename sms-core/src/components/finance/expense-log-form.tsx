"use client"

import * as React from "react"
import { useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { fetchWithAuth } from "@/lib/fetch-with-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const EXPENSE_CATEGORIES = [
  "Utilities",
  "Maintenance",
  "Supplies",
  "Equipment",
  "Logistics",
  "Other",
]

const PAYMENT_METHODS = [
  "Cash",
  "Bank Transfer",
  "Mobile Money",
  "Cheque",
  "Card / POS",
]

function todayValue() {
  const date = new Date()
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 10)
}

export function ExpenseLogForm({ onSaved }: { onSaved?: () => void }) {
  const queryClient = useQueryClient()
  const [submitting, setSubmitting] = useState(false)

  const [vendorName, setVendorName] = useState("")
  const [category, setCategory] = useState("")
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("")
  const [expenseDate, setExpenseDate] = useState(todayValue())

  const canSubmit =
    vendorName.trim() !== "" &&
    category !== "" &&
    description.trim() !== "" &&
    Number(amount) > 0 &&
    paymentMethod !== "" &&
    expenseDate !== ""

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit || submitting) return

    setSubmitting(true)
    try {
      const response = await fetchWithAuth("/finance/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorName: vendorName.trim(),
          category,
          description: description.trim(),
          amount: Number(amount),
          paymentMethod,
          expenseDate: new Date(`${expenseDate}T00:00:00`).toISOString(),
        }),
      })

      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean
        message?: string
      }

      if (!response.ok) {
        throw new Error(payload.message || "Could not log the expense.")
      }

      toast.success("Expense Logged", {
        description: `${paymentMethod} · GH₵${Number(amount).toLocaleString()} — awaiting approval.`,
      })

      await queryClient.invalidateQueries({ queryKey: ["finance", "expenses"] })
      onSaved?.()
    } catch (error) {
      toast.error("Logging Failed", {
        description:
          error instanceof Error
            ? error.message
            : "Could not reach backend service layers.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex h-full w-full flex-col overflow-hidden"
    >
      <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 py-6">
        <div className="space-y-1">
          <h4 className="text-base font-semibold tracking-tight text-foreground">
            Log an operating expense
          </h4>
          <p className="text-xs text-muted-foreground">
            Record a procurement outflow. New entries start as{" "}
            <span className="font-medium text-foreground">
              Pending Approval
            </span>{" "}
            until cleared.
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="expense-vendor"
            className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Payee / Vendor
          </label>
          <Input
            id="expense-vendor"
            value={vendorName}
            onChange={(event) => setVendorName(event.target.value)}
            placeholder="e.g. Accra Water Company"
            className="h-9 rounded-md text-sm"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="expense-category"
            className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Category
          </label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="expense-category" className="h-9 rounded-md text-sm">
              <SelectValue placeholder="Select category…" />
            </SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORIES.map((item) => (
                <SelectItem key={item} value={item} className="text-sm">
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="expense-description"
            className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Description
          </label>
          <Textarea
            id="expense-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What is this spend for?"
            rows={3}
            className="rounded-md text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label
              htmlFor="expense-amount"
              className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              Amount (GH₵)
            </label>
            <Input
              id="expense-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              className="h-9 rounded-md text-sm tabular-nums"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="expense-date"
              className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              Expense date
            </label>
            <Input
              id="expense-date"
              type="date"
              value={expenseDate}
              onChange={(event) => setExpenseDate(event.target.value)}
              className="h-9 rounded-md text-sm"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="expense-method"
            className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Payment method
          </label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger id="expense-method" className="h-9 rounded-md text-sm">
              <SelectValue placeholder="Select method…" />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((method) => (
                <SelectItem key={method} value={method} className="text-sm">
                  {method}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border/70 px-6 py-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onSaved}
          className="h-9 px-3 text-xs font-medium"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={!canSubmit || submitting}
          className="h-9 px-4 text-xs font-medium"
        >
          {submitting ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Logging…
            </>
          ) : (
            "Log Expense"
          )}
        </Button>
      </div>
    </form>
  )
}
