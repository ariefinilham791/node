import { randomUUID } from "crypto"
import mysql from "mysql2/promise"

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME ?? "dc_monitoring",
  user: process.env.DB_USER ?? "app_user",
  password: process.env.DB_PASSWORD ?? "",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

// ─── Users (dc_monitoring schema) ───────────────────────────────────────────
export type User = {
  id: number
  username: string
  full_name: string
  email: string
  password: string
  role: "admin" | "technician" | "supervisor" | "dept_head"
  location_id: number | null
  is_active: number
  last_login: Date | null
  created_at: Date
  updated_at: Date
}

export type UserSafe = Omit<User, "password">

export async function getUserByUsername(username: string): Promise<User | null> {
  try {
    const [rows] = await pool.execute(
      `SELECT id, username, full_name, email, password, role, location_id, is_active, last_login, created_at, updated_at
       FROM users WHERE username = ? AND is_active = 1 LIMIT 1`,
      [username]
    )
    return ((rows as unknown[])[0] as User) ?? null
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("Unknown column") && msg.includes("full_name")) {
      const [rows] = await pool.execute(
        `SELECT id, username, email, password FROM users WHERE username = ? LIMIT 1`,
        [username]
      )
      const row = (rows as unknown[])[0] as Record<string, unknown> | undefined
      if (!row) return null
      return {
        id: row.id as number,
        username: row.username as string,
        full_name: (row.full_name as string) ?? (row.username as string),
        email: (row.email as string) ?? "",
        password: row.password as string,
        role: "technician",
        location_id: null,
        is_active: 1,
        last_login: null,
        created_at: new Date(),
        updated_at: new Date(),
      }
    }
    throw e
  }
}

export async function getUserById(id: number): Promise<UserSafe | null> {
  const [rows] = await pool.execute(
    `SELECT id, username, full_name, email, role, location_id, is_active, last_login, created_at, updated_at
     FROM users WHERE id = ? LIMIT 1`,
    [id]
  )
  return ((rows as unknown[])[0] as UserSafe) ?? null
}

export async function updateLastLogin(userId: number): Promise<void> {
  try {
    await pool.execute("UPDATE users SET last_login = NOW() WHERE id = ?", [
      userId,
    ])
  } catch {
    // Kolom last_login atau tabel tidak ada (schema lama)
  }
}

// ─── User sessions (JWT blacklist) ──────────────────────────────────────────
const JWT_EXPIRY_DAYS = 7

export async function insertUserSession(
  userId: number,
  tokenJti: string
): Promise<void> {
  try {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + JWT_EXPIRY_DAYS)
    await pool.execute(
      "INSERT INTO user_sessions (user_id, token_jti, expires_at) VALUES (?, ?, ?)",
      [userId, tokenJti, expiresAt]
    )
  } catch {
    // Tabel user_sessions tidak ada (schema lama) — login tetap jalan
  }
}

export async function isSessionValid(tokenJti: string): Promise<boolean> {
  try {
    const [rows] = await pool.execute(
      "SELECT id FROM user_sessions WHERE token_jti = ? AND revoked = 0 AND expires_at > NOW() LIMIT 1",
      [tokenJti]
    )
    return (rows as unknown[]).length > 0
  } catch {
    return true
  }
}

export async function revokeSessionByJti(tokenJti: string): Promise<void> {
  try {
    await pool.execute("UPDATE user_sessions SET revoked = 1 WHERE token_jti = ?", [
      tokenJti,
    ])
  } catch {
    // Tabel user_sessions tidak ada
  }
}

export function generateJti(): string {
  return randomUUID()
}

export { pool }
