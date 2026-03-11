import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getSessionExportData } from "@/lib/queries"

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const sessionId = Number((await context.params).id)
  if (!sessionId) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 })
  }
  const rows = await getSessionExportData(sessionId)
  return NextResponse.json(rows)
}
