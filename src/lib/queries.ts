import type { ResultSetHeader, RowDataPacket } from "mysql2/promise"
import { pool } from "./db"

// ─── Reminder (sp_check_reminder) ───────────────────────────────────────────
export type ReminderRow = {
  schedule_id: number
  location_id: number
  location_name: string
  week_number: number
  year: number
  due_date: string
  status: string
  days_remaining: number
  urgency: string
}

export async function checkReminder(userId: number): Promise<ReminderRow | null> {
  const [resultSets] = await pool.query("CALL sp_check_reminder(?)", [userId])
  const firstSet = Array.isArray(resultSets) ? (resultSets as RowDataPacket[][])[0] : null
  const rows = Array.isArray(firstSet) ? firstSet : []
  return rows.length ? (rows[0] as ReminderRow) : null
}

export async function dismissReminder(
  scheduleId: number,
  userId: number
): Promise<void> {
  await pool.execute(
    `INSERT INTO reminder_logs (schedule_id, user_id, channel)
     VALUES (?, ?, 'web_popup')
     ON DUPLICATE KEY UPDATE dismissed_at = NOW()`,
    [scheduleId, userId]
  )
}

// ─── Dashboard KPIs ─────────────────────────────────────────────────────────
export async function getTotalActiveServers(): Promise<number> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM servers WHERE physical_status = 'active'"
  )
  return Number((rows as RowDataPacket[])?.[0]?.total ?? 0)
}

export async function getServerStatusCounts(): Promise<
  { overall_status: string; total: number }[]
> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT overall_status, COUNT(*) AS total
     FROM v_server_latest_status
     WHERE overall_status IN ('WARNING','CRITICAL')
     GROUP BY overall_status`
  )
  return (rows ?? []) as { overall_status: string; total: number }[]
}
/** Semua status untuk DonutChart: OK, WARNING, CRITICAL, UNKNOWN */
export async function getServerStatusForDonut(): Promise<
  { name: string; value: number }[]
> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COALESCE(overall_status, 'UNKNOWN') AS name, COUNT(*) AS value
     FROM v_server_latest_status
     GROUP BY overall_status`
  )
  return (rows ?? []) as { name: string; value: number }[]
}

export type ServerLatestStatusRow = {
  server_id: number
  hostname: string
  ip_address: string | null
  location_name: string
  overall_status: string | null
  mem_used_pct: number | null
  cpu_load_pct: number | null
  email_pop3: string | null
  email_imap: string | null
  web_service: string | null
  checked_at: string | null
}

export async function getServerLatestStatusTable(): Promise<ServerLatestStatusRow[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT server_id, hostname, ip_address, location_name, overall_status,
            mem_used_pct, cpu_load_pct, email_pop3, email_imap, web_service, checked_at
     FROM v_server_latest_status
     ORDER BY location_name, hostname`
  )
  return (rows ?? []) as ServerLatestStatusRow[]
}

export async function getWeeklyCompletion(): Promise<
  { location_name: string; completion_pct: number; schedule_status: string; cnt_warning: number; cnt_critical: number }[]
> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT location_name, completion_pct, schedule_status, COALESCE(cnt_warning,0) AS cnt_warning, COALESCE(cnt_critical,0) AS cnt_critical
     FROM v_weekly_completion_rate
     WHERE week_number = WEEK(CURDATE(),3) AND year = YEAR(CURDATE())`
  )
  return (rows ?? []) as { location_name: string; completion_pct: number; schedule_status: string; cnt_warning: number; cnt_critical: number }[]
}

// ─── Chart 3 months ────────────────────────────────────────────────────────
export type ChartRow = {
  week_start: string
  location_name: string
  completion_pct: number
  cnt_ok: number
  cnt_warning: number
  cnt_critical: number
}

export async function getCompletionChart(): Promise<ChartRow[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT week_start, location_name, completion_pct, COALESCE(cnt_ok,0) AS cnt_ok, COALESCE(cnt_warning,0) AS cnt_warning, COALESCE(cnt_critical,0) AS cnt_critical
     FROM v_weekly_completion_rate
     ORDER BY week_start ASC`
  )
  return (rows ?? []) as ChartRow[]
}

// ─── Servers list ───────────────────────────────────────────────────────────
export type ServerRow = {
  id: number
  hostname: string
  ip_address: string | null
  os: string | null
  server_type: string
  physical_status: string
  location_name: string
  component_count: number
}

export async function getServersList(): Promise<ServerRow[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.id, s.hostname, s.ip_address, s.os, s.server_type, s.physical_status,
            l.name AS location_name,
            COUNT(sc.id) AS component_count
     FROM servers s
     JOIN locations l ON s.location_id = l.id
     LEFT JOIN server_components sc ON sc.server_id = s.id AND sc.is_active = 1
     GROUP BY s.id, s.hostname, s.ip_address, s.os, s.server_type, s.physical_status, l.name, s.sort_order
     ORDER BY l.name, s.sort_order`
  )
  return (rows ?? []) as ServerRow[]
}

export type ServerWithComponentsRow = ServerRow & {
  components: ServerComponentRow[]
}

export async function getServersListWithComponents(): Promise<ServerWithComponentsRow[]> {
  const servers = await getServersList()
  const componentsByServerId = new Map<number, ServerComponentRow[]>()
  if (servers.length === 0) return []

  const ids = servers.map((s) => s.id)
  const placeholders = ids.map(() => "?").join(",")
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT sc.server_id, sc.id, sc.label, sc.slot_index, sc.specs,
            ct.name AS type_name, ct.category, ct.icon, ct.metric_schema, ct.unit_label
     FROM server_components sc
     JOIN component_types ct ON sc.component_type_id = ct.id
     WHERE sc.is_active = 1 AND sc.server_id IN (${placeholders})
     ORDER BY sc.server_id, ct.sort_order, sc.slot_index`,
    ids
  )
  for (const r of (rows ?? []) as RowDataPacket[]) {
    const sid = Number(r.server_id)
    const arr = componentsByServerId.get(sid) ?? []
    arr.push({
      id: Number(r.id),
      label: r.label,
      slot_index: Number(r.slot_index),
      specs: r.specs ?? null,
      type_name: r.type_name,
      category: r.category,
      icon: r.icon ?? null,
      metric_schema: r.metric_schema,
      unit_label: r.unit_label ?? null,
    } as ServerComponentRow)
    componentsByServerId.set(sid, arr)
  }
  return servers.map((s) => ({
    ...s,
    components: componentsByServerId.get(s.id) ?? [],
  }))
}

export async function createServer(data: {
  hostname: string
  ip_address: string | null
  os: string | null
  server_type: string
  physical_status: string
  location_id: number
  sort_order: number
}): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO servers (hostname, ip_address, os, server_type, physical_status, location_id, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.hostname,
      data.ip_address ?? null,
      data.os ?? null,
      data.server_type,
      data.physical_status,
      data.location_id,
      data.sort_order,
    ]
  )
  return result.insertId
}

export async function deactivateServer(id: number): Promise<void> {
  // soft delete (keep historical snapshots)
  await pool.execute("UPDATE servers SET physical_status = 'inactive' WHERE id = ?", [id])
}

export async function hardDeleteServer(id: number): Promise<void> {
  await pool.execute("DELETE FROM servers WHERE id = ?", [id])
}

export type ServerDetailRow = {
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

export async function getServerById(id: number): Promise<ServerDetailRow | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.id, s.hostname, s.ip_address, s.os, s.server_type, s.physical_status, s.location_id, s.sort_order, l.name AS location_name
     FROM servers s
     JOIN locations l ON s.location_id = l.id
     WHERE s.id = ? LIMIT 1`,
    [id]
  )
  const r = (rows ?? [])[0]
  return r ? (r as ServerDetailRow) : null
}

export async function updateServer(
  id: number,
  data: {
    hostname?: string
    ip_address?: string | null
    os?: string | null
    server_type?: string
    physical_status?: string
    location_id?: number
    sort_order?: number
  }
): Promise<void> {
  const updates: string[] = []
  const params: (string | number | null)[] = []
  if (data.hostname !== undefined) {
    updates.push("hostname = ?")
    params.push(data.hostname)
  }
  if (data.ip_address !== undefined) {
    updates.push("ip_address = ?")
    params.push(data.ip_address)
  }
  if (data.os !== undefined) {
    updates.push("os = ?")
    params.push(data.os)
  }
  if (data.server_type !== undefined) {
    updates.push("server_type = ?")
    params.push(data.server_type)
  }
  if (data.physical_status !== undefined) {
    updates.push("physical_status = ?")
    params.push(data.physical_status)
  }
  if (data.location_id !== undefined) {
    updates.push("location_id = ?")
    params.push(data.location_id)
  }
  if (data.sort_order !== undefined) {
    updates.push("sort_order = ?")
    params.push(data.sort_order)
  }
  if (updates.length === 0) return
  params.push(id)
  await pool.execute(`UPDATE servers SET ${updates.join(", ")} WHERE id = ?`, params)
}

export type ServerComponentDetailRow = ServerComponentRow & { component_type_id: number }

export async function getServerComponentsWithTypeId(
  serverId: number
): Promise<(ServerComponentRow & { component_type_id: number })[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT sc.id, sc.server_id, sc.component_type_id, sc.label, sc.slot_index, sc.specs,
            ct.name AS type_name, ct.category, ct.icon, ct.metric_schema, ct.unit_label
     FROM server_components sc
     JOIN component_types ct ON sc.component_type_id = ct.id
     WHERE sc.server_id = ? AND sc.is_active = 1
     ORDER BY ct.sort_order, sc.slot_index`,
    [serverId]
  )
  return (rows ?? []) as (ServerComponentRow & { component_type_id: number })[]
}

export async function createServerComponent(data: {
  server_id: number
  component_type_id: number
  label: string
  slot_index: number
  specs: Record<string, unknown> | null
}): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    "INSERT INTO server_components (server_id, component_type_id, label, slot_index, specs, is_active) VALUES (?, ?, ?, ?, ?, 1)",
    [
      data.server_id,
      data.component_type_id,
      data.label,
      data.slot_index,
      data.specs ? JSON.stringify(data.specs) : null,
    ]
  )
  return result.insertId
}

export async function updateServerComponent(
  id: number,
  data: { label?: string; slot_index?: number; specs?: Record<string, unknown> | null }
): Promise<void> {
  const updates: string[] = []
  const params: (string | number | null)[] = []
  if (data.label !== undefined) {
    updates.push("label = ?")
    params.push(data.label)
  }
  if (data.slot_index !== undefined) {
    updates.push("slot_index = ?")
    params.push(data.slot_index)
  }
  if (data.specs !== undefined) {
    updates.push("specs = ?")
    params.push(data.specs ? JSON.stringify(data.specs) : null)
  }
  if (updates.length === 0) return
  params.push(id)
  await pool.execute(`UPDATE server_components SET ${updates.join(", ")} WHERE id = ?`, params)
}

export async function deleteServerComponent(id: number): Promise<void> {
  await pool.execute("UPDATE server_components SET is_active = 0 WHERE id = ?", [id])
}

export type ServerLatestSnapshotRow = {
  snapshot_id: number
  mem_used_pct: number | null
  cpu_load_pct: number | null
  overall_status: string | null
  checked_at: string | null
}

export async function getServerLatestSnapshot(serverId: number): Promise<ServerLatestSnapshotRow | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ss.id AS snapshot_id, ss.mem_used_pct, ss.cpu_load_pct, ss.overall_status, ss.checked_at
     FROM server_snapshots ss
     WHERE ss.server_id = ?
     ORDER BY ss.checked_at DESC LIMIT 1`,
    [serverId]
  )
  const r = (rows ?? [])[0]
  return r ? (r as ServerLatestSnapshotRow) : null
}

export type ServerComponentReadingRow = {
  server_component_id: number
  component_label: string
  type_name: string
  metrics: unknown
}

export async function getServerLatestComponentReadings(
  serverId: number
): Promise<ServerComponentReadingRow[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT cr.server_component_id, sc.label AS component_label, ct.name AS type_name, cr.metrics
     FROM component_readings cr
     JOIN server_components sc ON sc.id = cr.server_component_id
     JOIN component_types ct ON ct.id = sc.component_type_id
     WHERE cr.snapshot_id = (SELECT id FROM server_snapshots WHERE server_id = ? ORDER BY checked_at DESC LIMIT 1)
     ORDER BY ct.sort_order, sc.slot_index`,
    [serverId]
  )
  return (rows ?? []) as ServerComponentReadingRow[]
}

// ─── Users (for dropdowns) ──────────────────────────────────────────────────
export type UserOption = { id: number; full_name: string; role: string }

export async function getUsersByRole(roles: string[]): Promise<UserOption[]> {
  if (roles.length === 0) return []
  const placeholders = roles.map(() => "?").join(",")
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, full_name, role FROM users WHERE is_active = 1 AND role IN (${placeholders}) ORDER BY full_name`,
    roles
  )
  return (rows ?? []) as UserOption[]
}

export type UserListRow = {
  id: number
  username: string
  full_name: string
  email: string
  role: string
  location_id: number | null
  location_name: string | null
  is_active: number
}

export async function getUsersList(): Promise<UserListRow[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.id, u.username, u.full_name, u.email, u.role, u.location_id, u.is_active, l.name AS location_name
     FROM users u
     LEFT JOIN locations l ON u.location_id = l.id
     ORDER BY u.full_name`
  )
  return (rows ?? []) as UserListRow[]
}

export async function createUser(data: {
  username: string
  full_name: string
  email: string
  password_hash: string
  role: string
  location_id: number | null
}): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    "INSERT INTO users (username, full_name, email, password, role, location_id, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)",
    [data.username, data.full_name, data.email, data.password_hash, data.role, data.location_id]
  )
  return result.insertId
}

export async function updateUser(
  id: number,
  data: {
    full_name?: string
    email?: string
    role?: string
    location_id?: number | null
    password_hash?: string | null
    is_active?: number
  }
): Promise<void> {
  const updates: string[] = []
  const params: (string | number | null)[] = []
  if (data.full_name !== undefined) {
    updates.push("full_name = ?")
    params.push(data.full_name)
  }
  if (data.email !== undefined) {
    updates.push("email = ?")
    params.push(data.email)
  }
  if (data.role !== undefined) {
    updates.push("role = ?")
    params.push(data.role)
  }
  if (data.location_id !== undefined) {
    updates.push("location_id = ?")
    params.push(data.location_id)
  }
  if (data.password_hash !== undefined && data.password_hash !== null && data.password_hash !== "") {
    updates.push("password = ?")
    params.push(data.password_hash)
  }
  if (data.is_active !== undefined) {
    updates.push("is_active = ?")
    params.push(data.is_active)
  }
  if (updates.length === 0) return
  params.push(id)
  await pool.execute(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params)
}

// ─── Locations ─────────────────────────────────────────────────────────────
export type LocationRow = { id: number; name: string; address: string | null; description: string | null; is_active: number }

export async function getLocationsList(): Promise<LocationRow[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, name, address, is_active FROM locations WHERE is_active = 1 ORDER BY name"
  )
  return ((rows ?? []) as { id: number; name: string; address: string | null; is_active: number }[]).map(
    (r) => ({ ...r, description: null })
  ) as LocationRow[]
}

export async function getLocationsListAll(): Promise<LocationRow[]> {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT id, name, address, COALESCE(description,'') AS description, is_active FROM locations ORDER BY name"
    )
    return (rows ?? []) as LocationRow[]
  } catch {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT id, name, address, is_active FROM locations ORDER BY name"
    )
    return ((rows ?? []) as { id: number; name: string; address: string | null; is_active: number }[]).map(
      (r) => ({ ...r, description: null })
    ) as LocationRow[]
  }
}

export async function getLocationById(id: number): Promise<LocationRow | null> {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT id, name, address, COALESCE(description,'') AS description, is_active FROM locations WHERE id = ? LIMIT 1",
      [id]
    )
    const r = (rows ?? [])[0]
    return r ? (r as LocationRow) : null
  } catch {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT id, name, address, is_active FROM locations WHERE id = ? LIMIT 1",
      [id]
    )
    const r = (rows ?? [])[0] as { id: number; name: string; address: string | null; is_active: number } | undefined
    return r ? { ...r, description: null } : null
  }
}

export async function createLocation(data: {
  name: string
  address: string | null
  description?: string | null
}): Promise<number> {
  try {
    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO locations (name, address, description, is_active) VALUES (?, ?, ?, 1)",
      [data.name, data.address ?? null, data.description ?? null]
    )
    return result.insertId
  } catch {
    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO locations (name, address, is_active) VALUES (?, ?, 1)",
      [data.name, data.address ?? null]
    )
    return result.insertId
  }
}

export async function updateLocation(
  id: number,
  data: { name: string; address: string | null; description?: string | null; is_active?: number }
): Promise<void> {
  try {
    await pool.execute(
      "UPDATE locations SET name = ?, address = ?, description = ?, is_active = COALESCE(?, is_active) WHERE id = ?",
      [data.name, data.address ?? null, data.description ?? null, data.is_active ?? null, id]
    )
  } catch {
    await pool.execute(
      "UPDATE locations SET name = ?, address = ?, is_active = COALESCE(?, is_active) WHERE id = ?",
      [data.name, data.address ?? null, data.is_active ?? null, id]
    )
  }
}

export async function deleteLocation(id: number): Promise<void> {
  await pool.execute("UPDATE locations SET is_active = 0 WHERE id = ?", [id])
}

export async function hardDeleteLocation(id: number): Promise<void> {
  await pool.execute("DELETE FROM locations WHERE id = ?", [id])
}

// ─── Component Types ────────────────────────────────────────────────────────
export type ComponentTypeRow = {
  id: number
  name: string
  category: string
  icon: string | null
  unit_label: string | null
  sort_order: number
  metric_schema: unknown
  is_active: number
}

export async function getComponentTypesList(): Promise<ComponentTypeRow[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, name, category, icon, unit_label, sort_order, metric_schema, is_active FROM component_types ORDER BY sort_order, name"
  )
  return (rows ?? []) as ComponentTypeRow[]
}

export async function getComponentTypeById(id: number): Promise<ComponentTypeRow | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, name, category, icon, unit_label, sort_order, metric_schema, is_active FROM component_types WHERE id = ? LIMIT 1",
    [id]
  )
  const r = (rows ?? [])[0]
  return r ? (r as ComponentTypeRow) : null
}

export async function createComponentType(data: {
  name: string
  category: string
  icon: string | null
  unit_label: string | null
  sort_order: number
  metric_schema: unknown
}): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    "INSERT INTO component_types (name, category, icon, unit_label, sort_order, metric_schema, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)",
    [
      data.name,
      data.category,
      data.icon ?? null,
      data.unit_label ?? null,
      data.sort_order,
      typeof data.metric_schema === "string" ? data.metric_schema : JSON.stringify(data.metric_schema ?? []),
    ]
  )
  return result.insertId
}

export async function updateComponentType(
  id: number,
  data: {
    name: string
    category: string
    icon: string | null
    unit_label: string | null
    sort_order: number
    metric_schema: unknown
    is_active?: number
  }
): Promise<void> {
  await pool.execute(
    "UPDATE component_types SET name = ?, category = ?, icon = ?, unit_label = ?, sort_order = ?, metric_schema = ?, is_active = COALESCE(?, is_active) WHERE id = ?",
    [
      data.name,
      data.category,
      data.icon ?? null,
      data.unit_label ?? null,
      data.sort_order,
      typeof data.metric_schema === "string" ? data.metric_schema : JSON.stringify(data.metric_schema ?? []),
      data.is_active ?? null,
      id,
    ]
  )
}

export async function deleteComponentType(id: number): Promise<void> {
  await pool.execute("UPDATE component_types SET is_active = 0 WHERE id = ?", [id])
}

export async function hardDeleteComponentType(id: number): Promise<void> {
  await pool.execute("DELETE FROM component_types WHERE id = ?", [id])
}

// ─── Schedules ─────────────────────────────────────────────────────────────
export type ScheduleRow = {
  id: number
  location_id: number
  location_name: string
  week_number: number
  year: number
  week_start: string
  week_end: string
  due_date: string
  status: string
  assigned_to: number | null
  assigned_to_name: string | null
  total_servers: number
  servers_checked: number
  completion: string
}

export async function getSchedulesList(filters?: {
  locationId?: number
  status?: string
}): Promise<ScheduleRow[]> {
  let sql = `
    SELECT ms.id, ms.location_id, l.name AS location_name, ms.week_number, ms.year,
           ms.week_start, ms.week_end, ms.due_date, ms.status, ms.assigned_to,
           u.full_name AS assigned_to_name,
           COALESCE(v.total_servers, 0) AS total_servers,
           COALESCE(v.servers_checked, 0) AS servers_checked,
           CONCAT(COALESCE(v.servers_checked, 0), '/', COALESCE(v.total_servers, 0)) AS completion
    FROM monitoring_schedules ms
    JOIN locations l ON ms.location_id = l.id
    LEFT JOIN users u ON ms.assigned_to = u.id
    LEFT JOIN (
      SELECT ms2.id AS schedule_id,
             COUNT(DISTINCT s.id) AS total_servers,
             COUNT(DISTINCT ss.server_id) AS servers_checked
      FROM monitoring_schedules ms2
      JOIN servers s ON s.location_id = ms2.location_id AND s.physical_status = 'active'
      LEFT JOIN monitoring_sessions msess ON msess.schedule_id = ms2.id
      LEFT JOIN server_snapshots ss ON ss.session_id = msess.id AND ss.server_id = s.id
      GROUP BY ms2.id
    ) v ON v.schedule_id = ms.id
    WHERE ms.week_start >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
  `
  const params: (number | string)[] = []
  if (filters?.locationId) {
    sql += " AND ms.location_id = ?"
    params.push(filters.locationId)
  }
  if (filters?.status) {
    sql += " AND ms.status = ?"
    params.push(filters.status)
  }
  sql += " ORDER BY ms.week_start DESC, l.name"
  const [rows] = await pool.execute<RowDataPacket[]>(sql, params)
  return (rows ?? []) as ScheduleRow[]
}

// ─── Session ───────────────────────────────────────────────────────────────
export async function getOrCreateSession(
  scheduleId: number,
  temperature: number | null,
  humidity: number | null,
  preparedBy: number
): Promise<number> {
  const [existing] = await pool.execute<RowDataPacket[]>(
    "SELECT id FROM monitoring_sessions WHERE schedule_id = ? LIMIT 1",
    [scheduleId]
  )
  if (Array.isArray(existing) && existing.length > 0) {
    const id = existing[0].id as number
    if (temperature != null || humidity != null) {
      await pool.execute(
        "UPDATE monitoring_sessions SET temperature = ?, humidity = ? WHERE id = ?",
        [temperature ?? null, humidity ?? null, id]
      )
    }
    return id
  }
  const [result] = await pool.execute<ResultSetHeader>(
    "INSERT INTO monitoring_sessions (schedule_id, temperature, humidity, prepared_by) VALUES (?, ?, ?, ?)",
    [scheduleId, temperature ?? null, humidity ?? null, preparedBy]
  )
  return result.insertId
}

export async function getSessionById(sessionId: number) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT * FROM monitoring_sessions WHERE id = ? LIMIT 1",
    [sessionId]
  )
  return rows?.[0] ?? null
}

// ─── Server components for form ────────────────────────────────────────────
export type ServerComponentRow = {
  id: number
  label: string
  slot_index: number
  specs: Record<string, unknown> | null
  type_name: string
  category: string
  icon: string | null
  metric_schema: unknown
  unit_label: string | null
}

export async function getServerComponents(
  serverId: number
): Promise<ServerComponentRow[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT sc.id, sc.label, sc.slot_index, sc.specs,
            ct.name AS type_name, ct.category, ct.icon, ct.metric_schema, ct.unit_label
     FROM server_components sc
     JOIN component_types ct ON sc.component_type_id = ct.id
     WHERE sc.server_id = ? AND sc.is_active = 1
     ORDER BY ct.sort_order, sc.slot_index`,
    [serverId]
  )
  return (rows ?? []) as ServerComponentRow[]
}

// ─── Servers by location (for a schedule) ──────────────────────────────────
export async function getServersByLocation(locationId: number) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.id, s.hostname, s.ip_address, s.sort_order
     FROM servers s
     WHERE s.location_id = ? AND s.physical_status = 'active'
     ORDER BY s.sort_order`,
    [locationId]
  )
  return (rows ?? []) as { id: number; hostname: string; ip_address: string | null; sort_order: number }[]
}

// ─── Save snapshot ──────────────────────────────────────────────────────────
export async function insertServerSnapshot(data: {
  session_id: number
  server_id: number
  mem_used_pct: number | null
  cpu_load_pct: number | null
  email_pop3: string
  email_imap: string
  web_service: string
  av_pattern: string | null
  overall_status: string
  remark: string | null
}): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO server_snapshots
     (session_id, server_id, checked_at, mem_used_pct, cpu_load_pct, email_pop3, email_imap, web_service, av_pattern, overall_status, remark)
     VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       mem_used_pct=VALUES(mem_used_pct), cpu_load_pct=VALUES(cpu_load_pct),
       email_pop3=VALUES(email_pop3), email_imap=VALUES(email_imap), web_service=VALUES(web_service),
       av_pattern=VALUES(av_pattern), overall_status=VALUES(overall_status), remark=VALUES(remark)`,
    [
      data.session_id,
      data.server_id,
      data.mem_used_pct,
      data.cpu_load_pct,
      data.email_pop3,
      data.email_imap,
      data.web_service,
      data.av_pattern,
      data.overall_status,
      data.remark,
    ]
  )
  if (result.insertId) return result.insertId
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT id FROM server_snapshots WHERE session_id = ? AND server_id = ? LIMIT 1",
    [data.session_id, data.server_id]
  )
  const existingId = rows?.[0]?.id ?? 0

  // Tandai jadwal sebagai in_progress ketika ada snapshot (selama belum completed)
  const [sessions] = await pool.execute<RowDataPacket[]>(
    "SELECT schedule_id FROM monitoring_sessions WHERE id = ? LIMIT 1",
    [data.session_id]
  )
  const scheduleId = sessions?.[0]?.schedule_id as number | undefined
  if (scheduleId) {
    await pool.execute(
      "UPDATE monitoring_schedules SET status = CASE WHEN status = 'completed' THEN status ELSE 'in_progress' END WHERE id = ?",
      [scheduleId]
    )
  }

  return existingId
}

export type SnapshotForForm = {
  id: number
  server_id: number
  mem_used_pct: number | null
  cpu_load_pct: number | null
  email_pop3: string
  email_imap: string
  web_service: string
  overall_status: string
  remark: string | null
}

export type SnapshotWithReadingsForForm = SnapshotForForm & {
  readings: Record<number, Record<string, string>>
}

export async function getSessionSnapshotsForForm(
  sessionId: number
): Promise<SnapshotWithReadingsForForm[]> {
  const [snapRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, server_id, mem_used_pct, cpu_load_pct,
            email_pop3, email_imap, web_service, overall_status, remark
     FROM server_snapshots
     WHERE session_id = ?`,
    [sessionId]
  )
  const snaps = (snapRows ?? []) as SnapshotForForm[]
  if (!snaps.length) return []

  const snapshotIds = snaps.map((s) => s.id)
  const placeholders = snapshotIds.map(() => "?").join(",")
  const [readingRows] = await pool.execute<RowDataPacket[]>(
    `SELECT snapshot_id, server_component_id, metrics
     FROM component_readings
     WHERE snapshot_id IN (${placeholders})`,
    snapshotIds
  )

  const readingsBySnapshot = new Map<number, Record<number, Record<string, string>>>()
  for (const r of (readingRows ?? []) as RowDataPacket[]) {
    const sid = Number(r.snapshot_id)
    const cid = Number(r.server_component_id)
    let parsed: Record<string, unknown> = {}
    try {
      parsed =
        typeof r.metrics === "string"
          ? (JSON.parse(r.metrics) as Record<string, unknown>)
          : ((r.metrics ?? {}) as Record<string, unknown>)
    } catch {
      parsed = {}
    }
    const asString: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed)) {
      asString[k] = v != null ? String(v) : ""
    }
    const byComponent = readingsBySnapshot.get(sid) ?? {}
    byComponent[cid] = asString
    readingsBySnapshot.set(sid, byComponent)
  }

  return snaps.map((s) => ({
    ...s,
    readings: readingsBySnapshot.get(s.id) ?? {},
  }))
}

export async function upsertComponentReading(
  snapshotId: number,
  serverComponentId: number,
  metrics: Record<string, unknown>
): Promise<void> {
  await pool.execute(
    `INSERT INTO component_readings (snapshot_id, server_component_id, metrics)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE metrics = VALUES(metrics), recorded_at = NOW()`,
    [snapshotId, serverComponentId, JSON.stringify(metrics)]
  )
}

// ─── Submit session ────────────────────────────────────────────────────────
export async function submitSession(
  sessionId: number,
  acknowledgedBy: number,
  deptHeadBy: number | null
): Promise<void> {
  await pool.execute(
    "UPDATE monitoring_sessions SET submitted_at = NOW(), acknowledged_by = ?, dept_head_by = ? WHERE id = ?",
    [acknowledgedBy, deptHeadBy ?? acknowledgedBy, sessionId]
  )
  const [sessions] = await pool.execute<RowDataPacket[]>(
    "SELECT schedule_id FROM monitoring_sessions WHERE id = ? LIMIT 1",
    [sessionId]
  )
  const scheduleId = sessions?.[0]?.schedule_id
  if (scheduleId) {
    await pool.execute(
      "UPDATE monitoring_schedules SET status = 'completed' WHERE id = ?",
      [scheduleId]
    )
  }
}

// ─── Export: data for one session ───────────────────────────────────────────
export type ExportRow = {
  hostname: string
  ip_address: string | null
  mem_used_pct: number | null
  cpu_load_pct: number | null
  email_pop3: string | null
  email_imap: string | null
  web_service: string | null
  av_pattern: string | null
  overall_status: string | null
  remark: string | null
  component_type: string
  component_label: string
  slot_index: number
  type_order: number
  metrics: string
}

export async function getSessionExportData(
  sessionId: number
): Promise<ExportRow[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.hostname, s.ip_address,
            ss.mem_used_pct, ss.cpu_load_pct, ss.email_pop3, ss.email_imap,
            ss.web_service, ss.av_pattern, ss.overall_status, ss.remark,
            ct.name AS component_type, sc.label AS component_label,
            sc.slot_index, ct.sort_order AS type_order, JSON_UNQUOTE(JSON_EXTRACT(cr.metrics, '$')) AS metrics
     FROM server_snapshots ss
     JOIN servers s ON ss.server_id = s.id
     JOIN component_readings cr ON cr.snapshot_id = ss.id
     JOIN server_components sc ON cr.server_component_id = sc.id
     JOIN component_types ct ON sc.component_type_id = ct.id
     WHERE ss.session_id = ?
     ORDER BY s.sort_order, ct.sort_order, sc.slot_index`,
    [sessionId]
  )
  return (rows ?? []) as ExportRow[]
}
