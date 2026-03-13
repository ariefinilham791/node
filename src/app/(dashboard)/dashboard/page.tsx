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
import { useEffect, useMemo, useState } from "react"
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
    os: string | null
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
    let cancelled = false
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data) {
          setKpis(data.kpis ?? null)
          setChartData(Array.isArray(data.chart) ? data.chart : [])
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const chartSeries = useMemo(() => {
    const chartByWeek = chartData.reduce<Record<string, ChartPoint[]>>((acc, row) => {
      const key = row.week_start
      if (!acc[key]) acc[key] = []
      acc[key].push(row)
      return acc
    }, {})
    return Object.entries(chartByWeek).map(([week_start, rows]) => ({
      week_start: week_start.slice(0, 10),
      ...rows.reduce(
        (a, r) => {
          a[r.location_name] = r.completion_pct
          return a
        },
        {} as Record<string, number>
      ),
    }))
  }, [chartData])

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
    </main>
  )
}
