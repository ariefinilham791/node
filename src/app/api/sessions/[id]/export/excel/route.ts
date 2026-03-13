import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { getSession } from "@/lib/auth"
import { getSessionExportData } from "@/lib/queries"

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const sessionId = Number((await context.params).id)
  if (!sessionId) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 })
  }
  const rows = await getSessionExportData(sessionId)
  const data = rows.map((r) => ({
    hostname: r.hostname,
    name: r.name ?? "",
    ip_address: r.ip_address ?? "",
    mem_used_pct: r.mem_used_pct ?? "",
    cpu_load_pct: r.cpu_load_pct ?? "",
    email_pop3: r.email_pop3 ?? "",
    email_imap: r.email_imap ?? "",
    web_service: r.web_service ?? "",
    av_pattern: r.av_pattern ?? "",
    overall_status: r.overall_status ?? "",
    remark: r.remark ?? "",
    component_type: r.component_type,
    component_label: r.component_label,
    slot_index: r.slot_index,
    metrics: typeof r.metrics === "string" ? r.metrics : JSON.stringify(r.metrics ?? {}),
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Monitoring")
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
  return new NextResponse(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="session-${sessionId}-export.xlsx"`,
    },
  })
}
