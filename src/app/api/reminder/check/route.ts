import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { checkReminder } from "@/lib/queries"

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const reminder = await checkReminder(session.userId)
  return NextResponse.json(reminder ? { reminder } : { reminder: null })
}
