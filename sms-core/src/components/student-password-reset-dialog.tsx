"use client"

import { useState } from "react"
import { Check, Copy, KeyRound, Loader2, ShieldAlert, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fetchWithAuth } from "@/lib/fetch-with-auth"

export type StudentPasswordResetTarget = {
  id: string
  studentId: string
  studentName: string
  portalEmail?: string
}

interface StudentPasswordResetDialogProps {
  student: StudentPasswordResetTarget
  onClose: () => void
}

type PasswordResetResponse = {
  success?: boolean
  message?: string
  data?: {
    temporaryPassword?: string
    mustChangePassword?: boolean
  }
}

export function StudentPasswordResetDialog({
  student,
  onClose,
}: StudentPasswordResetDialogProps) {
  const [temporaryPassword, setTemporaryPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState("")

  const resetPassword = async () => {
    setSubmitting(true)
    setError("")

    try {
      const response = await fetchWithAuth(
        `/auth/students/${encodeURIComponent(student.id)}/password-reset`,
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      )

      const result = (await response
        .json()
        .catch(() => null)) as PasswordResetResponse | null

      const generatedPassword =
        result?.data?.temporaryPassword

      if (
        !response.ok ||
        !result?.success ||
        !generatedPassword
      ) {
        throw new Error(
          result?.message ||
            `Password reset failed with HTTP ${response.status}.`
        )
      }

      setTemporaryPassword(generatedPassword)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to reset the student password."
      )
      setSubmitting(false)
    }
  }

  const copyPassword = async () => {
    if (!temporaryPassword) return

    if (!navigator.clipboard) {
      setError(
        "Clipboard access is unavailable. Select and copy the temporary password manually."
      )
      return
    }

    try {
      await navigator.clipboard.writeText(
        temporaryPassword
      )
      setCopied(true)
    } catch {
      setError(
        "The password could not be copied automatically. Select and copy it manually."
      )
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-reset-title"
        className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <KeyRound className="h-5 w-5" />
            </div>

            <div>
              <h2
                id="password-reset-title"
                className="text-lg font-semibold text-zinc-950 dark:text-zinc-50"
              >
                Reset student password
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {student.studentName} · {student.studentId}
              </p>
              {student.portalEmail && (
                <p className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                  {student.portalEmail}
                </p>
              )}
            </div>
          </div>

          {!temporaryPassword && (
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              aria-label="Close password reset"
              className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {!temporaryPassword ? (
          <>
            <div className="mt-6 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="space-y-2">
                <p className="font-semibold">
                  This immediately ends all of the student&apos;s existing sessions.
                </p>
                <p>
                  A random temporary password will be shown once. The student must replace it at the next sign-in.
                </p>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300"
              >
                {error}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void resetPassword()}
                disabled={submitting}
                className="gap-2"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                {submitting
                  ? "Generating…"
                  : "Generate temporary password"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                <Check className="h-4 w-4" />
                Password reset complete
              </div>

              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Temporary password — shown once
              </p>

              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 select-all overflow-x-auto rounded border border-zinc-300 bg-white px-3 py-3 font-mono text-sm font-semibold text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50">
                  {temporaryPassword}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => void copyPassword()}
                  aria-label="Copy temporary password"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <p className="mt-3 text-xs leading-5 text-zinc-600 dark:text-zinc-300">
                Communicate this password privately. Do not send it in a public group or include it in screenshots.
              </p>
            </div>

            {error && (
              <p
                role="alert"
                className="mt-4 text-sm font-medium text-red-700 dark:text-red-300"
              >
                {error}
              </p>
            )}

            <Button
              type="button"
              onClick={onClose}
              className="mt-6 w-full"
            >
              I have securely saved it
            </Button>
          </>
        )}
      </section>
    </div>
  )
}
