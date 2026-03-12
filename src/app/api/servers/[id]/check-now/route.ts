import { getSession } from "@/lib/auth"
import { jsonError, jsonOk } from "@/lib/http"
import { pool } from "@/lib/db"
import { getOrCreateMonthlySchedule, getOrCreateSession } from "@/lib/queries"

type Context = { params: Promise<{ id: string }> }

export async function POST(_request: Request, context: Context) {
  try {
    const session = await getSession()
    if (!session) return jsonError("Unauthorized", 401)

    const serverId = Number((await context.params).id)
    if (!serverId) return jsonError("Invalid server id", 400)

    const [rows] = await pool.execute(
      "SELECT location_id FROM servers WHERE id = ? LIMIT 1",
      [serverId],
    )
    const locationId = (rows as { location_id: number }[])?.[0]?.location_id
    if (!locationId) return jsonError("Server not found", 404)

    const scheduleId = await getOrCreateMonthlySchedule(Number(locationId))
    const sessionId = await getOrCreateSession(scheduleId, null, null, session.userId)

    return jsonOk({ scheduleId, sessionId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error"
    return jsonError(msg, 500)
  }
}

