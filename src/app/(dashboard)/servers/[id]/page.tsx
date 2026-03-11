"use client"

import { Card } from "@/components/Card"
import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { Label } from "@/components/Label"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "@/lib/toast"
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api-client"
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
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { Spinner } from "@/components/ui/Loading"
import {
  RiAddLine,
  RiCheckboxCircleFill,
  RiEdit2Line,
  RiEyeLine,
  RiShutDownLine,
} from "@remixicon/react"

type Server = {
  id: number
  hostname: string
  ip_address: string | null
  os: string | null
  server_type: string
  physical_status: string
  location_id: number
  location_name: string
  sort_order: number
}

type Component = {
  id: number
  component_type_id: number
  label: string
  slot_index: number
  specs: Record<string, unknown> | null
  type_name: string
  category: string
  icon: string | null
  metric_schema: unknown
  unit_label: string | null
}

type LatestSnapshot = {
  snapshot_id: number
  mem_used_pct: number | null
  cpu_load_pct: number | null
  overall_status: string | null
  checked_at: string | null
}

type ComponentReading = {
  server_component_id: number
  component_label: string
  type_name: string
  metrics: unknown
}

type ComponentType = { id: number; name: string }

function serverStatusVariant(status: string) {
  return status === "active" ? ("success" as const) : ("neutral" as const)
}

function snapshotStatusVariant(status: string | null) {
  switch ((status ?? "").toUpperCase()) {
    case "OK":
      return "success" as const
    case "WARNING":
      return "warning" as const
    case "CRITICAL":
      return "error" as const
    default:
      return "neutral" as const
  }
}

export default function ServerDetailPage() {
  const params = useParams()
  const serverId = Number(params.id)
  const [data, setData] = useState<{
    server: Server
    components: Component[]
    latestSnapshot: LatestSnapshot | null
    componentReadings: ComponentReading[]
  } | null>(null)
  const [componentTypes, setComponentTypes] = useState<ComponentType[]>([])
  const [loading, setLoading] = useState(true)
  const [editServer, setEditServer] = useState(false)
  const [hostname, setHostname] = useState("")
  const [ip_address, setIpAddress] = useState("")
  const [location_id, setLocationId] = useState("")
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [compModal, setCompModal] = useState(false)
  const [compEdit, setCompEdit] = useState<Component | null>(null)
  const [compLabel, setCompLabel] = useState("")
  const [compSlot, setCompSlot] = useState(0)
  const [compTypeId, setCompTypeId] = useState("")
  const [compSaving, setCompSaving] = useState(false)
  const [role, setRole] = useState<string>("")
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteConfirmLoading, setDeleteConfirmLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Component | null>(null)

  function load() {
    if (!serverId) return
    setLoading(true)
    apiGet<{
      server: Server
      components: Component[]
      latestSnapshot: LatestSnapshot | null
      componentReadings: ComponentReading[]
    }>(`/api/servers/${serverId}`)
      .then(setData)
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Gagal memuat server")
        setData(null)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    apiGet<ComponentType[]>("/api/component-types")
      .then((list) =>
        setComponentTypes(list.map((c) => ({ id: c.id, name: c.name }))),
      )
      .catch(() => {})
    apiGet<{ id: number; name: string }[]>("/api/locations?all=1")
      .then((list) => setLocations(list))
      .catch(() => {})
  }, [serverId])

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setRole(d?.user?.role ?? ""))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (data?.server) {
      setHostname(data.server.hostname)
      setIpAddress(data.server.ip_address ?? "")
      setLocationId(String(data.server.location_id))
    }
  }, [data?.server])

  async function handleSaveServer() {
    if (!serverId) return
    setSaving(true)
    try {
      await apiPut<{ success: true }>(`/api/servers/${serverId}`, {
        hostname: hostname.trim(),
        ip_address: ip_address.trim() || null,
        location_id: location_id ? Number(location_id) : undefined,
      })
      toast.success("Server berhasil diperbarui")
      load()
      setEditServer(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan server")
    } finally {
      setSaving(false)
    }
  }

  function openAddComponent() {
    setCompEdit(null)
    setCompLabel("")
    setCompSlot(0)
    setCompTypeId("")
    setCompModal(true)
  }

  function openEditComponent(c: Component) {
    setCompEdit(c)
    setCompLabel(c.label)
    setCompSlot(c.slot_index)
    setCompTypeId(String(c.component_type_id))
    setCompModal(true)
  }

  async function handleSaveComponent() {
    if (!compLabel.trim()) return
    setCompSaving(true)
    try {
      if (compEdit) {
        await apiPut<{ success: true }>(
          `/api/servers/${serverId}/components/${compEdit.id}`,
          { label: compLabel.trim(), slot_index: compSlot },
        )
        toast.success("Komponen berhasil diperbarui")
        load()
        setCompModal(false)
      } else {
        if (!compTypeId) return
        await apiPost<{ id: number }>(`/api/servers/${serverId}/components`, {
          component_type_id: Number(compTypeId),
          label: compLabel.trim(),
          slot_index: compSlot,
        })
        toast.success("Komponen berhasil dibuat")
        load()
        setCompModal(false)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan komponen")
    } finally {
      setCompSaving(false)
    }
  }

  async function handleDeleteComponent(c: Component) {
    setDeleteTarget(c)
    setDeleteConfirmOpen(true)
  }

  if (!serverId) return null
  if (loading || !data) {
    return (
      <main>
        <div className="py-8">
          <Spinner label="Memuat detail server..." />
        </div>
      </main>
    )
  }

  const { server, components, latestSnapshot, componentReadings } = data
  const isAdmin = role === "admin"

  return (
    <main>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/servers"
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-400"
          >
            ← Daftar Server
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
              {server.hostname}
            </h1>
            <Badge variant={serverStatusVariant(server.physical_status)}>
              {server.physical_status}
            </Badge>
            <Badge variant="default">{server.server_type}</Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {server.location_name}
            {server.ip_address ? ` • ${server.ip_address}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" className="gap-2">
            <Link href={`/monitoring`} className="inline-flex items-center gap-2">
              <RiEyeLine className="size-4" />
              Lihat Jadwal Monitoring
            </Link>
          </Button>
        </div>
      </div>

      <Card className="mb-8">
        <div className="flex justify-between items-center">
          <h3 className="font-medium text-gray-900 dark:text-gray-50">
            Info Server
          </h3>
          {isAdmin &&
            (!editServer ? (
              <Button variant="secondary" onClick={() => setEditServer(true)}>
                <span className="inline-flex items-center gap-2">
                  <RiEdit2Line className="size-4" />
                  Edit
                </span>
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setEditServer(false)}>
                  Batal
                </Button>
                <Button onClick={handleSaveServer} isLoading={saving}>
                  Simpan
                </Button>
              </div>
            ))}
        </div>
        {editServer ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Hostname</Label>
              <Input
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>IP</Label>
              <Input
                value={ip_address}
                onChange={(e) => setIpAddress(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Lokasi</Label>
              <select
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                value={location_id}
                onChange={(e) => setLocationId(e.target.value)}
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={String(loc.id)}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-gray-500">Hostname</dt>
              <dd className="font-medium">{server.hostname}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">IP</dt>
              <dd>{server.ip_address ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Lokasi</dt>
              <dd>{server.location_name}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Tipe / Status</dt>
              <dd>
                <span className="inline-flex items-center gap-2">
                  <Badge variant="default">{server.server_type}</Badge>
                  <Badge variant={serverStatusVariant(server.physical_status)}>
                    {server.physical_status}
                  </Badge>
                </span>
              </dd>
            </div>
          </dl>
        )}
      </Card>

      <Card className="mb-8">
        <div className="flex justify-between items-center">
          <h3 className="font-medium text-gray-900 dark:text-gray-50">
            Komponen
          </h3>
          {isAdmin && (
            <Button onClick={openAddComponent} className="gap-2">
              <RiAddLine className="size-4" />
              Tambah Komponen
            </Button>
          )}
        </div>
        <div className="mt-4">
          <TableRoot>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Tipe</TableHeaderCell>
                  <TableHeaderCell>Label</TableHeaderCell>
                  <TableHeaderCell>Slot</TableHeaderCell>
                  <TableHeaderCell className="text-right">Aksi</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {components.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      Belum ada komponen.
                    </TableCell>
                  </TableRow>
                ) : (
                  components.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-gray-900 dark:text-gray-50">
                        <Badge variant="default">{c.type_name}</Badge>
                      </TableCell>
                      <TableCell className="font-medium text-gray-900 dark:text-gray-50">
                        {c.label}
                      </TableCell>
                      <TableCell>{c.slot_index}</TableCell>
                      <TableCell className="text-right">
                        {isAdmin ? (
                          <div className="inline-flex items-center gap-2">
                            <Button
                              variant="secondary"
                              className="!py-1.5 !text-xs"
                              onClick={() => openEditComponent(c)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              className="!py-1.5 !text-xs"
                              onClick={() => handleDeleteComponent(c)}
                            >
                              Hapus
                            </Button>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableRoot>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900 dark:text-gray-50">
            Snapshot Monitoring Terakhir
          </h3>
          {latestSnapshot?.overall_status ? (
            <Badge variant={snapshotStatusVariant(latestSnapshot.overall_status)}>
              {latestSnapshot.overall_status}
            </Badge>
          ) : null}
        </div>
        {latestSnapshot ? (
          <div className="mt-4 space-y-4">
            <dl className="grid gap-3 sm:grid-cols-4 text-sm">
              <div>
                <dt className="text-gray-500">MEM %</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-50">
                  {latestSnapshot.mem_used_pct ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">CPU %</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-50">
                  {latestSnapshot.cpu_load_pct ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Status</dt>
                <dd>
                  <Badge variant={snapshotStatusVariant(latestSnapshot.overall_status)}>
                    {latestSnapshot.overall_status ?? "—"}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Checked</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-50">
                  {latestSnapshot.checked_at
                    ? new Date(latestSnapshot.checked_at).toLocaleString()
                    : "—"}
                </dd>
              </div>
            </dl>
            {componentReadings.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Pembacaan komponen
                </p>
                <TableRoot>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Komponen</TableHeaderCell>
                        <TableHeaderCell>Tipe</TableHeaderCell>
                        <TableHeaderCell>Metrics</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {componentReadings.map((r) => (
                        <TableRow key={r.server_component_id}>
                          <TableCell className="text-gray-900 dark:text-gray-50">
                            {r.component_label}
                          </TableCell>
                          <TableCell>
                            <Badge variant="default">{r.type_name}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {typeof r.metrics === "object" && r.metrics !== null
                              ? JSON.stringify(r.metrics)
                              : String(r.metrics ?? "—")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableRoot>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-500">Belum ada snapshot.</p>
        )}
      </Card>

      {compModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="font-medium text-gray-900 dark:text-gray-50">
              {compEdit ? "Edit Komponen" : "Tambah Komponen"}
            </h3>
            <div className="mt-4 space-y-3">
              {!compEdit && (
                <div>
                  <Label>Tipe komponen</Label>
                  <select
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                    value={compTypeId}
                    onChange={(e) => setCompTypeId(e.target.value)}
                  >
                    <option value="">— Pilih —</option>
                    {componentTypes.map((ct) => (
                      <option key={ct.id} value={String(ct.id)}>
                        {ct.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <Label>Label</Label>
                <Input
                  value={compLabel}
                  onChange={(e) => setCompLabel(e.target.value)}
                  className="mt-1"
                  placeholder="e.g. Disk 1"
                />
              </div>
              <div>
                <Label>Slot index</Label>
                <Input
                  type="number"
                  value={compSlot}
                  onChange={(e) => setCompSlot(Number(e.target.value) || 0)}
                  className="mt-1 w-24"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setCompModal(false)}>
                Batal
              </Button>
              <Button
                onClick={handleSaveComponent}
                disabled={compSaving || !compLabel.trim() || (!compEdit && !compTypeId)}
                isLoading={compSaving}
              >
                Simpan
              </Button>
            </div>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Nonaktifkan komponen?"
        description={
          deleteTarget
            ? `Komponen "${deleteTarget.label}" akan dinonaktifkan.`
            : undefined
        }
        variant="destructive"
        confirmText="Yes"
        cancelText="No"
        loading={deleteConfirmLoading}
        onCancel={() => {
          if (!deleteConfirmLoading) {
            setDeleteConfirmOpen(false)
            setDeleteTarget(null)
          }
        }}
        onConfirm={async () => {
          if (!deleteTarget) return
          setDeleteConfirmLoading(true)
          try {
            await apiDelete<{ success: true }>(
              `/api/servers/${serverId}/components/${deleteTarget.id}`,
            )
            toast.success("Komponen berhasil dinonaktifkan")
            load()
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Gagal menghapus komponen")
          } finally {
            setDeleteConfirmLoading(false)
            setDeleteConfirmOpen(false)
            setDeleteTarget(null)
          }
        }}
      />
    </main>
  )
}
