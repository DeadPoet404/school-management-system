#!/usr/bin/env python3
"""SMS-010 (frontend): calendar feed actions in timetable-structure-setup.tsx.

Adds a "Step 4 -- Calendar Feed" section to the Timetable Structure Setup
module, wired to the active class tab:
  * Copy Feed Link       -- POST /timetable/calendar/:classId/token -> clipboard
  * Subscribe via Google -- popup-proof window.open pre-open, then retarget to
                            calendar.google.com/render?cid=<encoded feed URL>
  * Regenerate Link      -- fresh stateless token, copied with a distinct toast

Verified-against-clone anchors only (file untouched by every prior patch ->
clone-authoritative). Idempotent via skip markers.

Run from ~/sms-monorepo:
  cd ~/sms-monorepo && python3 apply_sms010b.py
"""
from pathlib import Path

COMPONENT = Path("sms-core/src/components/timetable-structure-setup.tsx")


def replace_once(content: str, old: str, new: str, label: str) -> str:
    n = content.count(old)
    if n != 1:
        raise SystemExit(f"ABORT [{label}]: expected 1 anchor, found {n}. Patch NOT applied.")
    return content.replace(old, new, 1)


def edit(content: str, old: str, new: str, label: str, skip_marker: str) -> str:
    if skip_marker in content:
        print(f"SKIP: already patched ({label}).")
        return content
    out = replace_once(content, old, new, label)
    print(f"OK: timetable-structure-setup.tsx  ({label})")
    return out


HANDLERS = '''

  /* ── SMS-010: calendar feed actions (token-signed public .ics) ─────────── */

  const mintFeedUrl = React.useCallback(async (): Promise<string> => {
    if (!activeSection) {
      throw new Error("Select a class first.")
    }
    const response = await fetchWithAuth(
      `/timetable/calendar/${activeSection}/token`,
      { method: "POST" }
    )
    const payload = await response.json()
    if (!response.ok || !payload?.success || typeof payload?.data?.path !== "string") {
      throw new Error(payload?.message ?? "Unable to create a calendar feed link.")
    }
    // Same-origin: the frontend rewrites /api/* to the backend, so the feed
    // URL is origin + path and works for external calendar apps when this
    // origin is publicly reachable.
    return `${window.location.origin}${payload.data.path}`
  }, [activeSection])

  const runCopyAction = async (
    busy: "copy" | "refresh",
    successMessage: string
  ): Promise<void> => {
    try {
      setCalendarBusy(busy)
      const url = await mintFeedUrl()
      try {
        await navigator.clipboard.writeText(url)
        toast.success(successMessage)
      } catch {
        // Clipboard API can be denied; surface the URL for manual selection.
        toast.info(url, { duration: 20000 })
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to create a calendar feed link."
      )
    } finally {
      setCalendarBusy(null)
    }
  }

  const handleCopyFeedLink = () => {
    void runCopyAction("copy", "Calendar feed link copied.")
  }

  const handleRegenerateLink = () => {
    void runCopyAction("refresh", "Fresh calendar feed link minted and copied.")
  }

  const handleGoogleSubscribe = () => {
    // Pre-open synchronously (popup blockers deny window.open after await);
    // popup is scoped OUTSIDE the async body so catch can close it (SMS-007e).
    const popup = window.open("", "_blank")
    void (async () => {
      try {
        setCalendarBusy("google")
        const url = await mintFeedUrl()
        const subscribeUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(url)}`
        if (popup) {
          popup.location.href = subscribeUrl
        } else {
          try {
            await navigator.clipboard.writeText(url)
            toast.success("Popup blocked -- feed link copied; add it in Google Calendar via From URL.")
          } catch {
            toast.info(subscribeUrl, { duration: 20000 })
          }
        }
      } catch (error) {
        popup?.close()
        toast.error(
          error instanceof Error ? error.message : "Unable to create a calendar feed link."
        )
      } finally {
        setCalendarBusy(null)
      }
    })()
  }
'''

SECTION_JSX = '''          <section className="space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                Step 4
              </p>
              <h2 className="mt-1 text-base font-semibold">
                Calendar Feed ({activeSectionLabel})
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Subscribe this class timetable in Google Calendar or any .ics
                app. Feeds are read-only weekly weekday recurrence, bounded by
                the active term.
              </p>
            </div>

            <div className="rounded-lg border border-stone-100 bg-stone-50/60 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyFeedLink}
                  disabled={calendarBusy !== null || !activeSection}
                >
                  {calendarBusy === "copy" ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Link2 className="mr-1 h-3.5 w-3.5" />
                  )}
                  Copy Feed Link
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGoogleSubscribe}
                  disabled={calendarBusy !== null || !activeSection}
                >
                  {calendarBusy === "google" ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CalendarPlus className="mr-1 h-3.5 w-3.5" />
                  )}
                  Subscribe via Google
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRegenerateLink}
                  disabled={calendarBusy !== null || !activeSection}
                >
                  {calendarBusy === "refresh" ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1 h-3.5 w-3.5" />
                  )}
                  Regenerate Link
                </Button>
              </div>
              <p className="mt-2 text-[11px] leading-snug text-stone-400">
                Links are stateless HMAC-signed URLs: anyone holding one can read
                this timetable. Regenerating mints a fresh link; rotating the
                server CALENDAR_FEED_SECRET invalidates every outstanding link at
                once. Google refreshes subscribed calendars on its own schedule,
                which can lag hours behind timetable edits.
              </p>
            </div>
          </section>

'''


def main() -> None:
    if not COMPONENT.is_file():
        raise SystemExit(f"ABORT: {COMPONENT} not found. Run from ~/sms-monorepo.")

    c = COMPONENT.read_text(encoding="utf-8")

    c = edit(
        c,
        "  BookOpen,\n  Clock,\n",
        "  BookOpen,\n  CalendarPlus,\n  Clock,\n",
        "icon imports: CalendarPlus",
        "CalendarPlus,",
    )
    c = edit(
        c,
        "  Layers,\n  Loader2,\n",
        "  Layers,\n  Link2,\n  Loader2,\n",
        "icon imports: Link2",
        "Link2,",
    )
    c = edit(
        c,
        "  Plus,\n  Trash2,\n} from \"lucide-react\"\n",
        "  Plus,\n  RefreshCw,\n  Trash2,\n} from \"lucide-react\"\n",
        "icon imports: RefreshCw",
        "RefreshCw,",
    )

    c = edit(
        c,
        "  const [isSubmitting, setIsSubmitting] = React.useState(false)\n",
        "  const [isSubmitting, setIsSubmitting] = React.useState(false)\n"
        "  // SMS-010: which feed action is in flight (disables the trio)\n"
        "  const [calendarBusy, setCalendarBusy] = React.useState<null | \"copy\" | \"google\" | \"refresh\">(null)\n",
        "calendarBusy state",
        "setCalendarBusy",
    )

    c = edit(
        c,
        '  const activeSectionLabel =\n'
        '    academicSections.find((section) => section.id === activeSection)?.label ?? ""\n',
        '  const activeSectionLabel =\n'
        '    academicSections.find((section) => section.id === activeSection)?.label ?? ""\n'
        + HANDLERS,
        "calendar feed handlers",
        "mintFeedUrl",
    )

    c = edit(
        c,
        '          <div className="flex justify-end border-t pt-6">\n',
        SECTION_JSX + '          <div className="flex justify-end border-t pt-6">\n',
        "Step 4 calendar feed section",
        "Step 4",
    )

    COMPONENT.write_text(c, encoding="utf-8")

    # Post-verify structural expectations before the user runs gates.
    final = COMPONENT.read_text(encoding="utf-8")
    checks = {
        "icons imported":      all(ic in final for ic in ("CalendarPlus,", "Link2,", "RefreshCw,")),
        "state hook present":  "setCalendarBusy" in final,
        "mint helper present": "mintFeedUrl" in final and "/token`" in final,
        "popup pre-open":      'window.open("", "_blank")' in final,
        "google render cid":   "calendar.google.com/calendar/render?cid=" in final,
        "Step 4 section":      "Step 4" in final and "Regenerate Link" in final,
        "buttons are type button (no form submit)":
            final.count('type="button"') >= 9,
    }
    bad = [k for k, ok in checks.items() if not ok]
    for k, ok in checks.items():
        print(f"  {'PASS' if ok else 'FAIL'}  {k}")
    if bad:
        raise SystemExit("ABORT: post-verify failed -- do not run gates; report this output.")
    print()
    print("SMS-010 frontend applied. Next: frontend gates, docker rebuild, browser ritual.")
    print("APPLY010B_EXIT=0")


if __name__ == "__main__":
    main()
