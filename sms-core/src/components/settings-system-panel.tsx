"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { RefreshCw, ScrollText } from "lucide-react"
import { getAuditLog, type AuditEntry } from "@/lib/api/settings"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

function statusBadge(status: number) {
  if (status < 300) return <Badge variant="secondary" className="font-mono text-[11px]">{status}</Badge>
  if (status < 400) return <Badge variant="outline" className="font-mono text-[11px]">{status}</Badge>
  return <Badge variant="destructive" className="font-mono text-[11px]">{status}</Badge>
}

function actionBadge(action: string) {
  if (action === "DATA_WIPE") {
    return <Badge variant="destructive" className="font-mono text-[11px]">{action}</Badge>
  }
  return <Badge variant="outline" className="font-mono text-[11px]">{action}</Badge>
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

export default function SystemPanel() {
  const [limit, setLimit] = React.useState(50)

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["settings", "audit", limit],
    queryFn: () => getAuditLog(limit),
  })

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ScrollText className="h-4 w-4" /> Audit trail
          </CardTitle>
          <CardDescription>
            Every sensitive action the platform records — logins, profile changes and, above all,
            data wipes. This log is never wiped.
          </CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError ? (
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Failed to load the audit log."}
            </p>
          ) : !data || data.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No audit entries yet. Actions will appear here as they happen.
            </p>
          ) : (
            <>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">When</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead className="w-40">Action</TableHead>
                      <TableHead className="hidden md:table-cell">Request</TableHead>
                      <TableHead className="w-16 text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((entry: AuditEntry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTime(entry.createdAt)}
                        </TableCell>
                        <TableCell className="text-xs">
                          <p className="font-medium">{entry.actorEmail}</p>
                          <p className="text-muted-foreground">{entry.actorRole}</p>
                        </TableCell>
                        <TableCell>{actionBadge(entry.action)}</TableCell>
                        <TableCell className="hidden font-mono text-[11px] text-muted-foreground md:table-cell">
                          {entry.method} {entry.path}
                        </TableCell>
                        <TableCell className="text-right">{statusBadge(entry.responseStatus)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                Showing the last {data.length} entries.
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={limit >= 200}
                  onClick={() => setLimit((l) => Math.min(l + 100, 200))}
                >
                  Show more
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
