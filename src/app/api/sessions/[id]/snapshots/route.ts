import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import {
  getSessionById,
  getSessionSnapshotsForForm,
  insertServerSnapshot,
  markScheduleInProgressBySessionId,
  upsertComponentReading,
} from "@/lib/queries"

type Context = { params: Promise<{ id: string }> }

type SnapshotPayload = {
  server_id: number
  mem_used_pct?: number | null
  cpu_load_pct?: number | null
  email_pop3?: string
  email_imap?: string
  web_service?: string
  av_pattern?: string | null
  overall_status?: string
  remark?: string | null
  readings?: Array<{ server_component_id: number; metrics?: Record<string, unknown> }>
}

export async function GET(_request: Request, context: Context) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const sessionId = Number((await context.params).id)
  if (!sessionId) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 })
  }
  const sessionRow = await getSessionById(sessionId)
  const snapshots = await getSessionSnapshotsForForm(sessionId)
  return NextResponse.json({ session: sessionRow, snapshots })
}

export async function POST(request: Request, context: Context) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const sessionId = Number((await context.params).id)
  if (!sessionId) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 })
  }
  const body = await request.json().catch(() => ({}))
  const snapshots: SnapshotPayload[] = Array.isArray(body.snapshots)
    ? body.snapshots
    : []

  await Promise.all(
    snapshots.map(async (snap: SnapshotPayload) => {
      const snapshotId = await insertServerSnapshot({
        session_id: sessionId,
        server_id: Number(snap.server_id),
        mem_used_pct:
          snap.mem_used_pct != null ? Number(snap.mem_used_pct) : null,
        cpu_load_pct:
          snap.cpu_load_pct != null ? Number(snap.cpu_load_pct) : null,
        email_pop3: ["UP", "DOWN", "N/A"].includes(snap.email_pop3 ?? "")
          ? (snap.email_pop3 ?? "N/A")
          : "N/A",
        email_imap: ["UP", "DOWN", "N/A"].includes(snap.email_imap ?? "")
          ? (snap.email_imap ?? "N/A")
          : "N/A",
        web_service: ["UP", "DOWN", "N/A"].includes(snap.web_service ?? "")
          ? (snap.web_service ?? "N/A")
          : "N/A",
        av_pattern:
          snap.av_pattern != null ? String(snap.av_pattern) : null,
        overall_status: ["OK", "WARNING", "CRITICAL", "UNKNOWN"].includes(
          snap.overall_status ?? ""
        )
          ? (snap.overall_status ?? "UNKNOWN")
          : "UNKNOWN",
        remark: snap.remark != null ? String(snap.remark) : null,
      })
      const readings = Array.isArray(snap.readings) ? snap.readings : []
      if (!readings.length) return
      await Promise.all(
        readings.map((r) =>
          upsertComponentReading(
            snapshotId,
            Number(r.server_component_id),
            typeof r.metrics === "object" && r.metrics != null ? r.metrics : {},
          ),
        ),
      )
    }),
  )
  if (snapshots.length > 0) {
    await markScheduleInProgressBySessionId(sessionId)
  }
  return NextResponse.json({ success: true })
}
