import { getSession } from "@/lib/auth"
import { updateServerComponent, deleteServerComponent } from "@/lib/queries"
import { jsonError, jsonOk, parseJson, zodErrorToMessage } from "@/lib/http"
import { z } from "zod"

type Context = { params: Promise<{ id: string; cid: string }> }

export async function PUT(request: Request, context: Context) {
  try {
    const session = await getSession()
    if (!session) return jsonError("Unauthorized", 401)
    const cid = Number((await context.params).cid)
    if (!cid) return jsonError("Invalid component id", 400)

    const schema = z
      .object({
        label: z.string().min(1).optional(),
        slot_index: z.number().int().optional(),
        specs: z.record(z.unknown()).nullable().optional(),
      })
      .refine((v) => Object.keys(v).length > 0, { message: "No updates" })
    const body = await parseJson(request)
    const parsed = schema.safeParse(body)
    if (!parsed.success) return jsonError(zodErrorToMessage(parsed.error), 400)

    await updateServerComponent(cid, parsed.data)
    return jsonOk({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error"
    return jsonError(msg, 500)
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const session = await getSession()
    if (!session) return jsonError("Unauthorized", 401)
    const cid = Number((await context.params).cid)
    if (!cid) return jsonError("Invalid component id", 400)
    await deleteServerComponent(cid)
    return jsonOk({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error"
    return jsonError(msg, 500)
  }
}
