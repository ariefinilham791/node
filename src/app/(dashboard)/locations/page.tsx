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

type Location = {
  id: number
  name: string
  address: string | null
  description: string | null
  is_active: number
}

export default function LocationsPage() {
  const [list, setList] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Location | null>(null)
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmTitle, setConfirmTitle] = useState("")
  const [confirmDesc, setConfirmDesc] = useState<string | undefined>(undefined)
  const [confirmVariant, setConfirmVariant] = useState<
    "default" | "destructive"
  >("default")
  const [onConfirm, setOnConfirm] = useState<null | (() => Promise<void>)>(null)

  async function load() {
    setLoading(true)
    try {
      const data = await apiGet<Location[]>("/api/locations?all=1")
      setList(data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memuat lokasi")
      setList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function openCreate() {
    setEditing(null)
    setName("")
    setAddress("")
    setDescription("")
    setModalOpen(true)
  }

  function openEdit(loc: Location) {
    setEditing(loc)
    setName(loc.name)
    setAddress(loc.address ?? "")
    setDescription(loc.description ?? "")
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        address: address.trim() || null,
        description: description.trim() || null,
      }
      if (editing) {
        await apiPut<{ success: true }>(`/api/locations/${editing.id}`, payload)
        toast.success("Lokasi berhasil diperbarui")
      } else {
        await apiPost<{ id: number }>("/api/locations", payload)
        toast.success("Lokasi berhasil dibuat")
      }
      await load()
      closeModal()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(loc: Location) {
    setConfirmTitle("Nonaktifkan lokasi?")
    setConfirmDesc(`Lokasi "${loc.name}" akan menjadi nonaktif.`)
    setConfirmVariant("destructive")
    setOnConfirm(() => async () => {
      setConfirmLoading(true)
      try {
        await apiDelete<{ success: true }>(`/api/locations/${loc.id}`)
        toast.success("Lokasi berhasil dinonaktifkan")
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

  async function handleActivate(loc: Location) {
    setConfirmTitle("Aktifkan lokasi?")
    setConfirmDesc(`Lokasi "${loc.name}" akan diaktifkan kembali.`)
    setConfirmVariant("default")
    setOnConfirm(() => async () => {
      setConfirmLoading(true)
      try {
        await apiPut<{ success: true }>(`/api/locations/${loc.id}`, {
          name: loc.name,
          address: loc.address,
          description: loc.description,
          is_active: 1,
        })
        toast.success("Lokasi berhasil diaktifkan")
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

  async function handleHardDelete(loc: Location) {
    setConfirmTitle("Delete permanen?")
    setConfirmDesc(
      `Lokasi "${loc.name}" akan dihapus permanen. Aksi ini tidak bisa dibatalkan.`,
    )
    setConfirmVariant("destructive")
    setOnConfirm(() => async () => {
      setConfirmLoading(true)
      try {
        await apiDelete<{ success: true }>(`/api/locations/${loc.id}?hard=1`)
        toast.success("Lokasi berhasil dihapus permanen")
        await load()
      } catch (e) {
        toast.error(
          e instanceof Error
            ? e.message
            : "Gagal menghapus permanen (mungkin masih dipakai oleh server/schedule)",
        )
      } finally {
        setConfirmLoading(false)
        setConfirmOpen(false)
      }
    })
    setConfirmOpen(true)
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
        Locations
      </h1>
      <p className="mt-1 text-gray-500 dark:text-gray-400">
        Kelola lokasi data center. Admin only.
      </p>

      <Card className="mt-6">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {list.length} lokasi
          </span>
          <Button onClick={openCreate}>Tambah Lokasi</Button>
        </div>
        {loading ? (
          <SkeletonLines count={6} />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {list.length === 0 ? (
                <p className="text-sm text-gray-500">Tidak ada lokasi.</p>
              ) : (
                list.map((loc) => (
                  <Card key={loc.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-50">
                          {loc.name}
                        </p>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                          {loc.address ?? "—"}
                        </p>
                      </div>
                      <Badge variant={loc.is_active ? "success" : "neutral"}>
                        {loc.is_active ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        className="!py-2 !text-sm"
                        onClick={() => openEdit(loc)}
                      >
                        Edit
                      </Button>
                      {loc.is_active ? (
                        <Button
                          variant="warning"
                          className="!py-2 !text-sm"
                          onClick={() => handleDelete(loc)}
                        >
                          Nonaktifkan
                        </Button>
                      ) : (
                        <Button
                          variant="light"
                          className="!py-2 !text-sm"
                          onClick={() => handleActivate(loc)}
                        >
                          Aktifkan
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        className="!py-2 !text-sm"
                        onClick={() => handleHardDelete(loc)}
                      >
                        Delete Permanen
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block">
              <TableRoot>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Nama</TableHeaderCell>
                      <TableHeaderCell>Alamat</TableHeaderCell>
                      <TableHeaderCell>Status</TableHeaderCell>
                      <TableHeaderCell className="text-right">
                        Aksi
                      </TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {list.map((loc) => (
                      <TableRow key={loc.id}>
                        <TableCell className="font-medium text-gray-900 dark:text-gray-50">
                          {loc.name}
                        </TableCell>
                        <TableCell>{loc.address ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={loc.is_active ? "success" : "neutral"}>
                            {loc.is_active ? "Aktif" : "Nonaktif"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-2">
                            <Button
                              variant="secondary"
                              className="!py-1.5 !text-xs"
                              onClick={() => openEdit(loc)}
                            >
                              Edit
                            </Button>
                            {loc.is_active ? (
                              <Button
                                variant="warning"
                                className="!py-1.5 !text-xs"
                                onClick={() => handleDelete(loc)}
                              >
                                Nonaktifkan
                              </Button>
                            ) : (
                              <Button
                                variant="light"
                                className="!py-1.5 !text-xs"
                                onClick={() => handleActivate(loc)}
                              >
                                Aktifkan
                              </Button>
                            )}
                            <Button
                              variant="destructive"
                              className="!py-1.5 !text-xs"
                              onClick={() => handleHardDelete(loc)}
                            >
                              Delete Permanen
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableRoot>
            </div>
          </>
        )}
      </Card>

      <Dialog open={modalOpen} onOpenChange={(open) => (open ? null : closeModal())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Lokasi" : "Tambah Lokasi"}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            <div>
              <Label>Nama</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
                placeholder="Nama lokasi"
              />
            </div>
            <div>
              <Label>Alamat</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1"
                placeholder="Alamat"
              />
            </div>
            <div>
              <Label>Deskripsi (opsional)</Label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                rows={2}
                placeholder="Deskripsi"
              />
            </div>
          </div>
          <DialogFooter className="mt-6 gap-2">
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              Batal
            </Button>
            <Button onClick={handleSave} isLoading={saving} disabled={!name.trim()}>
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
    </div>
  )
}
