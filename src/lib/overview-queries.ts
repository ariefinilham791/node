import type { RowDataPacket } from "mysql2/promise"
import { pool } from "./db"

import type { Agent } from "@/data/agents/schema"
import type { Ticket } from "@/data/support/schema"
import type { WorkflowStats } from "@/data/workflow/schema"
import type { CohortRetentionData, CohortsAggregate, CohortData } from "@/data/retention/schema"

export async function getOverviewAgents(): Promise<Agent[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT agent_id, full_name, account,
            DATE_FORMAT(start_date, '%Y-%m-%dT%H:%i:%s.000Z') AS start_date,
            CASE WHEN end_date IS NULL THEN NULL ELSE DATE_FORMAT(end_date, '%Y-%m-%dT%H:%i:%s.000Z') END AS end_date,
            number, email,
            registered, minutes_called, minutes_booked, ticket_generation
     FROM overview_agents
     ORDER BY full_name`,
  )
  return (rows ?? []).map((r) => ({
    agent_id: String(r.agent_id),
    full_name: String(r.full_name),
    account: String(r.account),
    start_date: String(r.start_date),
    end_date: r.end_date == null ? null : String(r.end_date),
    number: String(r.number),
    email: String(r.email),
    registered: Boolean(r.registered),
    minutes_called: Number(r.minutes_called),
    minutes_booked: Number(r.minutes_booked),
    ticket_generation: Boolean(r.ticket_generation),
  })) as Agent[]
}

export async function getOverviewSupportTickets(): Promise<Ticket[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT created, status, description, priority, category, type, duration, policyNumber, policyType
     FROM overview_support_tickets
     ORDER BY created DESC`,
  )
  return (rows ?? []).map((r) => ({
    created: new Date(r.created as string | Date).toISOString(),
    status: String(r.status),
    description: String(r.description),
    priority: String(r.priority),
    category: String(r.category),
    type: String(r.type),
    duration: r.duration == null ? null : String(r.duration),
    policyNumber: String(r.policyNumber),
    policyType: String(r.policyType),
  })) as Ticket[]
}

export async function getOverviewSupportVolume(): Promise<
  { time: string; Today: number; Yesterday: number }[]
> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT time_label, today_count, yesterday_count
     FROM overview_support_volume
     ORDER BY sort_order ASC`,
  )
  return (rows ?? []).map((r) => ({
    time: String(r.time_label),
    Today: Number(r.today_count),
    Yesterday: Number(r.yesterday_count),
  }))
}

export async function getOverviewWorkflowStats(): Promise<WorkflowStats[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, total_cases, department_stats_json
     FROM overview_workflow_stats
     LIMIT 1`,
  )
  const r = (rows ?? [])[0]
  if (!r) return []
  const raw = r.department_stats_json
  const parsed =
    typeof raw === "string"
      ? (JSON.parse(raw) as WorkflowStats["department_stats"])
      : ((raw ?? []) as WorkflowStats["department_stats"])
  return [
    {
      id: String(r.id),
      total_cases: Number(r.total_cases),
      department_stats: parsed,
    },
  ]
}

export async function getOverviewRetentionCohorts(): Promise<CohortRetentionData> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT cohort_key, cohort_size, start_date, end_date, summary_json, weeks_json
     FROM overview_retention_cohorts
     ORDER BY start_date ASC`,
  )
  const out: Record<string, CohortData> = {}
  for (const r of rows ?? []) {
    const summary =
      typeof r.summary_json === "string"
        ? JSON.parse(r.summary_json)
        : r.summary_json
    const weeks =
      typeof r.weeks_json === "string" ? JSON.parse(r.weeks_json) : r.weeks_json
    out[String(r.cohort_key)] = {
      size: Number(r.cohort_size),
      dates: {
        start: new Date(r.start_date as string | Date).toISOString(),
        end: new Date(r.end_date as string | Date).toISOString(),
      },
      summary,
      weeks,
    } as CohortData
  }
  return out as CohortRetentionData
}

export async function getOverviewRetentionAggregate(): Promise<CohortsAggregate | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT aggregate_json FROM overview_retention_aggregate WHERE id = 'default' LIMIT 1`,
  )
  const r = (rows ?? [])[0]
  if (!r) return null
  const raw = r.aggregate_json
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as CohortsAggregate
}

