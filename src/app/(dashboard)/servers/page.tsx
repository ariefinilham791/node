"use client"

import { Badge } from "@/components/Badge"
import { Card } from "@/components/Card"
import { Button } from "@/components/Button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/Dialog"
import { Input } from "@/components/Input"
import { Label } from "@/components/Label"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { RiAddLine, RiEdit2Line, RiShutDownLine } from "@remixicon/react"
import { toast } from "@/lib/toast"
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api-client"
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
import { SkeletonLines } from "@/components/ui/Loading"

type Server = {
  id: number
  hostname: string
  name: string | null
  ip_address: string | null
  os: string | null
  server_type: string
  physical_status: string
  location_name: string
  component_count: number
  next_schedule_id?: number | null
  next_due_date?: string | null
}

export default function ServersPage() {
  const router = useRouter()
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string>("")
  const isAdmin = role === "admin"
  const [componentTypes, setComponentTypes] = useState<Array<{ id: number; name: string }>>([])

  const [locations, setLocations] = useState<{ id: number; name: string }[]>(
    [],
  )
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Server | null>(null)
  const [hostname, setHostname] = useState("")
  const [name, setName] = useState("")
  const [ip, setIp] = useState("")
  const [serverType, setServerType] = useState("general")
  const [physicalStatus, setPhysicalStatus] = useState("active")
  const [locationId, setLocationId] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmTitle, setConfirmTitle] = useState("")
  const [confirmDesc, setConfirmDesc] = useState<string | undefined>(undefined)
  const [confirmVariant, setConfirmVariant] = useState<
    "default" | "destructive"
  >("default")
  const [onConfirm, setOnConfirm] = useState<null | (() => Promise<void>)>(null)

  const [compModalOpen, setCompModalOpen] = useState(false)
  const [compSaving, setCompSaving] = useState(false)
  const [compServerId, setCompServerId] = useState<string>("")
  const [compTypeId, setCompTypeId] = useState<string>("")
  const [compLabel, setCompLabel] = useState("")
  const [compSlot, setCompSlot] = useState(0)

  async function load() {
    setLoading(true)
    try {
      const data = await apiGet<Server[]>("/api/servers?include=next-check")
      setServers(data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memuat server")
      setServers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    apiGet<{ user: { role: string } }>("/api/auth/me")
      .then((d) => setRole(d?.user?.role ?? ""))
      .catch(() => {})
    apiGet<{ id: number; name: string }[]>("/api/locations")
      .then((list) => setLocations(list))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Gagal memuat lokasi"))
    apiGet<Array<{ id: number; name: string }>>("/api/component-types")
      .then(setComponentTypes)
      .catch(() => {})
  }, [])

  async function handleCheckNow(serverId: number) {
    try {
      const res = await apiPost<{ scheduleId: number }>(`/api/servers/${serverId}/check-now`)
      if (res?.scheduleId) router.push(`/monitoring/${res.scheduleId}`)
      else throw new Error("Schedule tidak ditemukan")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memulai pengecekan")
    }
  }

  function openAddComponent(server?: Server) {
    setCompServerId(server ? String(server.id) : (servers[0]?.id ? String(servers[0].id) : ""))
    setCompTypeId(componentTypes[0]?.id ? String(componentTypes[0].id) : "")
    setCompLabel("")
    setCompSlot(0)
    setCompModalOpen(true)
  }

  async function handleSaveComponent() {
    if (!isAdmin) return
    if (!compServerId || !compTypeId || !compLabel.trim()) return
    setCompSaving(true)
    try {
      await apiPost<{ id: number }>(`/api/servers/${compServerId}/components`, {
        component_type_id: Number(compTypeId),
        label: compLabel.trim(),
        slot_index: Number(compSlot) || 0,
      })
      toast.success("Komponen berhasil ditambahkan")
      await load()
      setCompModalOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menambah komponen")
    } finally {
      setCompSaving(false)
    }
  }

  function openCreate() {
    setEditing(null)
    setHostname("")
    setName("")
    setIp("")
    setServerType("general")
    setPhysicalStatus("active")
    setLocationId(locations?.[0]?.id ? String(locations[0].id) : "")
    setModalOpen(true)
  }

  function openEdit(s: Server) {
    setEditing(s)
    setHostname(s.hostname)
    setName(s.name ?? "")
    setIp(s.ip_address ?? "")
    setServerType(s.server_type || "general")
    setPhysicalStatus(s.physical_status || "active")
    // location_id not present in list payload; keep blank (edit via detail page)
    setLocationId("")
    setModalOpen(true)
  }

  async function handleSave() {
    if (!isAdmin) return
    if (!hostname.trim()) return
    setSaving(true)
    try {
      if (editing) {
        await apiPut<{ success: true }>(`/api/servers/${editing.id}`, {
          hostname: hostname.trim(),
          name: name.trim() || null,
          ip_address: ip.trim() || null,
          server_type: serverType.trim(),
          physical_status: physicalStatus,
        })
        toast.success("Server berhasil diperbarui")
        await load()
        setModalOpen(false)
      } else {
        if (!locationId) {
          toast.error("Lokasi wajib dipilih")
        } else {
          await apiPost<{ id: number }>("/api/servers", {
            hostname: hostname.trim(),
            name: name.trim() || null,
            ip_address: ip.trim() || null,
            server_type: serverType.trim(),
            physical_status: physicalStatus,
            location_id: Number(locationId),
            sort_order: 0,
          })
          toast.success("Server berhasil dibuat")
          await load()
          setModalOpen(false)
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan server")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(s: Server) {
    if (!isAdmin) return
    setConfirmTitle("Nonaktifkan server?")
    setConfirmDesc(`Server "${s.hostname}" akan menjadi inactive.`)
    setConfirmVariant("destructive")
    setOnConfirm(() => async () => {
      setConfirmLoading(true)
      try {
        await apiDelete<{ success: true }>(`/api/servers/${s.id}`)
        toast.success("Server berhasil dinonaktifkan")
        await load()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal menonaktifkan")
      } finally {
        setConfirmLoading(false)
        setConfirmOpen(false)
      }
    })
    setConfirmOpen(true)
  }

  async function handleActivate(s: Server) {
    if (!isAdmin) return
    setConfirmTitle("Aktifkan server?")
    setConfirmDesc(`Server "${s.hostname}" akan diaktifkan kembali.`)
    setConfirmVariant("default")
    setOnConfirm(() => async () => {
      setConfirmLoading(true)
      try {
        await apiPut<{ success: true }>(`/api/servers/${s.id}`, {
          physical_status: "active",
        })
        toast.success("Server berhasil diaktifkan")
        await load()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal mengaktifkan")
      } finally {
        setConfirmLoading(false)
        setConfirmOpen(false)
      }
    })
    setConfirmOpen(true)
  }

  async function handleHardDelete(s: Server) {
    if (!isAdmin) return
    setConfirmTitle("Delete permanen server?")
    setConfirmDesc(
      `Server "${s.hostname}" akan dihapus permanen. Jika server punya snapshot/relasi, operasi bisa gagal.`,
    )
    setConfirmVariant("destructive")
    setOnConfirm(() => async () => {
      setConfirmLoading(true)
      try {
        await apiDelete<{ success: true }>(`/api/servers/${s.id}?hard=1`)
        toast.success("Server berhasil dihapus permanen")
        await load()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal menghapus permanen")
      } finally {
        setConfirmLoading(false)
        setConfirmOpen(false)
      }
    })
    setConfirmOpen(true)
  }

  return (
    <main>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            Daftar Server
          </h1>
          <p className="text-gray-500 sm:text-sm/6 dark:text-gray-500">
            Server yang dimonitor per lokasi
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="gap-2">
            <RiAddLine className="size-4" />
            Tambah Server
          </Button>
        )}
      </div>
      <Card className="mt-8 overflow-hidden p-0">
        {loading ? (
          <div className="p-6">
            <SkeletonLines count={8} />
          </div>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="p-4 md:hidden">
              {servers.length === 0 ? (
                <p className="text-sm text-gray-500">Tidak ada server.</p>
              ) : (
                <div className="space-y-3">
                  {servers.map((s) => (
                    <Card key={s.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link
                            href={`/servers/${s.id}`}
                            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {s.hostname}
                          </Link>
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            {[s.name ?? s.os, s.location_name, s.ip_address].filter(Boolean).join(" • ")}
                          </p>
                        </div>
                        <Badge
                          variant={
                            s.physical_status === "active" ? "success" : "neutral"
                          }
                        >
                          {s.physical_status}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-gray-500">Tipe</p>
                          <p className="text-gray-900 dark:text-gray-50">
                            {s.server_type}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Komponen</p>
                          <p className="text-gray-900 dark:text-gray-50">
                            {s.component_count}
                          </p>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            className="!py-2 !text-sm"
                            onClick={() => openEdit(s)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="light"
                            className="!py-2 !text-sm"
                            onClick={() => openAddComponent(s)}
                          >
                            + Komponen
                          </Button>
                          {s.physical_status === "active" ? (
                            <Button
                              variant="warning"
                              className="!py-2 !text-sm"
                              onClick={() => handleDeactivate(s)}
                            >
                              Nonaktifkan
                            </Button>
                          ) : (
                            <Button
                              variant="light"
                              className="!py-2 !text-sm"
                              onClick={() => handleActivate(s)}
                            >
                              Aktifkan
                            </Button>
                          )}
                          <Button
                            variant="destructive"
                            className="!py-2 !text-sm"
                            onClick={() => handleHardDelete(s)}
                          >
                            Delete Permanen
                          </Button>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block">
              <TableRoot>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>code asset</TableHeaderCell>
                      <TableHeaderCell>Name</TableHeaderCell>
                      <TableHeaderCell>IP</TableHeaderCell>
                      <TableHeaderCell>Lokasi</TableHeaderCell>
                      <TableHeaderCell>Tipe</TableHeaderCell>
                      <TableHeaderCell>Status</TableHeaderCell>
                      <TableHeaderCell>Komponen</TableHeaderCell>
                      <TableHeaderCell>Pengecekan selanjutnya</TableHeaderCell>
                      {isAdmin && (
                        <TableHeaderCell className="text-right">
                          Action
                        </TableHeaderCell>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {servers.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium text-gray-900 dark:text-gray-50">
                          <Link
                            href={`/servers/${s.id}`}
                            className="text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {s.hostname}
                          </Link>
                        </TableCell>
                        <TableCell>{s.name ?? s.os ?? "—"}</TableCell>
                        <TableCell>{s.ip_address ?? "—"}</TableCell>
                        <TableCell>{s.location_name}</TableCell>
                        <TableCell>{s.server_type}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              s.physical_status === "active"
                                ? "success"
                                : "neutral"
                            }
                          >
                            {s.physical_status}
                          </Badge>
                        </TableCell>
                        <TableCell>{s.component_count}</TableCell>
                        <TableCell className="text-gray-900 dark:text-gray-50">
                          {s.next_due_date
                            ? new Date(s.next_due_date).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-2">
                              <Button
                                variant="primary"
                                className="!py-1.5 !text-xs"
                                onClick={() => handleCheckNow(s.id)}
                              >
                                Cek sekarang
                              </Button>
                              <Button
                                variant="secondary"
                                className="gap-1 !py-1.5 !text-xs"
                                onClick={() => openEdit(s)}
                              >
                                <RiEdit2Line className="size-4" />
                                Edit
                              </Button>
                              <Button
                                variant="light"
                                className="gap-1 !py-1.5 !text-xs"
                                onClick={() => openAddComponent(s)}
                              >
                                + Komponen
                              </Button>
                              {s.physical_status === "active" ? (
                                <Button
                                  variant="warning"
                                  className="gap-1 !py-1.5 !text-xs"
                                  onClick={() => handleDeactivate(s)}
                                >
                                  <RiShutDownLine className="size-4" />
                                  Nonaktifkan
                                </Button>
                              ) : (
                                <Button
                                  variant="light"
                                  className="gap-1 !py-1.5 !text-xs"
                                  onClick={() => handleActivate(s)}
                                >
                                  Aktifkan
                                </Button>
                              )}
                              <Button
                                variant="destructive"
                                className="gap-1 !py-1.5 !text-xs"
                                onClick={() => handleHardDelete(s)}
                              >
                                Delete Permanen
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableRoot>
            </div>
          </>
        )}
      </Card>

      <Dialog open={modalOpen} onOpenChange={(open) => (open ? null : setModalOpen(false))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Server" : "Tambah Server"}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            <div>
              <Label>code asset</Label>
              <Input value={hostname} onChange={(e) => setHostname(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama / Host name (opsional)" className="mt-1" />
            </div>
            <div>
              <Label>IP Address</Label>
              <Input value={ip} onChange={(e) => setIp(e.target.value)} className="mt-1" />
            </div>
            {!editing && (
              <div>
                <Label>Lokasi</Label>
                <select
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                >
                  <option value="">— Pilih —</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={String(loc.id)}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Server type</Label>
                <Input value={serverType} onChange={(e) => setServerType(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Status</Label>
                <select
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                  value={physicalStatus}
                  onChange={(e) => setPhysicalStatus(e.target.value)}
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </div>
            </div>
            {editing && (
              <p className="text-xs text-gray-500">
                Catatan: edit lokasi & komponen lebih lengkap tersedia di halaman detail server.
              </p>
            )}
          </div>
          <DialogFooter className="mt-6 gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={handleSave} isLoading={saving} disabled={!hostname.trim() || (!editing && !locationId)}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={compModalOpen} onOpenChange={(open) => (open ? null : setCompModalOpen(false))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Komponen ke Server</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            <div>
              <Label>Server</Label>
              <select
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                value={compServerId}
                onChange={(e) => setCompServerId(e.target.value)}
              >
                <option value="">— Pilih server —</option>
                {servers.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.hostname} ({s.location_name})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Component Type</Label>
              <select
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                value={compTypeId}
                onChange={(e) => setCompTypeId(e.target.value)}
              >
                <option value="">— Pilih tipe —</option>
                {componentTypes.map((ct) => (
                  <option key={ct.id} value={String(ct.id)}>
                    {ct.name}
                  </option>
                ))}
              </select>
            </div>
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
          <DialogFooter className="mt-6 gap-2">
            <Button variant="secondary" onClick={() => setCompModalOpen(false)} disabled={compSaving}>
              Batal
            </Button>
            <Button
              onClick={handleSaveComponent}
              isLoading={compSaving}
              disabled={!compServerId || !compTypeId || !compLabel.trim()}
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        description={confirmDesc}
        variant={confirmVariant}
        confirmText="Yes"
        cancelText="No"
        loading={confirmLoading}
        onCancel={() => {
          if (!confirmLoading) setConfirmOpen(false)
        }}
        onConfirm={() => {
          onConfirm?.()
        }}
      />
    </main>
  )
}
