"use client"

import { Card } from "@/components/Card"
import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { Label } from "@/components/Label"
import { Textarea } from "@/components/Textarea"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
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
  RiEdit2Line,
  RiEyeLine,
} from "@remixicon/react"

type DiskVolumeSpec = { name: string; standard_gb: number | "" }

type Server = {
  id: number
  hostname: string
  name: string | null
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

type ComponentType = { id: number; name: string; category: string; unit_label: string | null }

function serverStatusVariant(status: string) {
  return status === "active" ? ("success" as const) : ("neutral" as const)
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
  const [name, setName] = useState("")
  const [ip_address, setIpAddress] = useState("")
  const [location_id, setLocationId] = useState("")
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [compModal, setCompModal] = useState(false)
  const [compEdit, setCompEdit] = useState<Component | null>(null)
  const [compLabel, setCompLabel] = useState("")
  const [compSlot, setCompSlot] = useState(0)
  const [compTypeId, setCompTypeId] = useState("")
  const [compCapacityGb, setCompCapacityGb] = useState("")
  const [compSerialNumber, setCompSerialNumber] = useState("")
  const [compModel, setCompModel] = useState("")
  const [compCpuCode, setCompCpuCode] = useState("")
  const [compPsuWatt, setCompPsuWatt] = useState("")
  const [compTotalRamGb, setCompTotalRamGb] = useState("")
  const [compVolumes, setCompVolumes] = useState<DiskVolumeSpec[]>([])
  const [compSpecsJson, setCompSpecsJson] = useState("")
  const [compSaving, setCompSaving] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteConfirmLoading, setDeleteConfirmLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Component | null>(null)

  const load = useCallback(() => {
    if (!serverId) return
    setLoading(true)
    Promise.all([
      apiGet<{
        server: Server
        components: Component[]
        latestSnapshot: LatestSnapshot | null
        componentReadings: ComponentReading[]
      }>(`/api/servers/${serverId}`),
      apiGet<ComponentType[]>("/api/component-types"),
      apiGet<{ id: number; name: string }[]>("/api/locations?all=1"),
    ])
      .then(([serverData, typesData, locationsData]) => {
        setData(serverData)
        setComponentTypes(
          typesData.map((c) => ({
            id: c.id,
            name: (c as unknown as { name: string }).name,
            category: (c as unknown as { category: string }).category,
            unit_label: (c as unknown as { unit_label: string | null }).unit_label ?? null,
          })),
        )
        setLocations(locationsData)
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Gagal memuat data")
        setData(null)
      })
      .finally(() => setLoading(false))
  }, [serverId])

  useEffect(() => {
    load()
  }, [load])


  useEffect(() => {
    if (data?.server) {
      setHostname(data.server.hostname)
      setName(data.server.name ?? "")
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
        name: name.trim() || null,
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
    setCompCapacityGb("")
    setCompSerialNumber("")
    setCompModel("")
    setCompCpuCode("")
    setCompPsuWatt("")
    setCompTotalRamGb("")
    setCompVolumes([])
    setCompSpecsJson("")
    setCompModal(true)
  }

  function normalizeVolumes(v: unknown): DiskVolumeSpec[] {
    if (!Array.isArray(v)) return []
    return v
      .map((row) => {
        if (!row || typeof row !== "object") return null
        const r = row as Record<string, unknown>
        const name = r.name != null ? String(r.name) : ""
        const standard_gb =
          r.standard_gb != null && String(r.standard_gb).trim() !== ""
            ? Number(r.standard_gb)
            : ""
        if (!name.trim()) return null
        return { name: name.trim(), standard_gb } satisfies DiskVolumeSpec
      })
      .filter(Boolean) as DiskVolumeSpec[]
  }

  function openEditComponent(c: Component) {
    setCompEdit(c)
    setCompLabel(c.label)
    setCompSlot(c.slot_index)
    setCompTypeId(String(c.component_type_id))
    const specs =
      c.specs && typeof c.specs === "object" ? (c.specs as Record<string, unknown>) : {}
    setCompCapacityGb(
      specs.capacity_gb != null
        ? String(specs.capacity_gb)
        : specs.size_gb != null
          ? String(specs.size_gb)
          : "",
    )
    setCompSerialNumber(specs.serial_number != null ? String(specs.serial_number) : "")
    setCompModel(specs.model != null ? String(specs.model) : "")
    setCompCpuCode(specs.cpu_code != null ? String(specs.cpu_code) : "")
    setCompPsuWatt(specs.watt != null ? String(specs.watt) : "")
    setCompTotalRamGb(specs.total_ram_gb != null ? String(specs.total_ram_gb) : "")
    setCompVolumes(normalizeVolumes(specs.volumes))
    setCompSpecsJson(Object.keys(specs).length ? JSON.stringify(specs, null, 2) : "")
    setCompModal(true)
  }

  const selectedTypeName =
    compEdit?.type_name ??
    componentTypes.find((c) => String(c.id) === String(compTypeId))?.name ??
    ""
  const selectedTypeCategory =
    componentTypes.find((c) => String(c.id) === String(compTypeId))?.category ??
    compEdit?.category ??
    ""
  const selectedTypeKey = `${selectedTypeName} ${selectedTypeCategory}`.toLowerCase()
  const isDiskType = selectedTypeKey.includes("disk") || selectedTypeKey.includes("storage")
  const isCpuType = selectedTypeKey.includes("cpu") || selectedTypeKey.includes("processor")
  const isPsuType = selectedTypeKey.includes("psu") || selectedTypeKey.includes("power")
  const isRamType = selectedTypeKey.includes("ram") || selectedTypeKey.includes("memory")

  async function handleSaveComponent() {
    if (!compLabel.trim()) return
    setCompSaving(true)
    try {
      let specs: Record<string, unknown> | null = null
      const trimmedJson = compSpecsJson.trim()
      if (trimmedJson) {
        try {
          const parsed = JSON.parse(trimmedJson) as unknown
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            specs = parsed as Record<string, unknown>
          } else {
            throw new Error("Specs JSON harus object")
          }
        } catch (e) {
          throw new Error(
            e instanceof Error ? `Specs JSON invalid: ${e.message}` : "Specs JSON invalid",
          )
        }
      } else {
        const next: Record<string, unknown> = {}
        if (isDiskType) {
          if (compCapacityGb.trim() !== "") next.capacity_gb = Number(compCapacityGb)
          if (compSerialNumber.trim() !== "") next.serial_number = compSerialNumber.trim()
          if (compModel.trim() !== "") next.model = compModel.trim()
          const vols = compVolumes
            .map((v) => ({
              name: v.name.trim(),
              standard_gb:
                v.standard_gb === "" ? null : Number(v.standard_gb),
            }))
            .filter((v) => v.name)
          if (vols.length) next.volumes = vols
        } else if (isCpuType) {
          if (compCpuCode.trim() !== "") next.cpu_code = compCpuCode.trim()
          if (compModel.trim() !== "") next.model = compModel.trim()
          if (compSerialNumber.trim() !== "") next.serial_number = compSerialNumber.trim()
        } else if (isPsuType) {
          if (compPsuWatt.trim() !== "") next.watt = Number(compPsuWatt)
          if (compModel.trim() !== "") next.model = compModel.trim()
          if (compSerialNumber.trim() !== "") next.serial_number = compSerialNumber.trim()
        } else if (isRamType) {
          if (compTotalRamGb.trim() !== "") next.total_ram_gb = Number(compTotalRamGb)
          if (compSerialNumber.trim() !== "") next.serial_number = compSerialNumber.trim()
          if (compModel.trim() !== "") next.model = compModel.trim()
        } else {
          if (compSerialNumber.trim() !== "") next.serial_number = compSerialNumber.trim()
          if (compModel.trim() !== "") next.model = compModel.trim()
        }
        specs = Object.keys(next).length ? next : null
      }

      if (compEdit) {
        await apiPut<{ success: true }>(
          `/api/servers/${serverId}/components/${compEdit.id}`,
          { label: compLabel.trim(), slot_index: compSlot, specs },
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
          specs,
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

  const { server, components } = data

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
            {[server.name ?? server.os, server.location_name, server.ip_address].filter(Boolean).join(" • ")}
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
          {!editServer ? (
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
          )}
        </div>
        {editServer ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>code asset</Label>
              <Input
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama / Host name (opsional)"
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
              <dt className="text-sm text-gray-500">code asset</dt>
              <dd className="font-medium">{server.hostname}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Name</dt>
              <dd className="font-medium">{server.name ?? server.os ?? "—"}</dd>
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
          <Button onClick={openAddComponent} className="gap-2">
            <RiAddLine className="size-4" />
            Tambah Komponen
          </Button>
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
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableRoot>
        </div>
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
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-300">
                Isi <span className="font-medium">Standard</span> di sini (master). Saat monitoring nanti cukup pilih OK/FAIL/N/A dan isi Used (%).
              </div>
              {isDiskType ? (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Capacity (GB)</Label>
                      <Input
                        type="number"
                        value={compCapacityGb}
                        onChange={(e) => setCompCapacityGb(e.target.value)}
                        className="mt-1"
                        placeholder="e.g. 480"
                      />
                    </div>
                    <div>
                      <Label>Serial Number</Label>
                      <Input
                        value={compSerialNumber}
                        onChange={(e) => setCompSerialNumber(e.target.value)}
                        className="mt-1"
                        placeholder="e.g. S3Z9..."
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Model</Label>
                      <Input
                        value={compModel}
                        onChange={(e) => setCompModel(e.target.value)}
                        className="mt-1"
                        placeholder="e.g. Samsung PM893"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <Label>Volumes (RAID/Partition)</Label>
                      <Button
                        type="button"
                        variant="secondary"
                        className="!py-1.5 !text-xs"
                        onClick={() =>
                          setCompVolumes((prev) => [
                            ...prev,
                            { name: `Volume ${prev.length + 1}`, standard_gb: "" },
                          ])
                        }
                      >
                        + Add volume
                      </Button>
                    </div>
                    <div className="mt-2 space-y-2">
                      {compVolumes.length === 0 ? (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Kosongkan jika tidak ada volume/RAID khusus.
                        </div>
                      ) : null}
                      {compVolumes.map((v, idx) => (
                        <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-6">
                          <div className="sm:col-span-4">
                            <Input
                              value={v.name}
                              onChange={(e) =>
                                setCompVolumes((prev) =>
                                  prev.map((row, i) =>
                                    i === idx ? { ...row, name: e.target.value } : row,
                                  ),
                                )
                              }
                              placeholder="Volume 1"
                            />
                          </div>
                          <div className="sm:col-span-2 flex gap-2">
                            <Input
                              type="number"
                              value={v.standard_gb}
                              onChange={(e) =>
                                setCompVolumes((prev) =>
                                  prev.map((row, i) =>
                                    i === idx
                                      ? { ...row, standard_gb: e.target.value === "" ? "" : Number(e.target.value) }
                                      : row,
                                  ),
                                )
                              }
                              placeholder="Std GB"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              className="!py-2 !text-xs"
                              onClick={() =>
                                setCompVolumes((prev) => prev.filter((_, i) => i !== idx))
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : isCpuType ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label>CPU Code</Label>
                    <Input
                      value={compCpuCode}
                      onChange={(e) => setCompCpuCode(e.target.value)}
                      className="mt-1"
                      placeholder="e.g. 0x0B06A3"
                    />
                  </div>
                  <div>
                    <Label>Serial Number</Label>
                    <Input
                      value={compSerialNumber}
                      onChange={(e) => setCompSerialNumber(e.target.value)}
                      className="mt-1"
                      placeholder="Opsional"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Model</Label>
                    <Input
                      value={compModel}
                      onChange={(e) => setCompModel(e.target.value)}
                      className="mt-1"
                      placeholder="e.g. Intel Xeon Gold 6230"
                    />
                  </div>
                </div>
              ) : isPsuType ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Watt</Label>
                    <Input
                      type="number"
                      value={compPsuWatt}
                      onChange={(e) => setCompPsuWatt(e.target.value)}
                      className="mt-1"
                      placeholder="e.g. 750"
                    />
                  </div>
                  <div>
                    <Label>Serial Number</Label>
                    <Input
                      value={compSerialNumber}
                      onChange={(e) => setCompSerialNumber(e.target.value)}
                      className="mt-1"
                      placeholder="Opsional"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Model</Label>
                    <Input
                      value={compModel}
                      onChange={(e) => setCompModel(e.target.value)}
                      className="mt-1"
                      placeholder="e.g. Delta DPS-750..."
                    />
                  </div>
                </div>
              ) : isRamType ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Total RAM (GB)</Label>
                    <Input
                      type="number"
                      value={compTotalRamGb}
                      onChange={(e) => setCompTotalRamGb(e.target.value)}
                      className="mt-1"
                      placeholder="e.g. 64"
                    />
                  </div>
                  <div>
                    <Label>Serial Number</Label>
                    <Input
                      value={compSerialNumber}
                      onChange={(e) => setCompSerialNumber(e.target.value)}
                      className="mt-1"
                      placeholder="Opsional"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Model</Label>
                    <Input
                      value={compModel}
                      onChange={(e) => setCompModel(e.target.value)}
                      className="mt-1"
                      placeholder="e.g. DDR4 3200..."
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Serial Number</Label>
                    <Input
                      value={compSerialNumber}
                      onChange={(e) => setCompSerialNumber(e.target.value)}
                      className="mt-1"
                      placeholder="Opsional"
                    />
                  </div>
                  <div>
                    <Label>Model</Label>
                    <Input
                      value={compModel}
                      onChange={(e) => setCompModel(e.target.value)}
                      className="mt-1"
                      placeholder="Opsional"
                    />
                  </div>
                </div>
              )}
              <div>
                <Label>Specs (JSON) — opsional (dinamis)</Label>
                <Textarea
                  value={compSpecsJson}
                  onChange={(e) => setCompSpecsJson(e.target.value)}
                  className="mt-1 font-mono text-xs"
                  placeholder={`{\n  "capacity_gb": 480,\n  "serial_number": "S3Z9...",\n  "model": "Samsung ..."\n}`}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Kalau diisi, JSON ini akan dipakai sebagai specs dan menimpa input Capacity/Serial di atas.
                </p>
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
