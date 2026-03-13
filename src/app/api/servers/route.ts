import { getSession } from "@/lib/auth"
import { createServer, getServersList, getServersListWithComponents, getServersListWithNextCheck } from "@/lib/queries"
import { jsonError, jsonOk, parseJson, zodErrorToMessage } from "@/lib/http"
import { z } from "zod"

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session) return jsonError("Unauthorized", 401)
    const { searchParams } = new URL(request.url)
    const includeComponents = searchParams.get("include") === "components"
    const includeNextCheck = searchParams.get("include") === "next-check"
    const servers = includeComponents
      ? await getServersListWithComponents()
      : includeNextCheck
        ? await getServersListWithNextCheck()
        : await getServersList()
    return jsonOk(servers)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error"
    return jsonError(msg, 500)
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) return jsonError("Unauthorized", 401)

    const schema = z.object({
      hostname: z.string().min(1),
      name: z.string().nullable().optional(),
      ip_address: z.string().nullable().optional(),
      os: z.string().nullable().optional(),
      server_type: z.string().min(1).optional(),
      physical_status: z.enum(["active", "inactive"]).optional(),
      location_id: z.number().int().positive(),
      sort_order: z.number().int().optional(),
    })
    const body = await parseJson(request)
    const parsed = schema.safeParse(body)
    if (!parsed.success) return jsonError(zodErrorToMessage(parsed.error), 400)

    const id = await createServer({
      hostname: parsed.data.hostname.trim(),
      name: parsed.data.name?.trim() ?? null,
      ip_address: parsed.data.ip_address ?? null,
      os: parsed.data.os ?? null,
      server_type: (parsed.data.server_type ?? "general").trim(),
      physical_status: parsed.data.physical_status ?? "active",
      location_id: parsed.data.location_id,
      sort_order: parsed.data.sort_order ?? 0,
    })
    return jsonOk({ id }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error"
    return jsonError(msg, 500)
  }
}
