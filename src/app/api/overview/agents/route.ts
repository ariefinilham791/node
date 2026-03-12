import { getSession } from "@/lib/auth"
import { jsonError, jsonOk } from "@/lib/http"
import { getOverviewAgents } from "@/lib/overview-queries"

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return jsonError("Unauthorized", 401)
    const agents = await getOverviewAgents()
    return jsonOk(agents)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error"
    return jsonError(msg, 500)
  }
}

