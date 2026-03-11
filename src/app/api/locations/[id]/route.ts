import { getSession } from "@/lib/auth"
import { getLocationById, updateLocation, deleteLocation, hardDeleteLocation } from "@/lib/queries"
import { jsonError, jsonOk, parseJson, zodErrorToMessage } from "@/lib/http"
import { z } from "zod"

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  try {
    const session = await getSession()
    if (!session) return jsonError("Unauthorized", 401)
    const id = Number((await context.params).id)
    if (!id) return jsonError("Invalid id", 400)
    const loc = await getLocationById(id)
    if (!loc) return jsonError("Not found", 404)
    return jsonOk(loc)
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
      address: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      is_active: z.union([z.number(), z.boolean()]).optional(),
    })
    const body = await parseJson(request)
    const parsed = schema.safeParse(body)
    if (!parsed.success) return jsonError(zodErrorToMessage(parsed.error), 400)

    await updateLocation(id, {
      name: parsed.data.name.trim(),
      address: parsed.data.address ?? null,
      description: parsed.data.description ?? null,
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
      await hardDeleteLocation(id)
    } else {
      await deleteLocation(id)
    }
    return jsonOk({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error"
    return jsonError(msg, 500)
  }
}
