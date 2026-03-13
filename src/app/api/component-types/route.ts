import { getSession } from "@/lib/auth"
import { getComponentTypesList, createComponentType } from "@/lib/queries"
import { jsonError, jsonOk, parseJson, zodErrorToMessage } from "@/lib/http"
import { z } from "zod"

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return jsonError("Unauthorized", 401)
    const list = await getComponentTypesList()
    return jsonOk(list)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error"
    return jsonError(msg, 500)
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) return jsonError("Unauthorized", 401)
    if (session.role !== "admin") return jsonError("Forbidden", 403)

    const schema = z.object({
      name: z.string().min(1),
      category: z.string().optional(),
      icon: z.string().nullable().optional(),
      unit_label: z.string().nullable().optional(),
      sort_order: z.number().int().optional(),
      metric_schema: z.unknown().optional(),
    })

    const body = await parseJson(request)
    const parsed = schema.safeParse(body)
    if (!parsed.success) return jsonError(zodErrorToMessage(parsed.error), 400)

    const id = await createComponentType({
      name: parsed.data.name.trim(),
      category: (parsed.data.category || "general").trim(),
      icon: parsed.data.icon ?? null,
      unit_label: parsed.data.unit_label ?? null,
      sort_order: parsed.data.sort_order ?? 0,
      metric_schema: parsed.data.metric_schema ?? [],
    })
    return jsonOk({ id }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error"
    return jsonError(msg, 500)
  }
}
