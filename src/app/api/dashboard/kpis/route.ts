import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import {
  getTotalActiveServers,
  getServerStatusCounts,
  getWeeklyCompletion,
  getServerStatusForDonut,
  getServerLatestStatusTable,
} from "@/lib/queries"

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const [
    totalServers,
    statusCounts,
    weeklyCompletion,
    donutData,
    serverTable,
  ] = await Promise.all([
    getTotalActiveServers(),
    getServerStatusCounts(),
    getWeeklyCompletion(),
    getServerStatusForDonut(),
    getServerLatestStatusTable(),
  ])
  const warning = statusCounts.find((s) => s.overall_status === "WARNING")?.total ?? 0
  const critical = statusCounts.find((s) => s.overall_status === "CRITICAL")?.total ?? 0
  const thisWeekPct =
    weeklyCompletion.length > 0
      ? Math.round(
          weeklyCompletion.reduce((a, w) => a + Number(w.completion_pct), 0) /
            weeklyCompletion.length
        )
      : 0
  return NextResponse.json({
    totalServers,
    warning,
    critical,
    thisWeekCompletionPct: thisWeekPct,
    weeklyCompletion,
    donutData,
    serverTable,
  })
}
