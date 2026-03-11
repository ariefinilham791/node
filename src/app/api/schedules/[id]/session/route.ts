import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { pool } from "@/lib/db"
import {
  getOrCreateSession,
} from "@/lib/queries"

type Context = { params: Promise<{ id: string }> }

async function getExistingSessionId(scheduleId: number): Promise<number | null> {
  const [rows] = await pool.execute(
    "SELECT id FROM monitoring_sessions WHERE schedule_id = ? LIMIT 1",
    [scheduleId]
  )
  const r = (rows as { id: number }[])?.[0]
  return r?.id ?? null
}

export async function GET(_request: Request, context: Context) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const scheduleId = Number((await context.params).id)
  if (!scheduleId) {
    return NextResponse.json({ error: "Invalid schedule id" }, { status: 400 })
  }
  const existingId = await getExistingSessionId(scheduleId)
  if (existingId) {
    return NextResponse.json({ sessionId: existingId, scheduleId })
  }
  const sessionId = await getOrCreateSession(
    scheduleId,
    null,
    null,
    session.userId
  )
  return NextResponse.json({ sessionId, scheduleId })
}

export async function POST(request: Request, context: Context) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const scheduleId = Number((await context.params).id)
  if (!scheduleId) {
    return NextResponse.json({ error: "Invalid schedule id" }, { status: 400 })
  }
  const body = await request.json().catch(() => ({}))
  const temperature = body.temperature != null ? Number(body.temperature) : null
  const humidity = body.humidity != null ? Number(body.humidity) : null
  const sessionId = await getOrCreateSession(
    scheduleId,
    temperature,
    humidity,
    session.userId
  )
  return NextResponse.json({ sessionId, scheduleId })
}
