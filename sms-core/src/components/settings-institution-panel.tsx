"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Save, RefreshCw, Loader2 } from "lucide-react"
import {
  getInstitution,
  updateInstitution,
  type InstitutionProfile,
  type InstitutionUpdatePayload,
} from "@/lib/api/settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface FormState {
  schoolName: string
  schoolCode: string
  motto: string
  address: string
  phone: string
  email: string
  country: string
  timezone: string
  currency: string
}

function toForm(profile: InstitutionProfile): FormState {
  return {
    schoolName: profile.schoolName ?? "",
    schoolCode: profile.schoolCode ?? "",
    motto: profile.motto ?? "",
    address: profile.address ?? "",
    phone: profile.phone ?? "",
    email: profile.email ?? "",
    country: profile.country ?? "GH",
    timezone: profile.timezone ?? "Africa/Accra",
    currency: profile.currency ?? "GHS",
  }
}

export default function InstitutionPanel() {
  const { data: profile, isPending, isError, error, refetch } = useQuery({
    queryKey: ["settings", "institution"],
    queryFn: getInstitution,
  })

  if (isPending && !profile) {
    return (
      <Card>
        <CardContent className="space-y-4 p-5">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </CardContent>
      </Card>
    )
  }

  if (isError || !profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Institution profile</CardTitle>
          <CardDescription>{error instanceof Error ? error.message : "Failed to load."}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Try again
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Keyed by updatedAt: after a save the query cache is replaced, the key
  // changes, and the form remounts re-initialised from the fresh profile —
  // no state-sync effect required.
  return <InstitutionForm key={profile.updatedAt} profile={profile} />
}

function InstitutionForm({ profile }: { profile: InstitutionProfile }) {
  const queryClient = useQueryClient()
  const [form, setForm] = React.useState<FormState>(() => toForm(profile))
  const [currencyWarning, setCurrencyWarning] = React.useState(false)

  const mutation = useMutation({
    mutationFn: (payload: InstitutionUpdatePayload) => updateInstitution(payload),
    onSuccess: (updated) => {
      const currencyChanged = updated.currency !== profile.currency
      queryClient.setQueryData(["settings", "institution"], updated)
      toast.success("Institution saved", {
        description: currencyChanged
          ? `Currency is now ${updated.currency}. New financial documents use it.`
          : "Your institution profile has been updated.",
      })
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Could not save the institution profile."
      toast.error("Save failed", { description: message })
    },
  })

  const set = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setCurrencyWarning(key === "currency" && value !== profile.currency)
  }

  const currencyChanged = form.currency !== profile.currency

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>School identity</CardTitle>
          <CardDescription>Shown on the login screen, printed documents and receipts.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="set-schoolName">School name</Label>
            <Input
              id="set-schoolName"
              value={form.schoolName}
              onChange={(e) => set("schoolName", e.target.value)}
              placeholder="Jocomfy International School"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-schoolCode">School code</Label>
            <Input
              id="set-schoolCode"
              value={form.schoolCode}
              onChange={(e) => set("schoolCode", e.target.value)}
              placeholder="JCS-2025"
            />
            <p className="text-xs text-muted-foreground">
              Changing the code also changes the text you must type to confirm a data wipe.
            </p>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="set-motto">Motto</Label>
            <Input
              id="set-motto"
              value={form.motto}
              onChange={(e) => set("motto", e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="set-address">Address</Label>
            <Input
              id="set-address"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Street, city, country"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-phone">Phone</Label>
            <Input
              id="set-phone"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+233 ..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-email">Email</Label>
            <Input
              id="set-email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="office@school.com"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Locale &amp; currency</CardTitle>
          <CardDescription>Currency applies to fees, invoices, payroll and ledgers.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="set-currency">Currency (ISO code)</Label>
            <Input
              id="set-currency"
              value={form.currency}
              onChange={(e) => set("currency", e.target.value.toUpperCase())}
              maxLength={3}
              placeholder="GHS"
              className="font-mono uppercase"
            />
            {currencyWarning && currencyChanged && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Changing currency affects every new document. Existing amounts are kept as numbers.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-country">Country (2-letter)</Label>
            <Input
              id="set-country"
              value={form.country}
              onChange={(e) => set("country", e.target.value.toUpperCase())}
              maxLength={2}
              placeholder="GH"
              className="font-mono uppercase"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="set-timezone">Timezone</Label>
            <Input
              id="set-timezone"
              value={form.timezone}
              onChange={(e) => set("timezone", e.target.value)}
              placeholder="Africa/Accra"
            />
          </div>
        </CardContent>
        <CardFooter className="justify-between gap-3 border-t">
          <p className="text-xs text-muted-foreground">{new Date(profile.updatedAt).toLocaleString()}</p>
          <Button
            onClick={() =>
              mutation.mutate({
                schoolName: form.schoolName,
                schoolCode: form.schoolCode,
                motto: form.motto || null,
                address: form.address || null,
                phone: form.phone || null,
                email: form.email || null,
                country: form.country,
                timezone: form.timezone,
                currency: form.currency,
              })
            }
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            Save changes
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
