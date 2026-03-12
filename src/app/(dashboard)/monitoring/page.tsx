"use client"

import { Card } from "@/components/Card"
import { Button } from "@/components/Button"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  RiAlarmWarningFill,
  RiEditBoxLine,
  RiEyeLine,
  RiTimeLine,
} from "@remixicon/react"
import { apiGet } from "@/lib/api-client"
import { toast } from "@/lib/toast"
import { Badge } from "@/components/Badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableRoot,
} from "@/components/Table"
import { SkeletonBlock } from "@/components/ui/Loading"

type Schedule = {
  id: number
  location_name: string
  week_number: number
  year: number
  week_start: string
  week_end: string
  due_date: string
  status: string
  assigned_to_name: string | null
  completion: string
}

type Location = { id: number; name: string }

function statusToBadgeVariant(status: string) {
  switch (status) {
    case "completed":
      return "success" as const
    case "overdue":
      return "error" as const
    case "in_progress":
      return "default" as const
    case "pending":
    default:
      return "neutral" as const
  }
}

function getActionStyle(status: string): {
  label: string
  variant: "primary" | "secondary" | "destructive" | "light" | "ghost"
  Icon: React.ComponentType<{ className?: string }>
} {
  switch (status) {
    case "completed":
      return { label: "View", variant: "secondary", Icon: RiEyeLine }
    case "overdue":
      return { label: "Fill Now", variant: "destructive", Icon: RiAlarmWarningFill }
    case "in_progress":
      return { label: "Continue", variant: "primary", Icon: RiEditBoxLine }
    case "pending":
    default:
      return { label: "Start", variant: "light", Icon: RiTimeLine }
  }
}

export default function MonitoringPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [filterLocation, setFilterLocation] = useState("")
  const [filterStatus, setFilterStatus] = useState("")

  const loadSchedules = useCallback(async () => {
    const params = new URLSearchParams()
    if (filterLocation) params.set("locationId", filterLocation)
    if (filterStatus) params.set("status", filterStatus)
    setLoading(true)
    try {
      // schedules endpoint is legacy (non-envelope) today
      const res = await fetch(`/api/schedules?${params}`)
      const data = (await res.json()) as unknown
      if (!res.ok) {
        const errMsg =
          (data as { error?: string } | null)?.error ?? "Gagal memuat jadwal"
        throw new Error(errMsg)
      }
      setSchedules(Array.isArray(data) ? (data as Schedule[]) : [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memuat jadwal")
      setSchedules([])
    } finally {
      setLoading(false)
    }
  }, [filterLocation, filterStatus])

  useEffect(() => {
    loadSchedules()
  }, [loadSchedules])

  useEffect(() => {
    apiGet<Location[]>("/api/locations")
      .then(setLocations)
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : "Gagal memuat lokasi"),
      )
  }, [])

  return (
    <main>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            Monthly Monitoring
          </h1>
          <p className="text-gray-500 sm:text-sm/6 dark:text-gray-500">
            Pilih jadwal untuk mengisi form monitoring bulanan
          </p>
        </div>
      </div>
      <Card className="mt-6 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Lokasi
            </label>
            <select
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
            >
              <option value="">Semua</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
            >
              <option value="">Semua</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>
      </Card>
      <Card className="mt-6 overflow-hidden p-0">
        {/* Mobile: card list */}
        <div className="p-4 md:hidden">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-28 w-full rounded-lg" />
              ))}
            </div>
          ) : schedules.length === 0 ? (
            <p className="text-sm text-gray-500">Tidak ada jadwal.</p>
          ) : (
            <div className="space-y-3">
              {schedules.map((s) => {
                const action = getActionStyle(s.status)
                const Icon = action.Icon
                return (
                  <Card key={s.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-50">
                          Week {s.week_number}, {s.year}
                        </p>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                          {s.location_name}
                        </p>
                      </div>
                      <Badge variant={statusToBadgeVariant(s.status)}>
                        {s.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-gray-500">Periode</p>
                        <p className="text-gray-900 dark:text-gray-50">
                          {new Date(s.week_start).toLocaleDateString("id-ID")} –{" "}
                          {new Date(s.week_end).toLocaleDateString("id-ID")}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Due</p>
                        <p className="text-gray-900 dark:text-gray-50">
                          {new Date(s.due_date).toLocaleDateString("id-ID", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Assigned</p>
                        <p className="text-gray-900 dark:text-gray-50">
                          {s.assigned_to_name ?? "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Completion</p>
                        <p className="text-gray-900 dark:text-gray-50">
                          {s.completion}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button
                        asChild
                        variant={action.variant}
                        className="!rounded-full !px-4 !py-2 !text-sm !shadow-none"
                      >
                        <Link
                          href={`/monitoring/${s.id}`}
                          className="inline-flex items-center gap-2"
                        >
                          <Icon className="size-4" />
                          {action.label}
                        </Link>
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* Desktop: table */}
        <div className="hidden md:block">
          <TableRoot>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Periode</TableHeaderCell>
                  <TableHeaderCell>Location</TableHeaderCell>
                  <TableHeaderCell>Period</TableHeaderCell>
                  <TableHeaderCell>Due Date</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Assigned To</TableHeaderCell>
                  <TableHeaderCell>Completion</TableHeaderCell>
                  <TableHeaderCell>Action</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8}>
                        <SkeletonBlock className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  schedules.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-gray-900 dark:text-gray-50">
                        {new Date(s.week_start).toLocaleDateString("id-ID", {
                          month: "long",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>{s.location_name}</TableCell>
                      <TableCell>
                        {new Date(s.week_start).toLocaleDateString("id-ID")} –{" "}
                        {new Date(s.week_end).toLocaleDateString("id-ID")}
                      </TableCell>
                      <TableCell className="text-gray-900 dark:text-gray-50">
                        {new Date(s.due_date).toLocaleDateString("id-ID", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusToBadgeVariant(s.status)}>
                          {s.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>{s.assigned_to_name ?? "—"}</TableCell>
                      <TableCell className="text-gray-900 dark:text-gray-50">
                        {s.completion}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const action = getActionStyle(s.status)
                          const Icon = action.Icon
                          return (
                            <Button
                              asChild
                              variant={action.variant}
                              className="!rounded-full !px-3 !py-1.5 !text-xs !shadow-none"
                            >
                              <Link
                                href={`/monitoring/${s.id}`}
                                className="inline-flex items-center gap-1.5"
                              >
                                <Icon className="size-3.5" />
                                {action.label}
                              </Link>
                            </Button>
                          )
                        })()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableRoot>
        </div>
      </Card>
    </main>
  )
}
