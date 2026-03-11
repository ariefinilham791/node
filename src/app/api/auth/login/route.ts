import { compare as bcryptCompare } from "bcryptjs"
import { NextResponse } from "next/server"
import { getUserByUsername, updateLastLogin } from "@/lib/db"
import { createToken, setAuthCookie } from "@/lib/auth"

async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash.startsWith("$2")) return plain === hash
  return bcryptCompare(plain, hash)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const username = String(body?.username ?? "").trim()
    const password = String(body?.password ?? "")

    if (!username || !password) {
      return NextResponse.json(
        { data: null, error: "Username dan password wajib diisi." },
        { status: 400 }
      )
    }

    const user = await getUserByUsername(username)
    if (!user) {
      return NextResponse.json(
        { data: null, error: "Username atau password salah." },
        { status: 401 }
      )
    }

    const passwordMatch = await verifyPassword(password, user.password)
    if (!passwordMatch) {
      return NextResponse.json(
        { data: null, error: "Username atau password salah." },
        { status: 401 }
      )
    }

    await updateLastLogin(user.id)

    const { token } = await createToken({
      userId: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
    })
    await setAuthCookie(token)

    return NextResponse.json({
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          role: user.role,
        },
      },
      error: null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error("Login error:", message, stack ?? "")
    const isDev = process.env.NODE_ENV !== "production"
    return NextResponse.json(
      {
        data: null,
        error: isDev ? `Server error: ${message}` : "Terjadi kesalahan server.",
      },
      { status: 500 }
    )
  }
}
