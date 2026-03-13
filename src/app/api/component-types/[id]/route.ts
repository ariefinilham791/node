import { getSession } from "@/lib/auth"
import { getComponentTypeById, updateComponentType, deleteComponentType, hardDeleteComponentType } from "@/lib/queries"
import { jsonError, jsonOk, parseJson, zodErrorToMessage } from "@/lib/http"
import { z } from "zod"

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  try {
    const session = await getSession()
    if (!session) return jsonError("Unauthorized", 401)
    const id = Number((await context.params).id)
    if (!id) return jsonError("Invalid id", 400)
    const row = await getComponentTypeById(id)
    if (!row) return jsonError("Not found", 404)
    return jsonOk(row)
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

    const schema = z.object({
      name: z.string().min(1),
      category: z.string().optional(),
      icon: z.string().nullable().optional(),
      unit_label: z.string().nullable().optional(),
      sort_order: z.number().int().optional(),
      metric_schema: z.unknown().optional(),
      is_active: z.union([z.number(), z.boolean()]).optional(),
    })
    const body = await parseJson(request)
    const parsed = schema.safeParse(body)
    if (!parsed.success) return jsonError(zodErrorToMessage(parsed.error), 400)

    await updateComponentType(id, {
      name: parsed.data.name.trim(),
      category: (parsed.data.category || "general").trim(),
      icon: parsed.data.icon ?? null,
      unit_label: parsed.data.unit_label ?? null,
      sort_order: parsed.data.sort_order ?? 0,
      metric_schema: parsed.data.metric_schema ?? [],
      is_active:
        parsed.data.is_active !== undefined
          ? Number(parsed.data.is_active)
          : undefined,
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
      await hardDeleteComponentType(id)
    } else {
      await deleteComponentType(id)
    }
    return jsonOk({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error"
    return jsonError(msg, 500)
  }
}
