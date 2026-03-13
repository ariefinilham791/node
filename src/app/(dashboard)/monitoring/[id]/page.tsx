"use client"

import { Card } from "@/components/Card"
import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { Label } from "@/components/Label"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import { RiArrowDownSLine, RiArrowRightSLine, RiCheckboxCircleFill, RiEdit2Line, RiRefreshLine } from "@remixicon/react"
import type { MetricField } from "@/types"
import { toast } from "@/lib/toast"
import { SkeletonBlock } from "@/components/ui/Loading"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

type ServerWithComponents = {
  id: number
  hostname: string
  name: string | null
  os: string | null
  ip_address: string | null
  sort_order: number
  components: {
    id: number
    label: string
    slot_index: number
    type_name: string
    metric_schema: unknown
    specs?: Record<string, unknown> | null
    unit_label?: string | null
  }[]
}

function parseMetricSchema(schema: unknown): MetricField[] {
  if (!Array.isArray(schema)) return []
  return schema.filter(
    (f): f is MetricField =>
      f && typeof f === "object" && "key" in f && typeof (f as MetricField).key === "string"
  ) as MetricField[]
}

function formatStandard(specs: Record<string, unknown> | null | undefined): string {
  if (!specs) return "—"
  const entries = Object.entries(specs).filter(
    ([, v]) => v != null && String(v).trim() !== "",
  )
  if (entries.length === 0) return "—"
  // Prefer common keys first
  const preferred = [
    "capacity_gb",
    "size_gb",
    "capacity",
    "size",
    "total_ram_gb",
    "serial_number",
    "model",
    "standard",
    "max",
    "limit",
  ]
  const sorted = [
    ...entries.filter(([k]) => preferred.includes(String(k).toLowerCase())),
    ...entries.filter(([k]) => !preferred.includes(String(k).toLowerCase())),
  ]
  const top = sorted.slice(0, 3).map(([k, v]) => `${k}: ${String(v)}`)
  return top.join(" • ")
}

function getUsedFieldMeta(comp: ServerWithComponents["components"][number]) {
  const fields = parseMetricSchema(comp.metric_schema)
  const firstNumber = fields.find((f) => f.input_type === "number") ?? fields[0]
  return {
    label: firstNumber?.label ?? "Used",
    unit: comp.unit_label ?? firstNumber?.unit ?? "",
  }
}

function getDiskVolumes(specs: Record<string, unknown> | null | undefined): Array<{ name: string; standard_gb: number | null }> {
  if (!specs) return []
  const raw = (specs as Record<string, unknown>).volumes
  if (!Array.isArray(raw)) return []
  return raw
    .map((r) => {
      if (!r || typeof r !== "object") return null
      const o = r as Record<string, unknown>
      const name = o.name != null ? String(o.name).trim() : ""
      const standard_gb =
        o.standard_gb == null || String(o.standard_gb).trim() === ""
          ? null
          : Number(o.standard_gb)
      if (!name) return null
      return { name, standard_gb }
    })
    .filter(Boolean) as Array<{ name: string; standard_gb: number | null }>
}

function parseUsedPct(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

function computeDiskUsedSummary(volumes: Array<{ name: string; standard_gb: number | null }>, volMetrics: Record<string, unknown>) {
  // Weighted average by standard_gb when available, else fallback to max used%
  let weightedSum = 0
  let weightTotal = 0
  let maxUsed: number | null = null
  let anyFail = false
  let anyOk = false
  let anyNa = false

  for (const v of volumes) {
    const row = (volMetrics[v.name] as Record<string, unknown> | undefined) ?? {}
    const usedPct = parseUsedPct(row.used)
    const status = row.status != null ? String(row.status) : ""
    if (status === "FAIL") anyFail = true
    else if (status === "OK") anyOk = true
    else if (status === "N/A" || status === "") anyNa = true

    if (usedPct != null) {
      maxUsed = maxUsed == null ? usedPct : Math.max(maxUsed, usedPct)
      if (v.standard_gb != null && Number.isFinite(v.standard_gb)) {
        weightedSum += usedPct * v.standard_gb
        weightTotal += v.standard_gb
      }
    }
  }

  const usedSummary =
    weightTotal > 0 ? weightedSum / weightTotal : maxUsed
  const statusSummary = anyFail ? "FAIL" : anyOk ? "OK" : anyNa ? "N/A" : ""
  return { usedSummary, statusSummary }
}

function statusPillClasses(status: string) {
  switch (status) {
    case "OK":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900"
    case "FAIL":
      return "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-900"
    case "N/A":
      return "bg-gray-50 text-gray-700 ring-gray-200 dark:bg-gray-900/40 dark:text-gray-300 dark:ring-gray-800"
    default:
      return "bg-gray-50 text-gray-600 ring-gray-200 dark:bg-gray-900/40 dark:text-gray-400 dark:ring-gray-800"
  }
}

function ChoiceButtons({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string; variant?: "primary" | "secondary" | "light" | "warning" | "destructive" }>
}) {
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <Button
            key={opt.value}
            type="button"
            variant={selected ? (opt.variant ?? "primary") : "secondary"}
            className={selected ? "!py-1.5 !text-xs" : "!py-1.5 !text-xs !shadow-none"}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </Button>
        )
      })}
    </div>
  )
}

export default function MonitoringFormPage() {
  const params = useParams()
  const scheduleId = Number(params.id)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [servers, setServers] = useState<ServerWithComponents[]>([])
  const [loadingSession, setLoadingSession] = useState(true)
  const [loadingServers, setLoadingServers] = useState(true)
  const [loadingDraft, setLoadingDraft] = useState(false)
  const [viewMode, setViewMode] = useState<"form" | "list">("form")
  const [expandedServerId, setExpandedServerId] = useState<number | null>(null)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [temperature, setTemperature] = useState("")
  const [humidity, setHumidity] = useState("")
  const [saving, setSaving] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [snapshots, setSnapshots] = useState<
    Record<
      number,
      {
        mem_used_pct: string
        cpu_load_pct: string
        email_pop3: string
        email_imap: string
        web_service: string
        overall_status: string
        remark: string
        readings: Record<number, Record<string, unknown>>
      }
    >
  >({})

  useEffect(() => {
    if (!scheduleId) return
    setLoadingSession(true)
    fetch(`/api/schedules/${scheduleId}/session`)
      .then((r) => r.json())
      .then((data) => {
        setSessionId(data.sessionId ?? null)
      })
      .catch(() => setSessionId(null))
      .finally(() => setLoadingSession(false))
  }, [scheduleId])

  useEffect(() => {
    if (!scheduleId) return
    setLoadingServers(true)
    fetch(`/api/schedules/${scheduleId}/servers`)
      .then((r) => r.json())
      .then(setServers)
      .catch(() => setServers([]))
      .finally(() => setLoadingServers(false))
  }, [scheduleId])

  useEffect(() => {
    if (!sessionId) return
    setLoadingDraft(true)
    fetch(`/api/sessions/${sessionId}/snapshots`)
      .then((r) => r.json())
      .then((data) => {
        if (data.session) {
          setTemperature(
            data.session.temperature != null ? String(data.session.temperature) : "",
          )
          setHumidity(
            data.session.humidity != null ? String(data.session.humidity) : "",
          )
        }
        if (Array.isArray(data.snapshots)) {
          const next: typeof snapshots = {}
          for (const s of data.snapshots as Array<{
            server_id: number
            mem_used_pct: number | null
            cpu_load_pct: number | null
            email_pop3: string
            email_imap: string
            web_service: string
            overall_status: string
            remark: string | null
            readings: Record<number, Record<string, unknown>>
          }>) {
            next[s.server_id] = {
              mem_used_pct:
                s.mem_used_pct != null ? String(s.mem_used_pct) : "",
              cpu_load_pct:
                s.cpu_load_pct != null ? String(s.cpu_load_pct) : "",
              email_pop3: s.email_pop3 ?? "N/A",
              email_imap: s.email_imap ?? "N/A",
              web_service: s.web_service ?? "UP",
              overall_status: s.overall_status ?? "UNKNOWN",
              remark: s.remark ?? "",
              readings: s.readings ?? {},
            }
          }
          setSnapshots(next)
          if (Object.keys(next).length > 0) setViewMode("list")
        }
      })
      .catch(() => {})
      .finally(() => setLoadingDraft(false))
  }, [sessionId])

  function getOrInitSnapshot(serverId: number) {
    if (!snapshots[serverId]) {
      setSnapshots((prev) => ({
        ...prev,
        [serverId]: {
          mem_used_pct: "",
          cpu_load_pct: "",
          email_pop3: "N/A",
          email_imap: "N/A",
          web_service: "UP",
          overall_status: "UNKNOWN",
          remark: "",
          readings: {},
        },
      }))
      return {
        mem_used_pct: "",
        cpu_load_pct: "",
        email_pop3: "N/A",
        email_imap: "N/A",
        web_service: "UP",
        overall_status: "UNKNOWN",
        remark: "",
        readings: {},
      }
    }
    return snapshots[serverId]
  }

  /** Checklist hijau hanya jika ada data bermakna: status, size/komponen terisi, dll. */
  function snapshotIsFilled(
    snap: typeof snapshots[number] | undefined,
    server: ServerWithComponents
  ): boolean {
    if (!snap) return false
    for (const comp of server.components ?? []) {
      const readings = snap.readings[comp.id] ?? {}
      // volumes: { [name]: { used, status } }
      const vols = (readings as Record<string, unknown>).volumes
      if (vols && typeof vols === "object") {
        for (const v of Object.values(vols as Record<string, unknown>)) {
          if (v && typeof v === "object") {
            for (const vv of Object.values(v as Record<string, unknown>)) {
              if (vv != null && String(vv).trim() !== "") return true
            }
          }
        }
      }
      for (const v of Object.values(readings)) {
        if (v != null && String(v).trim() !== "") return true
      }
    }
    return false
  }

  function setServerQuickOk(serverId: number) {
    setSnapshots((prev) => ({
      ...prev,
      [serverId]: {
        ...getOrInitSnapshot(serverId),
      },
    }))
  }

  async function handleSave() {
    if (!scheduleId || !sessionId) return
    setSaving(true)
    try {
      // Simpan kondisi ruangan (suhu & kelembapan) ke session
      await fetch(`/api/schedules/${scheduleId}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          temperature: temperature ? Number(temperature) : null,
          humidity: humidity ? Number(humidity) : null,
        }),
      })

      const payload = {
      snapshots: servers.map((s) => {
        const snap = getOrInitSnapshot(s.id)
        return {
          server_id: s.id,
          // Server-level fields intentionally omitted from UI (checklist-only UX).
          // Keep sending defaults to preserve existing DB columns & exports.
          mem_used_pct: null,
          cpu_load_pct: null,
          email_pop3: "N/A",
          email_imap: "N/A",
          web_service: "N/A",
          overall_status: "UNKNOWN",
          remark: null,
          readings: s.components.map((c) => ({
            server_component_id: c.id,
            metrics: snap.readings[c.id] ?? {},
          })),
        }
      }),
    }
      const res = await fetch(`/api/sessions/${sessionId}/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        const msg =
          (data && typeof data.error === "string" && data.error) ||
          "Gagal menyimpan snapshot"
        throw new Error(msg)
      }
      toast.success("Draft monitoring berhasil disimpan")
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Gagal menyimpan draft monitoring",
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit() {
    if (!sessionId) return
    setSaving(true)
    try {
      await handleSave()
      const res = await fetch(`/api/sessions/${sessionId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        const msg =
          (data && typeof data.error === "string" && data.error) ||
          "Gagal submit session"
        throw new Error(msg)
      }
      setSubmitSuccess(true)
      toast.success("Monitoring berhasil disubmit")
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Gagal submit monitoring",
      )
    } finally {
      setSaving(false)
    }
  }

  const pageLoading =
    loadingSession ||
    loadingServers ||
    (sessionId !== null && loadingDraft)
  const hasSnapshotData = Object.keys(snapshots).length > 0

  async function handleResetData() {
    if (!sessionId) return
    setResetting(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/snapshots`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Gagal reset")
      setSnapshots({})
      setViewMode("form")
      setResetConfirmOpen(false)
      toast.success("Data monitoring telah dikosongkan")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal reset data")
    } finally {
      setResetting(false)
    }
  }

  if (!scheduleId) return null

  return (
    <main>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link
            href="/monitoring"
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-400"
          >
            ← Kembali ke Jadwal
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-50">
            Form Monitoring — Jadwal #{scheduleId}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sessionId && (
            <a
              href={`/api/sessions/${sessionId}/export/excel`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Export Excel
            </a>
          )}
          {!pageLoading && hasSnapshotData && (
            <>
              {viewMode === "list" ? (
                <Button variant="secondary" className="!py-2" onClick={() => setViewMode("form")}>
                  <RiEdit2Line className="mr-1.5 size-4" />
                  Edit
                </Button>
              ) : (
                <Button variant="light" className="!py-2" onClick={() => setViewMode("list")}>
                  Lihat ringkasan
                </Button>
              )}
              <Button variant="secondary" className="!py-2" onClick={() => setResetConfirmOpen(true)}>
                <RiRefreshLine className="mr-1.5 size-4" />
                Reset data
              </Button>
            </>
          )}
        </div>
      </div>

      {pageLoading && (
        <div className="space-y-6">
          <Card className="p-6">
            <SkeletonBlock className="mb-4 h-5 w-48" />
            <div className="grid gap-4 sm:grid-cols-2">
              <SkeletonBlock className="h-10 w-full" />
              <SkeletonBlock className="h-10 w-full" />
            </div>
          </Card>
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden p-0">
              <div className="flex items-center justify-between p-4">
                <SkeletonBlock className="h-6 w-56" />
                <SkeletonBlock className="h-8 w-24" />
              </div>
              <div className="border-t border-gray-200 px-4 py-6 dark:border-gray-700">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <SkeletonBlock key={j} className="h-10 w-full" />
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!pageLoading && viewMode === "list" && hasSnapshotData && (
        <>
          <Card className="mb-6 p-4">
            <h3 className="font-medium text-gray-900 dark:text-gray-50">Kondisi Ruangan</h3>
            <div className="mt-2 flex gap-6 text-sm">
              <span className="text-gray-600 dark:text-gray-400">Suhu: {temperature ? `${temperature} °C` : "—"}</span>
              <span className="text-gray-600 dark:text-gray-400">Kelembaban: {humidity ? `${humidity}%` : "—"}</span>
            </div>
          </Card>
          <div className="space-y-2">
            {servers.map((server) => {
              const snap = snapshots[server.id]
              const expanded = expandedServerId === server.id
              const hasData = !!snap
              const hasFilledData = snapshotIsFilled(snap, server)
              return (
                <Card key={server.id} className="overflow-hidden p-0">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-900/50"
                    onClick={() => setExpandedServerId(expanded ? null : server.id)}
                  >
                    <div className="flex items-center gap-2">
                      {expanded ? <RiArrowDownSLine className="size-5 shrink-0 text-gray-500" /> : <RiArrowRightSLine className="size-5 shrink-0 text-gray-500" />}
                      {hasFilledData ? (
                        <RiCheckboxCircleFill className="size-5 shrink-0 text-emerald-500 dark:text-emerald-400" aria-hidden />
                      ) : null}
                      <span className="font-medium text-gray-900 dark:text-gray-50">{server.hostname}</span>
                      {(server.name ?? server.os) && <span className="text-sm text-gray-500">({server.name ?? server.os})</span>}
                      {server.ip_address && <span className="text-sm text-gray-500">{server.ip_address}</span>}
                      {!hasFilledData && <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">Belum diisi</span>}
                    </div>
                  </button>
                  {expanded && (
                    <div className="border-t border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
                      {hasData && server.components?.length > 0 && snap && (
                        <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                          <h4 className="mb-2 text-xs font-medium uppercase tracking text-gray-500 dark:text-gray-400">Komponen</h4>
                          <div className="space-y-3">
                            {server.components.map((comp) => {
                              const meta = getUsedFieldMeta(comp)
                              const compReadings = snap.readings[comp.id] ?? {}
                              const usedRaw = (compReadings as Record<string, unknown>).used
                              const statusRaw = (compReadings as Record<string, unknown>).status
                              const usedText =
                                usedRaw == null || String(usedRaw).trim() === ""
                                  ? "—"
                                  : String(usedRaw)
                              const statusText =
                                statusRaw == null || String(statusRaw).trim() === ""
                                  ? "—"
                                  : String(statusRaw)
                              return (
                                <div key={comp.id} className="rounded border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-900/50">
                                  <p className="mb-1 font-medium text-gray-800 dark:text-gray-200">{comp.label} ({comp.type_name})</p>
                                  <dl className="grid gap-1 sm:grid-cols-3">
                                    <div>
                                      <dt className="text-gray-500 dark:text-gray-400">Standard</dt>
                                      <dd className="text-gray-900 dark:text-gray-50">
                                        {formatStandard(comp.specs)}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-gray-500 dark:text-gray-400">
                                        Used{meta.unit ? ` (${meta.unit})` : ""}
                                      </dt>
                                      <dd className="text-gray-900 dark:text-gray-50">
                                        {usedText}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-gray-500 dark:text-gray-400">Checklist</dt>
                                      <dd className="text-gray-900 dark:text-gray-50">
                                        {statusText}
                                      </dd>
                                    </div>
                                  </dl>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                      {!hasData && <p className="text-sm text-gray-500 dark:text-gray-400">Data server ini belum diisi. Klik Edit untuk mengisi form.</p>}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
          <ConfirmDialog open={resetConfirmOpen} title="Reset data monitoring?" description="Semua data yang sudah diisi (per server) akan dihapus dan form dikosongkan. Anda bisa mengisi ulang dari form." confirmText="Ya, kosongkan" cancelText="Batal" variant="destructive" loading={resetting} onConfirm={handleResetData} onCancel={() => setResetConfirmOpen(false)} />
        </>
      )}

      {!pageLoading && (viewMode === "form" || !hasSnapshotData) && (
        <>
      {submitSuccess && (
        <Card className="mb-6 border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30">
          <p className="font-medium text-emerald-800 dark:text-emerald-200">
            Session berhasil disubmit. Jadwal ditandai completed.
          </p>
          <Link href="/monitoring" className="mt-2 inline-block text-sm text-emerald-600 dark:text-emerald-400">
            Kembali ke daftar jadwal
          </Link>
        </Card>
      )}

      <Card className="mb-8">
        <h3 className="font-medium text-gray-900 dark:text-gray-50">
          Kondisi Ruangan
        </h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Suhu (°C)</Label>
            <Input
              type="number"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              placeholder="Contoh: 22.5"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Kelembaban (%)</Label>
            <Input
              type="number"
              step="0.1"
              value={humidity}
              onChange={(e) => setHumidity(e.target.value)}
              placeholder="Contoh: 55"
              className="mt-1"
            />
          </div>
        </div>
      </Card>

      {servers.map((server) => {
        const snap = getOrInitSnapshot(server.id)
        return (
          <Card key={server.id} className="mb-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <h3 className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-50">
                {snapshotIsFilled(snapshots[server.id], server) ? (
                  <RiCheckboxCircleFill className="size-5 shrink-0 text-emerald-500 dark:text-emerald-400" aria-hidden />
                ) : null}
                {server.hostname}
                {(server.name ?? server.os) && <span className="ml-1 text-sm font-normal text-gray-500">({server.name ?? server.os})</span>}
                {server.ip_address && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    {server.ip_address}
                  </span>
                )}
              </h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="light"
                  className="!py-1.5 !text-xs"
                  onClick={() => setServerQuickOk(server.id)}
                >
                  Set semua OK
                </Button>
              </div>
            </div>
            {/* Dynamic fields from metric_schema per component */}
            {server.components?.length > 0 && (
              <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
                <h4 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Komponen
                </h4>
                <div className="space-y-4">
                  {server.components.map((comp) => {
                    const compReadings = snap.readings[comp.id] ?? {}
                    const meta = getUsedFieldMeta(comp)
                    const volumes = getDiskVolumes(comp.specs)
                    return (
                      <div
                        key={comp.id}
                        className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-900/30"
                      >
                        <p className="mb-2 text-sm font-medium text-gray-800 dark:text-gray-200">
                          {comp.label} ({comp.type_name})
                        </p>
                        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-3">
                          <div className="lg:col-span-1">
                            <Label className="text-gray-600 dark:text-gray-400">Standard</Label>
                            <div className="mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300">
                              {formatStandard(comp.specs)}
                            </div>
                          </div>

                          {volumes.length > 0 ? (
                            <div className="lg:col-span-2 space-y-4">
                              {(() => {
                                const readingAny = compReadings as unknown as Record<string, unknown>
                                const volMetricsRaw = readingAny.volumes
                                const volMetrics: Record<string, unknown> =
                                  volMetricsRaw &&
                                  typeof volMetricsRaw === "object" &&
                                  !Array.isArray(volMetricsRaw)
                                    ? (volMetricsRaw as Record<string, unknown>)
                                    : {}
                                const { usedSummary, statusSummary } = computeDiskUsedSummary(volumes, volMetrics)
                                const usedText = usedSummary == null ? null : `${usedSummary.toFixed(1)}%`
                                return (
                                  <>
                                    <div>
                                      <Label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                        Ringkasan disk
                                      </Label>
                                      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-950">
                                        <span
                                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusPillClasses(
                                            statusSummary || "",
                                          )}`}
                                        >
                                          {statusSummary || "—"}
                                        </span>
                                        {usedText ? (
                                          <span className="text-sm text-gray-600 dark:text-gray-400">
                                            Used <span className="font-medium text-gray-900 dark:text-gray-50">{usedText}</span>
                                          </span>
                                        ) : null}
                                        <span className="text-sm text-gray-500 dark:text-gray-400">
                                          {volumes.length} volume{volumes.length > 1 ? "s" : ""}
                                        </span>
                                      </div>
                                    </div>
                                    <div>
                                      <Label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                        Per volume
                                      </Label>
                                      <div className="space-y-2">
                                        {volumes.map((v) => {
                                          const row =
                                            (volMetrics[v.name] as Record<string, unknown> | undefined) ?? {}
                                          const used = row.used ?? ""
                                          const status = row.status ?? ""
                                          return (
                                            <div
                                              key={v.name}
                                              className="grid grid-cols-1 gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center dark:border-gray-700 dark:bg-gray-950"
                                            >
                                              <div className="min-w-0">
                                                <span className="text-sm font-medium text-gray-900 dark:text-gray-50">
                                                  {v.name}
                                                </span>
                                                {v.standard_gb != null ? (
                                                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                                                    {v.standard_gb} GB
                                                  </span>
                                                ) : null}
                                              </div>
                                              <Input
                                                type="number"
                                                value={typeof used === "string" || typeof used === "number" ? String(used) : ""}
                                                onChange={(e) => {
                                                  const nextVols: Record<string, unknown> = { ...(volMetrics as Record<string, unknown>) }
                                                  nextVols[v.name] = {
                                                    ...(nextVols[v.name] as Record<string, unknown> | undefined),
                                                    used: e.target.value,
                                                  }
                                                  setSnapshots((prev) => ({
                                                    ...prev,
                                                    [server.id]: {
                                                      ...getOrInitSnapshot(server.id),
                                                      readings: {
                                                        ...getOrInitSnapshot(server.id).readings,
                                                        [comp.id]: { ...compReadings, volumes: nextVols },
                                                      },
                                                    },
                                                  }))
                                                }}
                                                className="w-20 sm:w-24"
                                                placeholder="Used %"
                                              />
                                              <ChoiceButtons
                                                value={typeof status === "string" ? status : ""}
                                                onChange={(val) => {
                                                  const nextVols: Record<string, unknown> = { ...(volMetrics as Record<string, unknown>) }
                                                  nextVols[v.name] = {
                                                    ...(nextVols[v.name] as Record<string, unknown> | undefined),
                                                    status: val,
                                                  }
                                                  setSnapshots((prev) => ({
                                                    ...prev,
                                                    [server.id]: {
                                                      ...getOrInitSnapshot(server.id),
                                                      readings: {
                                                        ...getOrInitSnapshot(server.id).readings,
                                                        [comp.id]: { ...compReadings, volumes: nextVols },
                                                      },
                                                    },
                                                  }))
                                                }}
                                                options={[
                                                  { value: "OK", label: "OK", variant: "primary" },
                                                  { value: "FAIL", label: "FAIL", variant: "destructive" },
                                                  { value: "N/A", label: "N/A", variant: "light" },
                                                ]}
                                              />
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  </>
                                )
                              })()}
                            </div>
                          ) : (
                            <>
                              <div>
                                <Label>
                                  Used{meta.unit ? ` (${meta.unit})` : ""}
                                </Label>
                                <Input
                                  type="number"
                                  value={
                                    typeof (compReadings as Record<string, unknown>).used ===
                                      "string" ||
                                    typeof (compReadings as Record<string, unknown>).used ===
                                      "number"
                                      ? String(
                                          (compReadings as Record<string, unknown>).used,
                                        )
                                      : ""
                                  }
                                  onChange={(e) =>
                                    setSnapshots((prev) => ({
                                      ...prev,
                                      [server.id]: {
                                        ...getOrInitSnapshot(server.id),
                                        readings: {
                                          ...getOrInitSnapshot(server.id).readings,
                                          [comp.id]: {
                                            ...compReadings,
                                            used: e.target.value,
                                          },
                                        },
                                      },
                                    }))
                                  }
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label>Checklist</Label>
                                <ChoiceButtons
                                  value={
                                    typeof (compReadings as Record<string, unknown>).status ===
                                      "string"
                                      ? String(
                                          (compReadings as Record<string, unknown>).status,
                                        )
                                      : ""
                                  }
                                  onChange={(v) =>
                                    setSnapshots((prev) => ({
                                      ...prev,
                                      [server.id]: {
                                        ...getOrInitSnapshot(server.id),
                                        readings: {
                                          ...getOrInitSnapshot(server.id).readings,
                                          [comp.id]: {
                                            ...compReadings,
                                            status: v,
                                          },
                                        },
                                      },
                                    }))
                                  }
                                  options={[
                                    { value: "OK", label: "OK", variant: "primary" },
                                    { value: "FAIL", label: "FAIL", variant: "destructive" },
                                    { value: "N/A", label: "N/A", variant: "light" },
                                  ]}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </Card>
        )
      })}

      <div className="flex gap-4">
        <Button onClick={handleSave} disabled={saving || !sessionId} variant="secondary">
          {saving ? "Menyimpan..." : "Simpan draft"}
        </Button>
        <Button onClick={handleSubmit} disabled={saving || !sessionId}>
          {saving ? "Memproses..." : "Submit final"}
        </Button>
      </div>
        </>
      )}
    </main>
  )
}
