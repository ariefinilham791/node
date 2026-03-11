import { NextResponse } from "next/server"
import { revokeSessionByJti } from "@/lib/db"
import { getSessionForLogout, removeAuthCookie } from "@/lib/auth"

export async function POST() {
  const session = await getSessionForLogout()
  if (session?.jti) {
    await revokeSessionByJti(session.jti)
  }
  await removeAuthCookie()
  return NextResponse.json({ success: true })
}
