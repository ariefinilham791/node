import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { submitSession } from "@/lib/queries"

type Context = { params: Promise<{ id: string }> }

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
  const acknowledgedBy = body.acknowledgedBy != null ? Number(body.acknowledgedBy) : session.userId
  const deptHeadBy = body.deptHeadBy != null ? Number(body.deptHeadBy) : session.userId
  await submitSession(sessionId, acknowledgedBy, deptHeadBy)
  return NextResponse.json({ success: true })
}
