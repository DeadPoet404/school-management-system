"use client"

import * as React from "react"
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser"
import { BarcodeFormat, DecodeHintType } from "@zxing/library"
import { Camera, CameraOff, ScanLine } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * In-page QR scanner: shows the tablet camera in a video element and decodes
 * QR codes live with ZXing (pure JS — no native BarcodeDetector, so it works
 * in Firefox for Android). Each decoded token is forwarded to onScan.
 */
export function QrScanPanel({ onScan, disabled = false }: { onScan: (text: string) => void; disabled?: boolean }) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const controlsRef = React.useRef<IScannerControls | null>(null)
  const onScanRef = React.useRef(onScan)
  // de-dupe: same token within 4s is ignored (camera keeps re-reading)
  const lastTokenRef = React.useRef("")
  const lastAtRef = React.useRef(0)

  React.useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  const [on, setOn] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const stop = React.useCallback(async () => {
    if (controlsRef.current) {
      try {
        await controlsRef.current.stop()
      } catch {
        /* already stopped */
      }
      controlsRef.current = null
    }
    setOn(false)
  }, [])

  const start = React.useCallback(async () => {
    const video = videoRef.current
    if (!video || controlsRef.current) return
    setError(null)
    try {
      const hints = new Map<DecodeHintType, unknown>([
        [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]],
        [DecodeHintType.TRY_HARDER, true],
      ])
      const controls = await new BrowserQRCodeReader(hints, { delayBetweenScanAttempts: 250 }).decodeFromVideoDevice(
        undefined,
        video,
        (result) => {
          if (!result) return
          const text = result.getText()
          const now = Date.now()
          if (text === lastTokenRef.current && now - lastAtRef.current < 4000) return
          lastTokenRef.current = text
          lastAtRef.current = now
          onScanRef.current(text)
        }
      )
      controlsRef.current = controls
      setOn(true)
    } catch (e) {
      const denied = e instanceof Error && (e.name === "NotAllowedError" || e.name === "PermissionDeniedError")
      setError(denied ? "Camera permission blocked. Allow camera access in the site settings, then press Start camera again." : "Camera could not be started on this device.")
      setOn(false)
    }
  }, [])

  React.useEffect(() => () => void stop(), [stop])

  return (
    <div>
      {/* Fixed 16:9 frame: the camera feed can't change size, so the header,
          boarded counter and list below never shift while scanning. */}
      <div className={cn("relative aspect-video w-full overflow-hidden rounded-xl bg-stone-950", !on && "hidden")}>
        <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
      </div>
      {on ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <ScanLine className="h-4 w-4" />
            Camera scanning — hold the card in view
          </p>
          <button onClick={() => void stop()} className="inline-flex h-11 items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 text-sm font-bold text-stone-700 active:bg-stone-100">
            <CameraOff className="h-4 w-4" />
            Stop camera
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <button
            onClick={() => void start()}
            disabled={disabled}
            className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-stone-950 text-base font-bold text-white active:bg-stone-800 disabled:opacity-50"
          >
            <Camera className="h-5 w-5" />
            Start camera
          </button>
          {error && <p className="mt-2 text-center text-sm font-semibold text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
