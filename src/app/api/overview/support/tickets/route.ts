import { getSession } from "@/lib/auth"
import { jsonError, jsonOk } from "@/lib/http"
import { getOverviewSupportTickets } from "@/lib/overview-queries"

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return jsonError("Unauthorized", 401)
    const tickets = await getOverviewSupportTickets()
    return jsonOk(tickets)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error"
    return jsonError(msg, 500)
  }
}

