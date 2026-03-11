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
import type { MetricField } from "@/types"
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

type ComponentType = {
  id: number
  name: string
  category: string
  icon: string | null
  unit_label: string | null
  sort_order: number
  metric_schema: unknown
  is_active: number
}

function MetricSchemaEditor({
  value,
  onChange,
}: {
  value: MetricField[]
  onChange: (v: MetricField[]) => void
}) {
  function addRow() {
    onChange([
      ...value,
      {
        key: "",
        label: "",
        unit: "",
        input_type: "number",
        required: false,
      },
    ])
  }

  function updateRow(i: number, field: Partial<MetricField>) {
    const next = [...value]
    next[i] = { ...next[i], ...field }
    onChange(next)
  }

  function removeRow(i: number) {
    onChange(value.filter((_, idx) => idx !== i))
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <Label>Metric schema</Label>
        <Button type="button" variant="secondary" onClick={addRow}>
          + Field
        </Button>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {value.map((f, i) => (
          <div
            key={i}
            className="grid grid-cols-12 gap-1 items-center rounded border border-gray-200 dark:border-gray-700 p-2 text-sm"
          >
            <input
              className="col-span-2 rounded border px-2 py-1 dark:bg-gray-900"
              placeholder="key"
              value={f.key}
              onChange={(e) => updateRow(i, { key: e.target.value })}
            />
            <input
              className="col-span-2 rounded border px-2 py-1 dark:bg-gray-900"
              placeholder="label"
              value={f.label}
              onChange={(e) => updateRow(i, { label: e.target.value })}
            />
            <input
              className="col-span-1 rounded border px-2 py-1 dark:bg-gray-900"
              placeholder="unit"
              value={f.unit}
              onChange={(e) => updateRow(i, { unit: e.target.value })}
            />
            <select
              className="col-span-2 rounded border px-2 py-1 dark:bg-gray-900"
              value={f.input_type}
              onChange={(e) =>
                updateRow(i, { input_type: e.target.value as "number" | "select" })
              }
            >
              <option value="number">number</option>
              <option value="select">select</option>
            </select>
            <label className="col-span-2 flex items-center gap-1">
              <input
                type="checkbox"
                checked={f.required}
                onChange={(e) => updateRow(i, { required: e.target.checked })}
              />
              required
            </label>
            <input
              className="col-span-2 rounded border px-2 py-1 dark:bg-gray-900"
              placeholder="options (comma)"
              value={f.options?.join(", ") ?? ""}
              onChange={(e) =>
                updateRow(i, {
                  options: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
            <button
              type="button"
              className="col-span-1 text-red-600 hover:underline"
              onClick={() => removeRow(i)}
            >
              Hapus
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ComponentTypesPage() {
  const [list, setList] = useState<ComponentType[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ComponentType | null>(null)
  const [name, setName] = useState("")
  const [category, setCategory] = useState("general")
  const [icon, setIcon] = useState("")
  const [unit_label, setUnitLabel] = useState("")
  const [sort_order, setSortOrder] = useState(0)
  const [metric_schema, setMetricSchema] = useState<MetricField[]>([])
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
      const data = await apiGet<ComponentType[]>("/api/component-types")
      setList(data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memuat component types")
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
    setCategory("general")
    setIcon("")
    setUnitLabel("")
    setSortOrder(0)
    setMetricSchema([])
    setModalOpen(true)
  }

  function openEdit(row: ComponentType) {
    setEditing(row)
    setName(row.name)
    setCategory(row.category || "general")
    setIcon(row.icon ?? "")
    setUnitLabel(row.unit_label ?? "")
    setSortOrder(row.sort_order ?? 0)
    const schema = row.metric_schema
    setMetricSchema(
      Array.isArray(schema)
        ? (schema as MetricField[]).map((f) => ({
            key: f.key ?? "",
            label: f.label ?? "",
            unit: f.unit ?? "",
            input_type: f.input_type ?? "number",
            required: !!f.required,
            options: f.options,
          }))
        : []
    )
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    const payload = {
      name: name.trim(),
      category: category.trim() || "general",
      icon: icon.trim() || null,
      unit_label: unit_label.trim() || null,
      sort_order: Number(sort_order) || 0,
      metric_schema: metric_schema.filter((f) => f.key.trim()),
    }
    try {
      if (editing) {
        await apiPut<{ success: true }>(
          `/api/component-types/${editing.id}`,
          payload,
        )
        toast.success("Component type berhasil diperbarui")
      } else {
        await apiPost<{ id: number }>("/api/component-types", payload)
        toast.success("Component type berhasil dibuat")
      }
      await load()
      closeModal()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(row: ComponentType) {
    setConfirmTitle("Nonaktifkan component type?")
    setConfirmDesc(`Tipe "${row.name}" akan menjadi nonaktif.`)
    setConfirmVariant("destructive")
    setOnConfirm(() => async () => {
      setConfirmLoading(true)
      try {
        await apiDelete<{ success: true }>(`/api/component-types/${row.id}`)
        toast.success("Component type berhasil dinonaktifkan")
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

  async function handleActivate(row: ComponentType) {
    setConfirmTitle("Aktifkan component type?")
    setConfirmDesc(`Tipe "${row.name}" akan diaktifkan kembali.`)
    setConfirmVariant("default")
    setOnConfirm(() => async () => {
      setConfirmLoading(true)
      try {
        await apiPut<{ success: true }>(`/api/component-types/${row.id}`, {
          name: row.name,
          category: row.category,
          icon: row.icon,
          unit_label: row.unit_label,
          sort_order: row.sort_order,
          metric_schema: row.metric_schema,
          is_active: 1,
        })
        toast.success("Component type berhasil diaktifkan")
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

  async function handleHardDelete(row: ComponentType) {
    setConfirmTitle("Delete permanen?")
    setConfirmDesc(
      `Tipe "${row.name}" akan dihapus permanen. Aksi ini tidak bisa dibatalkan.`,
    )
    setConfirmVariant("destructive")
    setOnConfirm(() => async () => {
      setConfirmLoading(true)
      try {
        await apiDelete<{ success: true }>(
          `/api/component-types/${row.id}?hard=1`,
        )
        toast.success("Component type berhasil dihapus permanen")
        await load()
      } catch (e) {
        toast.error(
          e instanceof Error
            ? e.message
            : "Gagal menghapus permanen (mungkin masih dipakai oleh komponen server)",
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
        Component Types
      </h1>
      <p className="mt-1 text-gray-500 dark:text-gray-400">
        Kelola tipe komponen (DISK, RAM, CPU, dll) dan metric schema. Admin only.
      </p>

      <Card className="mt-6">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {list.length} tipe
          </span>
          <Button onClick={openCreate}>Tambah Tipe</Button>
        </div>
        {loading ? (
          <SkeletonLines count={6} />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {list.length === 0 ? (
                <p className="text-sm text-gray-500">Tidak ada component type.</p>
              ) : (
                list.map((row) => (
                  <Card key={row.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-50">
                          {row.name}
                        </p>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                          {row.category} {row.unit_label ? `• ${row.unit_label}` : ""}
                        </p>
                      </div>
                      <Badge variant={row.is_active ? "success" : "neutral"}>
                        {row.is_active ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-gray-500">Icon</p>
                        <p className="text-gray-900 dark:text-gray-50">
                          {row.icon ?? "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Sort</p>
                        <p className="text-gray-900 dark:text-gray-50">
                          {row.sort_order}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        className="!py-2 !text-sm"
                        onClick={() => openEdit(row)}
                      >
                        Edit
                      </Button>
                      {row.is_active ? (
                        <Button
                          variant="warning"
                          className="!py-2 !text-sm"
                          onClick={() => handleDelete(row)}
                        >
                          Nonaktifkan
                        </Button>
                      ) : (
                        <Button
                          variant="light"
                          className="!py-2 !text-sm"
                          onClick={() => handleActivate(row)}
                        >
                          Aktifkan
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        className="!py-2 !text-sm"
                        onClick={() => handleHardDelete(row)}
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
                      <TableHeaderCell>Kategori</TableHeaderCell>
                      <TableHeaderCell>Icon</TableHeaderCell>
                      <TableHeaderCell>Sort</TableHeaderCell>
                      <TableHeaderCell>Status</TableHeaderCell>
                      <TableHeaderCell className="text-right">Aksi</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {list.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium text-gray-900 dark:text-gray-50">
                          {row.name}
                        </TableCell>
                        <TableCell>{row.category}</TableCell>
                        <TableCell>{row.icon ?? "—"}</TableCell>
                        <TableCell>{row.sort_order}</TableCell>
                        <TableCell>
                          <Badge variant={row.is_active ? "success" : "neutral"}>
                            {row.is_active ? "Aktif" : "Nonaktif"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-2">
                            <Button
                              variant="secondary"
                              className="!py-1.5 !text-xs"
                              onClick={() => openEdit(row)}
                            >
                              Edit
                            </Button>
                            {row.is_active ? (
                              <Button
                                variant="warning"
                                className="!py-1.5 !text-xs"
                                onClick={() => handleDelete(row)}
                              >
                                Nonaktifkan
                              </Button>
                            ) : (
                              <Button
                                variant="light"
                                className="!py-1.5 !text-xs"
                                onClick={() => handleActivate(row)}
                              >
                                Aktifkan
                              </Button>
                            )}
                            <Button
                              variant="destructive"
                              className="!py-1.5 !text-xs"
                              onClick={() => handleHardDelete(row)}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Component Type" : "Tambah Component Type"}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nama</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1"
                  placeholder="e.g. DISK"
                />
              </div>
              <div>
                <Label>Kategori</Label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1"
                  placeholder="general"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Icon</Label>
                <Input
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="mt-1"
                  placeholder="icon name"
                />
              </div>
              <div>
                <Label>Unit label</Label>
                <Input
                  value={unit_label}
                  onChange={(e) => setUnitLabel(e.target.value)}
                  className="mt-1"
                  placeholder="e.g. GB"
                />
              </div>
            </div>
            <div>
              <Label>Sort order</Label>
              <Input
                type="number"
                value={sort_order}
                onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                className="mt-1 w-24"
              />
            </div>
            <MetricSchemaEditor value={metric_schema} onChange={setMetricSchema} />
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
