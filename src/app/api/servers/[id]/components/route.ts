import { getSession } from "@/lib/auth"
import { createServerComponent } from "@/lib/queries"
import { jsonError, jsonOk, parseJson, zodErrorToMessage } from "@/lib/http"
import { z } from "zod"

type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: Context) {
  try {
    const session = await getSession()
    if (!session) return jsonError("Unauthorized", 401)

    const serverId = Number((await context.params).id)
    if (!serverId) return jsonError("Invalid server id", 400)

    const schema = z.object({
      component_type_id: z.number().int().positive(),
      label: z.string().min(1),
      slot_index: z.number().int().optional(),
      specs: z.record(z.unknown()).nullable().optional(),
    })
    const body = await parseJson(request)
    const parsed = schema.safeParse(body)
    if (!parsed.success) return jsonError(zodErrorToMessage(parsed.error), 400)

    const id = await createServerComponent({
      server_id: serverId,
      component_type_id: parsed.data.component_type_id,
      label: parsed.data.label.trim(),
      slot_index: parsed.data.slot_index ?? 0,
      specs: parsed.data.specs ?? null,
    })
    return jsonOk({ id }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error"
    return jsonError(msg, 500)
  }
}
