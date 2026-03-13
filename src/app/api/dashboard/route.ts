import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import {
  getTotalActiveServers,
  getServerStatusCounts,
  getWeeklyCompletion,
  getServerStatusForDonut,
  getServerLatestStatusTable,
  getCompletionChart,
} from "@/lib/queries"

/** Satu request untuk KPIs + chart (lebih cepat daripada 2 request terpisah) */
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
    chartData,
  ] = await Promise.all([
    getTotalActiveServers(),
    getServerStatusCounts(),
    getWeeklyCompletion(),
    getServerStatusForDonut(),
    getServerLatestStatusTable(),
    getCompletionChart(),
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
  const kpis = {
    totalServers,
    warning,
    critical,
    thisWeekCompletionPct: thisWeekPct,
    weeklyCompletion,
    donutData,
    serverTable,
  }
  return NextResponse.json({ kpis, chart: chartData })
}
