"use client"

/* eslint-disable @next/next/no-img-element */

import * as React from "react"
import { Camera, ImageUp, Trash2, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fetchWithAuth } from "@/lib/fetch-with-auth"

const MAX_FILE_BYTES = 5 * 1024 * 1024

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
])

type PhotoState = "checking" | "available" | "missing"

type Notice = {
  tone: "success" | "error"
  message: string
} | null

export type StudentPhotoControlProps = {
  studentId: string
  studentName: string
}

function studentInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) return "ST"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()

  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase()
}

function responseMessage(payload: unknown, fallback: string): string {
  if (
    payload
    && typeof payload === "object"
    && "message" in payload
    && typeof payload.message === "string"
    && payload.message.trim()
  ) {
    return payload.message
  }

  return fallback
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const raw = await response.text()

  if (!raw) return null

  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

export function StudentPhotoControl({
  studentId,
  studentName,
}: StudentPhotoControlProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  const [photoState, setPhotoState] = React.useState<PhotoState>("checking")
  const [photoVersion, setPhotoVersion] = React.useState(0)
  const [isUploading, setIsUploading] = React.useState(false)
  const [isRemoving, setIsRemoving] = React.useState(false)
  const [notice, setNotice] = React.useState<Notice>(null)

  const initials = studentInitials(studentName)
  const isBusy = isUploading || isRemoving
  const photoUrl = `/api/students/${encodeURIComponent(studentId)}/photo?v=${photoVersion}`


  const openFilePicker = () => {
    if (!isBusy) inputRef.current?.click()
  }

  const uploadPhoto = async (file: File) => {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      setNotice({
        tone: "error",
        message: "Choose a JPEG, PNG, or WebP image.",
      })
      return
    }

    if (file.size > MAX_FILE_BYTES) {
      setNotice({
        tone: "error",
        message: "Student photo must not exceed 5 MB.",
      })
      return
    }

    setIsUploading(true)
    setNotice(null)

    try {
      const formData = new FormData()
      formData.append("photo", file)

      const response = await fetchWithAuth(
        `/students/${encodeURIComponent(studentId)}/photo`,
        {
          method: "POST",
          body: formData,
        },
      )

      const payload = await readResponsePayload(response)

      if (!response.ok) {
        throw new Error(
          responseMessage(
            payload,
            `Unable to upload student photo (HTTP ${response.status}).`,
          ),
        )
      }

      setPhotoState("checking")
      setPhotoVersion(Date.now())
      setNotice({
        tone: "success",
        message: "Student photo uploaded successfully.",
      })
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to upload student photo.",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] ?? null
    event.target.value = ""

    if (file) {
      await uploadPhoto(file)
    }
  }

  const removePhoto = async () => {
    if (
      !window.confirm(
        "Remove this student's private profile photo? The initials avatar will be used instead.",
      )
    ) {
      return
    }

    setIsRemoving(true)
    setNotice(null)

    try {
      const response = await fetchWithAuth(
        `/students/${encodeURIComponent(studentId)}/photo`,
        {
          method: "DELETE",
        },
      )

      const payload = await readResponsePayload(response)

      if (!response.ok) {
        throw new Error(
          responseMessage(
            payload,
            `Unable to remove student photo (HTTP ${response.status}).`,
          ),
        )
      }

      setPhotoState("missing")
      setPhotoVersion(Date.now())
      setNotice({
        tone: "success",
        message: "Student photo removed. The initials avatar is now active.",
      })
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to remove student photo.",
      })
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <section className="mb-7 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-950/30">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div
          className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-amber-400 bg-gradient-to-br from-blue-800 to-blue-950 text-white shadow-sm"
          aria-label={`${studentName || "Student"} profile photo`}
        >
          <div
            className={`absolute inset-0 grid place-items-center transition-opacity ${
              photoState === "available" ? "opacity-0" : "opacity-100"
            }`}
            aria-hidden={photoState === "available"}
          >
            <UserRound className="absolute h-16 w-16 text-white/25" />
            <span className="relative text-xl font-bold tracking-wide">
              {initials}
            </span>
          </div>

          <img
            key={photoUrl}
            src={photoUrl}
            alt={`${studentName || "Student"} profile photo`}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity ${
              photoState === "available" ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setPhotoState("available")}
            onError={() => setPhotoState("missing")}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Student profile photo
            </h2>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-800 dark:bg-blue-950 dark:text-blue-200">
              Private
            </span>
          </div>

          <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-600 dark:text-zinc-400">
            This photo is available only to authorized school staff and appears
            on the official A5 payment receipt. Without a photo, the receipt
            uses the initials avatar automatically.
          </p>

          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-500">
            JPEG, PNG, or WebP · Maximum 5 MB
          </p>

          {notice && (
            <p
              className={`mt-2 text-xs font-medium ${
                notice.tone === "success"
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-red-700 dark:text-red-300"
              }`}
              role="status"
              aria-live="polite"
            >
              {notice.message}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 sm:w-40 sm:flex-col">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={handleFileChange}
          />

          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            onClick={openFilePicker}
            disabled={isBusy}
          >
            {photoState === "available" ? (
              <ImageUp className="h-3.5 w-3.5" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
            {isUploading
              ? "Uploading..."
              : photoState === "available"
                ? "Replace photo"
                : "Upload photo"}
          </Button>

          {photoState === "available" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
              onClick={removePhoto}
              disabled={isBusy}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isRemoving ? "Removing..." : "Remove"}
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
