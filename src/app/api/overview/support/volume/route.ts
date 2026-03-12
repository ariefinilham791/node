import { getSession } from "@/lib/auth"
import { jsonError, jsonOk } from "@/lib/http"
import { getOverviewSupportVolume } from "@/lib/overview-queries"

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return jsonError("Unauthorized", 401)
    const volume = await getOverviewSupportVolume()
    return jsonOk(volume)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error"
    return jsonError(msg, 500)
  }
}

