import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { pool } from "@/lib/db"
import { getServersByLocation, getServerComponents } from "@/lib/queries"

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const scheduleId = Number((await context.params).id)
  if (!scheduleId) {
    return NextResponse.json({ error: "Invalid schedule id" }, { status: 400 })
  }
  const [schedRows] = await pool.execute(
    "SELECT location_id FROM monitoring_schedules WHERE id = ? LIMIT 1",
    [scheduleId]
  )
  const locationId = (schedRows as { location_id: number }[])?.[0]?.location_id
  if (!locationId) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 })
  }
  const servers = await getServersByLocation(locationId)
  const withComponents = await Promise.all(
    servers.map(async (s) => ({
      ...s,
      components: await getServerComponents(s.id),
    }))
  )
  return NextResponse.json(withComponents)
}
