"use client"

import { Card } from "@/components/Card"
import { Button } from "@/components/Button"
import { Label } from "@/components/Label"
import { useEffect, useState } from "react"
import { apiGet } from "@/lib/api-client"
import { toast } from "@/lib/toast"

type Location = { id: number; name: string; address: string | null; is_active: number }
type Schedule = {
  id: number
  location_id: number
  location_name: string
  week_number: number
  year: number
  week_start: string
  week_end: string
  due_date: string
  status: string
  completion: string
}

export default function ExportPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [locationId, setLocationId] = useState<string>("")
  const [scheduleId, setScheduleId] = useState<string>("")
  const [loadingSchedules, setLoadingSchedules] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    apiGet<Location[]>("/api/locations")
      .then(setLocations)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Gagal memuat lokasi"))
  }, [])

  useEffect(() => {
    if (!locationId) {
      setSchedules([])
      setScheduleId("")
      return
    }
    setLoadingSchedules(true)
    setScheduleId("")
    fetch(`/api/schedules?locationId=${locationId}&status=completed`)
      .then((r) => r.json())
      .then(setSchedules)
      .catch(() => setSchedules([]))
      .finally(() => setLoadingSchedules(false))
  }, [locationId])

  async function handleDownload() {
    if (!scheduleId) return
    setDownloading(true)
    try {
      const res = await fetch(`/api/schedules/${scheduleId}/session`)
      const data = await res.json()
      const sessionId = data?.sessionId
      if (sessionId) {
        window.open(`/api/sessions/${sessionId}/export/excel`, "_blank")
      } else {
        toast.error("Session tidak ditemukan untuk jadwal ini.")
      }
    } catch {
      toast.error("Gagal memulai unduhan.")
    } finally {
      setDownloading(false)
    }
  }

  const selectedSchedule = schedules.find((s) => String(s.id) === scheduleId)

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
        Export
      </h1>
      <p className="mt-1 text-gray-500 dark:text-gray-400">
        Pilih lokasi dan jadwal (completed) untuk mengunduh laporan Excel.
      </p>

      <Card className="mt-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Lokasi</Label>
            <select
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value="">— Semua / Pilih lokasi —</option>
              {locations.map((loc) => (
                <option key={loc.id} value={String(loc.id)}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Jadwal (completed)</Label>
            <select
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
              value={scheduleId}
              onChange={(e) => setScheduleId(e.target.value)}
              disabled={!locationId || loadingSchedules}
            >
              <option value="">— Pilih jadwal —</option>
              {schedules.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  W{s.week_number}/{s.year} — {s.location_name} ({s.completion})
                </option>
              ))}
            </select>
            {loadingSchedules && (
              <p className="mt-1 text-xs text-gray-500">Memuat jadwal...</p>
            )}
          </div>
        </div>

        {selectedSchedule && (
          <div className="mt-4 rounded-md border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-900/30">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Preview
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Lokasi: {selectedSchedule.location_name} · Minggu {selectedSchedule.week_number}{" "}
              {selectedSchedule.year} · Completion: {selectedSchedule.completion}
            </p>
          </div>
        )}

        <div className="mt-6">
          <Button
            onClick={handleDownload}
            disabled={!scheduleId || downloading}
          >
            {downloading ? "Memproses..." : "Download Excel"}
          </Button>
        </div>
      </Card>
    </div>
  )
}
