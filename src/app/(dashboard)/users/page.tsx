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
import { apiGet, apiPost, apiPut } from "@/lib/api-client"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableRoot,
} from "@/components/Table"
import { SkeletonLines } from "@/components/ui/Loading"

type User = {
  id: number
  username: string
  full_name: string
  email: string
  role: string
  location_id: number | null
  location_name: string | null
  is_active: number
}

type Location = { id: number; name: string }

const ROLES = ["admin", "technician", "supervisor", "dept_head"]

export default function UsersPage() {
  const [list, setList] = useState<User[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [full_name, setFullName] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("technician")
  const [location_id, setLocationId] = useState<string>("")
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await apiGet<User[]>("/api/users?list=1")
      setList(data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memuat user")
      setList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      apiGet<User[]>("/api/users?list=1"),
      apiGet<Location[]>("/api/locations"),
    ])
      .then(([usersData, locationsData]) => {
        setList(usersData)
        setLocations(locationsData)
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Gagal memuat data")
        setList([])
      })
      .finally(() => setLoading(false))
  }, [])

  function openCreate() {
    setEditing(null)
    setFullName("")
    setUsername("")
    setEmail("")
    setPassword("")
    setRole("technician")
    setLocationId("")
    setModalOpen(true)
  }

  function openEdit(u: User) {
    setEditing(u)
    setFullName(u.full_name)
    setUsername(u.username)
    setEmail(u.email)
    setPassword("")
    setRole(u.role)
    setLocationId(u.location_id != null ? String(u.location_id) : "")
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
  }

  async function handleSave() {
    if (!full_name.trim()) return
    if (!editing && !username.trim()) return
    if (!editing && (!password || password.length < 6)) {
      toast.error("Password minimal 6 karakter")
      return
    }
    setSaving(true)
    try {
      if (editing) {
        const body: Record<string, unknown> = {
          full_name: full_name.trim(),
          email: email.trim(),
          role,
          location_id: location_id ? Number(location_id) : null,
        }
        if (password.length >= 6) body.password = password
        await apiPut<{ success: true }>(`/api/users/${editing.id}`, body)
        toast.success("User berhasil diperbarui")
        await load()
        closeModal()
      } else {
        await apiPost<{ id: number }>("/api/users", {
          username: username.trim(),
          full_name: full_name.trim(),
          email: email.trim(),
          password,
          role,
          location_id: location_id ? Number(location_id) : null,
        })
        toast.success("User berhasil dibuat")
        await load()
        closeModal()
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
        User Management
      </h1>
      <p className="mt-1 text-gray-500 dark:text-gray-400">
        Kelola user, role, dan akses. Admin only.
      </p>

      <Card className="mt-6">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {list.length} user
          </span>
          <Button onClick={openCreate}>Tambah User</Button>
        </div>
        {loading ? (
          <SkeletonLines count={8} />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {list.length === 0 ? (
                <p className="text-sm text-gray-500">Tidak ada user.</p>
              ) : (
                list.map((u) => (
                  <Card key={u.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-50">
                          {u.full_name}
                        </p>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                          @{u.username} {u.email ? `• ${u.email}` : ""}
                        </p>
                      </div>
                      <Badge variant={u.is_active ? "success" : "neutral"}>
                        {u.is_active ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-gray-500">Role</p>
                        <p className="text-gray-900 dark:text-gray-50">
                          {u.role}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Lokasi</p>
                        <p className="text-gray-900 dark:text-gray-50">
                          {u.location_name ?? "—"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button
                        variant="secondary"
                        className="!py-2 !text-sm"
                        onClick={() => openEdit(u)}
                      >
                        Edit
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
                      <TableHeaderCell>Username</TableHeaderCell>
                      <TableHeaderCell>Nama</TableHeaderCell>
                      <TableHeaderCell>Email</TableHeaderCell>
                      <TableHeaderCell>Role</TableHeaderCell>
                      <TableHeaderCell>Lokasi</TableHeaderCell>
                      <TableHeaderCell>Status</TableHeaderCell>
                      <TableHeaderCell className="text-right">
                        Aksi
                      </TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {list.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium text-gray-900 dark:text-gray-50">
                          {u.username}
                        </TableCell>
                        <TableCell>{u.full_name}</TableCell>
                        <TableCell>{u.email || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="default">{u.role}</Badge>
                        </TableCell>
                        <TableCell>{u.location_name ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={u.is_active ? "success" : "neutral"}>
                            {u.is_active ? "Aktif" : "Nonaktif"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="secondary"
                            className="!py-1.5 !text-xs"
                            onClick={() => openEdit(u)}
                          >
                            Edit
                          </Button>
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
            <DialogTitle>{editing ? "Edit User" : "Tambah User"}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            <div>
              <Label>Username</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1"
                placeholder="username"
                disabled={!!editing}
              />
            </div>
            <div>
              <Label>Nama lengkap</Label>
              <Input
                value={full_name}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1"
                placeholder="Nama lengkap"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <Label>Role</Label>
              <select
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Lokasi (opsional)</Label>
              <select
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                value={location_id}
                onChange={(e) => setLocationId(e.target.value)}
              >
                <option value="">— Tidak ada —</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={String(loc.id)}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>
                Password{" "}
                {editing ? "(kosongkan jika tidak diubah)" : "(min 6 karakter)"}
              </Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
                placeholder="••••••••"
              />
            </div>
          </div>
          <DialogFooter className="mt-6 gap-2">
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              Batal
            </Button>
            <Button
              onClick={handleSave}
              isLoading={saving}
              disabled={
                !full_name.trim() ||
                (!editing && (!username.trim() || password.length < 6))
              }
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
