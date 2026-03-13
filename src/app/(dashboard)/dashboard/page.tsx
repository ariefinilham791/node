"use client"

import { Card } from "@/components/Card"
import { ReminderPopup } from "@/components/ui/ReminderPopup"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { useEffect, useState } from "react"
import Link from "next/link"

type KPIs = {
  totalServers: number
  warning: number
  critical: number
  thisWeekCompletionPct: number
  weeklyCompletion: { location_name: string; completion_pct: number; schedule_status: string }[]
  donutData: { name: string; value: number }[]
  serverTable: {
    server_id: number
    hostname: string
    name: string | null
    ip_address: string | null
    location_name: string
    overall_status: string | null
    mem_used_pct: number | null
    cpu_load_pct: number | null
    email_pop3: string | null
    email_imap: string | null
    web_service: string | null
    checked_at: string | null
  }[]
}

type ChartPoint = {
  week_start: string
  location_name: string
  completion_pct: number
  cnt_ok: number
  cnt_warning: number
  cnt_critical: number
}

const STATUS_COLORS: Record<string, string> = {
  OK: "#22c55e",
  WARNING: "#eab308",
  CRITICAL: "#ef4444",
  UNKNOWN: "#6b7280",
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [chartData, setChartData] = useState<ChartPoint[]>([])

  useEffect(() => {
    fetch("/api/dashboard/kpis")
      .then((r) => r.json())
      .then(setKpis)
      .catch(() => {})
  }, [])
  useEffect(() => {
    fetch("/api/dashboard/chart")
      .then((r) => r.json())
      .then(setChartData)
      .catch(() => {})
  }, [])

  const chartByWeek = chartData.reduce<Record<string, ChartPoint[]>>((acc, row) => {
    const key = row.week_start
    if (!acc[key]) acc[key] = []
    acc[key].push(row)
    return acc
  }, {})
  const chartSeries = Object.entries(chartByWeek).map(([week_start, rows]) => ({
    week_start: week_start.slice(0, 10),
    ...rows.reduce(
      (a, r) => {
        a[r.location_name] = r.completion_pct
        return a
      },
      {} as Record<string, number>
    ),
  }))

  return (
    <main>
      <ReminderPopup />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            IT Data Center — Dashboard
          </h1>
          <p className="text-gray-500 sm:text-sm/6 dark:text-gray-500">
            Weekly monitoring overview
          </p>
        </div>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Total Active Servers
          </p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-50">
            {kpis?.totalServers ?? "—"}
          </p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            WARNING
          </p>
          <p className="mt-2 text-2xl font-semibold text-amber-600 dark:text-amber-400">
            {kpis?.warning ?? "—"}
          </p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            CRITICAL
          </p>
          <p className="mt-2 text-2xl font-semibold text-red-600 dark:text-red-400">
            {kpis?.critical ?? "—"}
          </p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            This Week Completion
          </p>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-50">
            {kpis?.thisWeekCompletionPct != null ? `${kpis.thisWeekCompletionPct}%` : "—"}
          </p>
        </Card>
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <Card>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50">
            Completion Rate (3 bulan)
          </h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartSeries} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis dataKey="week_start" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip />
                <Legend />
                {chartData.length
                  ? [...new Set(chartData.map((d) => d.location_name))].slice(0, 5).map((loc, i) => (
                      <Bar
                        key={loc}
                        dataKey={loc}
                        fill={["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"][i % 5]}
                        name={loc}
                        radius={[2, 2, 0, 0]}
                      />
                    ))
                  : null}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50">
            Server Status (minggu ini)
          </h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={kpis?.donutData ?? []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {(kpis?.donutData ?? []).map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? "#6b7280"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <Card className="mt-8 overflow-hidden p-0">
        <h3 className="border-b border-gray-200 px-4 py-3 text-lg font-medium text-gray-900 dark:border-gray-800 dark:text-gray-50">
          Server Status Overview
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50">
                <th className="px-4 py-3 font-medium text-gray-900 dark:text-gray-50">code asset</th>
                <th className="px-4 py-3 font-medium text-gray-900 dark:text-gray-50">Name</th>
                <th className="px-4 py-3 font-medium text-gray-900 dark:text-gray-50">Location</th>
                <th className="px-4 py-3 font-medium text-gray-900 dark:text-gray-50">Status</th>
                <th className="px-4 py-3 font-medium text-gray-900 dark:text-gray-50">MEM%</th>
                <th className="px-4 py-3 font-medium text-gray-900 dark:text-gray-50">CPU%</th>
                <th className="px-4 py-3 font-medium text-gray-900 dark:text-gray-50">Services</th>
                <th className="px-4 py-3 font-medium text-gray-900 dark:text-gray-50">Last Checked</th>
              </tr>
            </thead>
            <tbody>
              {(kpis?.serverTable ?? []).map((row) => (
                <tr
                  key={row.server_id}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/servers/${row.server_id}`}
                      className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {row.hostname}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{row.name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{row.location_name}</td>
                  <td className="px-4 py-3">
                    <span
                      className="rounded px-2 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: `${STATUS_COLORS[row.overall_status ?? "UNKNOWN"]}20`,
                        color: STATUS_COLORS[row.overall_status ?? "UNKNOWN"],
                      }}
                    >
                      {row.overall_status ?? "UNKNOWN"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{row.mem_used_pct != null ? `${row.mem_used_pct}%` : "—"}</td>
                  <td className="px-4 py-3">{row.cpu_load_pct != null ? `${row.cpu_load_pct}%` : "—"}</td>
                  <td className="px-4 py-3">
                    {[row.email_pop3, row.email_imap, row.web_service]
                      .filter(Boolean)
                      .join(" / ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {row.checked_at
                      ? new Date(row.checked_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  )
}
