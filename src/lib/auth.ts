import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import {
  getUserById,
  isSessionValid,
  insertUserSession,
  generateJti,
} from "./db"

const COOKIE_NAME = "dc_token"
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "default-secret-change-me"
)
const MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export type JWTPayload = {
  userId: number
  username: string
  full_name: string
  role: string
  jti: string
}

export type SessionUser = {
  userId: number
  username: string
  full_name: string
  role: string
  email?: string
  location_id?: number | null
}

export async function createToken(payload: Omit<JWTPayload, "jti">): Promise<{
  token: string
  jti: string
}> {
  const jti = generateJti()
  const token = await new SignJWT({ ...payload, jti })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(JWT_SECRET)
  await insertUserSession(payload.userId, jti)
  return { token, jti }
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    const userId = Number(payload.userId)
    const username = String(payload.username ?? "")
    const full_name = String(payload.full_name ?? "")
    const role = String(payload.role ?? "technician")
    const jti = String(payload.jti ?? "")
    if (!userId || !username || !jti) return null
    return { userId, username, full_name, role, jti }
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload) return null
  const valid = await isSessionValid(payload.jti)
  if (!valid) return null
  const user = await getUserById(payload.userId)
  if (!user) return null
  return {
    userId: user.id,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    email: user.email,
    location_id: user.location_id,
  }
}

export async function getSessionForLogout(): Promise<{ jti: string } | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload) return null
  return { jti: payload.jti }
}

export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  })
}

export async function removeAuthCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export { COOKIE_NAME }
