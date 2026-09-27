"use client"

import * as React from "react"

/** Registers the service worker (production only — dev hot-reload would fight it). */
export function SwRegister() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Non-fatal: the app works without offline shell support.
      })
    }
    if (document.readyState === "complete") {
      register()
      return
    }
    window.addEventListener("load", register)
    return () => window.removeEventListener("load", register)
  }, [])

  return null
}
