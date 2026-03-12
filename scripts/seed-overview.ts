import { pool } from "../src/lib/db"

import { agents } from "../src/data/agents/agents"
import { tickets } from "../src/data/support/tickets"
import { volume } from "../src/data/support/volume"
import { workflowStats } from "../src/data/workflow/workflow-data"
import { cohorts } from "../src/data/retention/cohorts"
import { cohortsAggregate } from "../src/data/retention/cohortsAggregate"

async function main() {
  // Agents
  for (const a of agents) {
    await pool.execute(
      `INSERT INTO overview_agents
       (agent_id, full_name, account, start_date, end_date, number, email, registered, minutes_called, minutes_booked, ticket_generation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         full_name=VALUES(full_name),
         account=VALUES(account),
         start_date=VALUES(start_date),
         end_date=VALUES(end_date),
         number=VALUES(number),
         email=VALUES(email),
         registered=VALUES(registered),
         minutes_called=VALUES(minutes_called),
         minutes_booked=VALUES(minutes_booked),
         ticket_generation=VALUES(ticket_generation)`,
      [
        a.agent_id,
        a.full_name,
        a.account,
        new Date(a.start_date),
        a.end_date ? new Date(a.end_date) : null,
        a.number,
        a.email,
        a.registered ? 1 : 0,
        a.minutes_called,
        a.minutes_booked,
        a.ticket_generation ? 1 : 0,
      ],
    )
  }

  // Tickets: re-seed by clearing to match file data
  await pool.execute("DELETE FROM overview_support_tickets")
  for (const t of tickets) {
    await pool.execute(
      `INSERT INTO overview_support_tickets
       (created, status, description, priority, category, type, duration, policyNumber, policyType)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        new Date(t.created),
        t.status,
        t.description,
        t.priority,
        t.category,
        t.type,
        t.duration ?? null,
        t.policyNumber,
        t.policyType,
      ],
    )
  }

  // Volume: upsert by time label
  for (let i = 0; i < volume.length; i++) {
    const v = volume[i] as { time: string; Today: number; Yesterday: number }
    await pool.execute(
      `INSERT INTO overview_support_volume (time_label, today_count, yesterday_count, sort_order)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         today_count=VALUES(today_count),
         yesterday_count=VALUES(yesterday_count),
         sort_order=VALUES(sort_order)`,
      [v.time, v.Today, v.Yesterday, i],
    )
  }

  // Workflow stats (store first record)
  const wf = workflowStats[0]
  if (wf) {
    await pool.execute(
      `INSERT INTO overview_workflow_stats (id, total_cases, department_stats_json)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         total_cases=VALUES(total_cases),
         department_stats_json=VALUES(department_stats_json)`,
      [wf.id, wf.total_cases, JSON.stringify(wf.department_stats)],
    )
  }

  // Retention cohorts
  for (const [cohortKey, cohortData] of Object.entries(cohorts)) {
    await pool.execute(
      `INSERT INTO overview_retention_cohorts
       (cohort_key, cohort_size, start_date, end_date, summary_json, weeks_json)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         cohort_size=VALUES(cohort_size),
         start_date=VALUES(start_date),
         end_date=VALUES(end_date),
         summary_json=VALUES(summary_json),
         weeks_json=VALUES(weeks_json)`,
      [
        cohortKey,
        cohortData.size,
        new Date(cohortData.dates.start),
        new Date(cohortData.dates.end),
        JSON.stringify(cohortData.summary),
        JSON.stringify(cohortData.weeks),
      ],
    )
  }

  // Retention aggregate (single row)
  await pool.execute(
    `INSERT INTO overview_retention_aggregate (id, aggregate_json)
     VALUES ('default', ?)
     ON DUPLICATE KEY UPDATE aggregate_json=VALUES(aggregate_json)`,
    [JSON.stringify(cohortsAggregate)],
  )
}

main()
  .then(() => {
    console.log("Seed overview: OK")
    process.exit(0)
  })
  .catch((err) => {
    console.error("Seed overview: FAILED", err)
    process.exit(1)
  })

