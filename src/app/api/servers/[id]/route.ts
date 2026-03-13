import { getSession } from "@/lib/auth"
import {
  deactivateServer,
  hardDeleteServer,
  getServerById,
  getServerComponentsWithTypeId,
  getServerLatestSnapshot,
  getServerLatestComponentReadings,
  updateServer,
} from "@/lib/queries"
import { jsonError, jsonOk, parseJson, zodErrorToMessage } from "@/lib/http"
import { z } from "zod"

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  try {
    const session = await getSession()
    if (!session) return jsonError("Unauthorized", 401)
    const id = Number((await context.params).id)
    if (!id) return jsonError("Invalid id", 400)
    const server = await getServerById(id)
    if (!server) return jsonError("Not found", 404)
    const components = await getServerComponentsWithTypeId(id)
    const latestSnapshot = await getServerLatestSnapshot(id)
    const componentReadings = await getServerLatestComponentReadings(id)
    return jsonOk({
      server,
      components,
      latestSnapshot,
      componentReadings,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error"
    return jsonError(msg, 500)
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    const session = await getSession()
    if (!session) return jsonError("Unauthorized", 401)
    if (session.role !== "admin") return jsonError("Forbidden", 403)
    const id = Number((await context.params).id)
    if (!id) return jsonError("Invalid id", 400)

    const schema = z
      .object({
        hostname: z.string().min(1).optional(),
        name: z.string().nullable().optional(),
        ip_address: z.string().nullable().optional(),
        os: z.string().nullable().optional(),
        server_type: z.string().min(1).optional(),
        physical_status: z.enum(["active", "inactive"]).optional(),
        location_id: z.number().int().positive().optional(),
        sort_order: z.number().int().optional(),
      })
      .refine((v) => Object.keys(v).length > 0, { message: "No updates" })
    const body = await parseJson(request)
    const parsed = schema.safeParse(body)
    if (!parsed.success) return jsonError(zodErrorToMessage(parsed.error), 400)

    await updateServer(id, {
      hostname: parsed.data.hostname,
      name: parsed.data.name,
      ip_address: parsed.data.ip_address,
      os: parsed.data.os,
      server_type: parsed.data.server_type,
      physical_status: parsed.data.physical_status,
      location_id: parsed.data.location_id,
      sort_order: parsed.data.sort_order,
    })
    return jsonOk({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error"
    return jsonError(msg, 500)
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const session = await getSession()
    if (!session) return jsonError("Unauthorized", 401)
    if (session.role !== "admin") return jsonError("Forbidden", 403)
    const id = Number((await context.params).id)
    if (!id) return jsonError("Invalid id", 400)
    const { searchParams } = new URL(request.url)
    const hard = searchParams.get("hard") === "1"
    if (hard) {
      await hardDeleteServer(id)
    } else {
      await deactivateServer(id)
    }
    return jsonOk({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error"
    return jsonError(msg, 500)
  }
}
