"use client"

import { Card } from "@/components/Card"
import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { Label } from "@/components/Label"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import type { MetricField } from "@/types"
import { apiGet } from "@/lib/api-client"
import { toast } from "@/lib/toast"

type ServerWithComponents = {
  id: number
  hostname: string
  ip_address: string | null
  sort_order: number
  components: {
    id: number
    label: string
    slot_index: number
    type_name: string
    metric_schema: unknown
  }[]
}

type UserOption = { id: number; full_name: string; role: string }

function parseMetricSchema(schema: unknown): MetricField[] {
  if (!Array.isArray(schema)) return []
  return schema.filter(
    (f): f is MetricField =>
      f && typeof f === "object" && "key" in f && typeof (f as MetricField).key === "string"
  ) as MetricField[]
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
  const [temperature, setTemperature] = useState("")
  const [humidity, setHumidity] = useState("")
  const [saving, setSaving] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [userOptions, setUserOptions] = useState<UserOption[]>([])
  const [acknowledgedBy, setAcknowledgedBy] = useState<string>("")
  const [deptHeadBy, setDeptHeadBy] = useState<string>("")
  const [approvalNotes, setApprovalNotes] = useState("")
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
        readings: Record<number, Record<string, string>>
      }
    >
  >({})

  useEffect(() => {
    if (!scheduleId) return
    fetch(`/api/schedules/${scheduleId}/session`)
      .then((r) => r.json())
      .then((data) => {
        setSessionId(data.sessionId)
      })
      .catch(() => {})
  }, [scheduleId])

  useEffect(() => {
    if (!scheduleId) return
    fetch(`/api/schedules/${scheduleId}/servers`)
      .then((r) => r.json())
      .then(setServers)
      .catch(() => {})
  }, [scheduleId])

  useEffect(() => {
    apiGet<UserOption[]>("/api/users")
      .then(setUserOptions)
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : "Gagal memuat user"),
      )
  }, [])

  function getOrInitSnapshot(serverId: number) {
    if (!snapshots[serverId]) {
      setSnapshots((prev) => ({
        ...prev,
        [serverId]: {
          mem_used_pct: "",
          cpu_load_pct: "",
          email_pop3: "N/A",
          email_imap: "N/A",
          web_service: "N/A",
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
        web_service: "N/A",
        overall_status: "UNKNOWN",
        remark: "",
        readings: {},
      }
    }
    return snapshots[serverId]
  }

  function setServerQuickOk(serverId: number) {
    setSnapshots((prev) => ({
      ...prev,
      [serverId]: {
        ...getOrInitSnapshot(serverId),
        email_pop3: "UP",
        email_imap: "UP",
        web_service: "UP",
        overall_status: "OK",
      },
    }))
  }

  async function handleSave() {
    if (!sessionId) return
    setSaving(true)
    const payload = {
      snapshots: servers.map((s) => {
        const snap = getOrInitSnapshot(s.id)
        return {
          server_id: s.id,
          mem_used_pct: snap.mem_used_pct || null,
          cpu_load_pct: snap.cpu_load_pct || null,
          email_pop3: snap.email_pop3,
          email_imap: snap.email_imap,
          web_service: snap.web_service,
          overall_status: snap.overall_status,
          remark: snap.remark || null,
          readings: s.components.map((c) => ({
            server_component_id: c.id,
            metrics: snap.readings[c.id] ?? {},
          })),
        }
      }),
    }
    await fetch(`/api/sessions/${sessionId}/snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    setSaving(false)
  }

  async function handleSubmit() {
    if (!sessionId) return
    setSaving(true)
    await handleSave()
    await fetch(`/api/sessions/${sessionId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        acknowledgedBy: acknowledgedBy ? Number(acknowledgedBy) : undefined,
        deptHeadBy: deptHeadBy ? Number(deptHeadBy) : undefined,
      }),
    })
    setSaving(false)
    setSubmitSuccess(true)
  }

  if (!scheduleId) return null

  return (
    <main>
      <div className="mb-6 flex items-center justify-between">
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
        <div className="flex gap-2">
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
        </div>
      </div>

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
              <h3 className="font-medium text-gray-900 dark:text-gray-50">
                {server.hostname}
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
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label>Memory used (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={snap.mem_used_pct}
                  onChange={(e) =>
                    setSnapshots((prev) => ({
                      ...prev,
                      [server.id]: {
                        ...getOrInitSnapshot(server.id),
                        mem_used_pct: e.target.value,
                      },
                    }))
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label>CPU load (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={snap.cpu_load_pct}
                  onChange={(e) =>
                    setSnapshots((prev) => ({
                      ...prev,
                      [server.id]: {
                        ...getOrInitSnapshot(server.id),
                        cpu_load_pct: e.target.value,
                      },
                    }))
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Email POP3</Label>
                <ChoiceButtons
                  value={snap.email_pop3}
                  onChange={(v) =>
                    setSnapshots((prev) => ({
                      ...prev,
                      [server.id]: { ...getOrInitSnapshot(server.id), email_pop3: v },
                    }))
                  }
                  options={[
                    { value: "UP", label: "UP", variant: "primary" },
                    { value: "DOWN", label: "DOWN", variant: "destructive" },
                    { value: "N/A", label: "N/A", variant: "light" },
                  ]}
                />
              </div>
              <div>
                <Label>Email IMAP</Label>
                <ChoiceButtons
                  value={snap.email_imap}
                  onChange={(v) =>
                    setSnapshots((prev) => ({
                      ...prev,
                      [server.id]: { ...getOrInitSnapshot(server.id), email_imap: v },
                    }))
                  }
                  options={[
                    { value: "UP", label: "UP", variant: "primary" },
                    { value: "DOWN", label: "DOWN", variant: "destructive" },
                    { value: "N/A", label: "N/A", variant: "light" },
                  ]}
                />
              </div>
              <div>
                <Label>Web service</Label>
                <ChoiceButtons
                  value={snap.web_service}
                  onChange={(v) =>
                    setSnapshots((prev) => ({
                      ...prev,
                      [server.id]: { ...getOrInitSnapshot(server.id), web_service: v },
                    }))
                  }
                  options={[
                    { value: "UP", label: "UP", variant: "primary" },
                    { value: "DOWN", label: "DOWN", variant: "destructive" },
                    { value: "N/A", label: "N/A", variant: "light" },
                  ]}
                />
              </div>
              <div>
                <Label>Overall status</Label>
                <ChoiceButtons
                  value={snap.overall_status}
                  onChange={(v) =>
                    setSnapshots((prev) => ({
                      ...prev,
                      [server.id]: { ...getOrInitSnapshot(server.id), overall_status: v },
                    }))
                  }
                  options={[
                    { value: "OK", label: "OK", variant: "primary" },
                    { value: "WARNING", label: "WARNING", variant: "warning" },
                    { value: "CRITICAL", label: "CRITICAL", variant: "destructive" },
                    { value: "UNKNOWN", label: "UNKNOWN", variant: "secondary" },
                  ]}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Remark</Label>
                <Input
                  value={snap.remark}
                  onChange={(e) =>
                    setSnapshots((prev) => ({
                      ...prev,
                      [server.id]: {
                        ...getOrInitSnapshot(server.id),
                        remark: e.target.value,
                      },
                    }))
                  }
                  placeholder="Catatan"
                  className="mt-1"
                />
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
                    const fields = parseMetricSchema(comp.metric_schema)
                    if (fields.length === 0) return null
                    const compReadings = snap.readings[comp.id] ?? {}
                    return (
                      <div
                        key={comp.id}
                        className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-900/30"
                      >
                        <p className="mb-2 text-sm font-medium text-gray-800 dark:text-gray-200">
                          {comp.label} ({comp.type_name})
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {fields.map((field) => {
                            const value = compReadings[field.key] ?? ""
                            const label = field.unit ? `${field.label} (${field.unit})` : field.label
                            if (field.input_type === "select" && field.options?.length) {
                              const useButtons = field.options.length <= 4
                              return (
                                <div key={field.key}>
                                  <Label>
                                    {label}
                                    {field.required ? <span className="ml-1 text-red-500">*</span> : null}
                                  </Label>
                                  {useButtons ? (
                                    <ChoiceButtons
                                      value={value}
                                      onChange={(v) =>
                                        setSnapshots((prev) => ({
                                          ...prev,
                                          [server.id]: {
                                            ...getOrInitSnapshot(server.id),
                                            readings: {
                                              ...getOrInitSnapshot(server.id).readings,
                                              [comp.id]: {
                                                ...compReadings,
                                                [field.key]: v,
                                              },
                                            },
                                          },
                                        }))
                                      }
                                      options={field.options.map((opt) => ({
                                        value: opt,
                                        label: opt,
                                        variant: "light",
                                      }))}
                                    />
                                  ) : (
                                    <select
                                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                                      value={value}
                                      onChange={(e) =>
                                        setSnapshots((prev) => ({
                                          ...prev,
                                          [server.id]: {
                                            ...getOrInitSnapshot(server.id),
                                            readings: {
                                              ...getOrInitSnapshot(server.id).readings,
                                              [comp.id]: {
                                                ...compReadings,
                                                [field.key]: e.target.value,
                                              },
                                            },
                                          },
                                        }))
                                      }
                                    >
                                      <option value="">—</option>
                                      {field.options.map((opt) => (
                                        <option key={opt} value={opt}>
                                          {opt}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              )
                            }
                            return (
                              <div key={field.key}>
                                <Label>
                                  {label}
                                  {field.required ? <span className="ml-1 text-red-500">*</span> : null}
                                </Label>
                                <Input
                                  type="number"
                                  min={field.min}
                                  max={field.max}
                                  value={value}
                                  onChange={(e) =>
                                    setSnapshots((prev) => ({
                                      ...prev,
                                      [server.id]: {
                                        ...getOrInitSnapshot(server.id),
                                        readings: {
                                          ...getOrInitSnapshot(server.id).readings,
                                          [comp.id]: {
                                            ...compReadings,
                                            [field.key]: e.target.value,
                                          },
                                        },
                                      },
                                    }))
                                  }
                                  className="mt-1"
                                />
                              </div>
                            )
                          })}
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

      <Card className="mb-8">
        <h3 className="font-medium text-gray-900 dark:text-gray-50">
          Persetujuan
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Isi sebelum submit final (opsional; default: user saat ini).
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Acknowledged By</Label>
            <select
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
              value={acknowledgedBy}
              onChange={(e) => setAcknowledgedBy(e.target.value)}
            >
              <option value="">— Pilih user —</option>
              {userOptions
                .filter((u) => u.role === "supervisor" || u.role === "dept_head")
                .map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {u.full_name} ({u.role})
                  </option>
                ))}
            </select>
          </div>
          <div>
            <Label>Dept Head</Label>
            <select
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
              value={deptHeadBy}
              onChange={(e) => setDeptHeadBy(e.target.value)}
            >
              <option value="">— Pilih user —</option>
              {userOptions
                .filter((u) => u.role === "dept_head")
                .map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {u.full_name}
                  </option>
                ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>Catatan persetujuan (opsional)</Label>
            <textarea
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
              rows={2}
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder="Catatan"
            />
          </div>
        </div>
      </Card>

      <div className="flex gap-4">
        <Button onClick={handleSave} disabled={saving || !sessionId} variant="secondary">
          {saving ? "Menyimpan..." : "Simpan draft"}
        </Button>
        <Button onClick={handleSubmit} disabled={saving || !sessionId}>
          {saving ? "Memproses..." : "Submit final"}
        </Button>
      </div>
    </main>
  )
}
