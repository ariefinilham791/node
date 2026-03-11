import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { dismissReminder } from "@/lib/queries"

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = await request.json().catch(() => ({}))
  const scheduleId = Number(body?.schedule_id ?? body?.scheduleId)
  if (!scheduleId) {
    return NextResponse.json(
      { error: "schedule_id required" },
      { status: 400 }
    )
  }
  await dismissReminder(scheduleId, session.userId)
  return NextResponse.json({ success: true })
}
