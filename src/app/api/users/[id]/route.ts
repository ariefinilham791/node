import { hash } from "bcryptjs"
import { getSession } from "@/lib/auth"
import { getUserById } from "@/lib/db"
import { updateUser } from "@/lib/queries"
import { jsonError, jsonOk, parseJson, zodErrorToMessage } from "@/lib/http"
import { z } from "zod"

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  try {
    const session = await getSession()
    if (!session) return jsonError("Unauthorized", 401)
    if (session.role !== "admin") return jsonError("Forbidden", 403)
    const id = Number((await context.params).id)
    if (!id) return jsonError("Invalid id", 400)
    const user = await getUserById(id)
    if (!user) return jsonError("Not found", 404)
    return jsonOk(user)
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
      full_name: z.string().min(1).optional(),
      email: z.string().email().optional().or(z.literal("")),
      role: z.string().optional(),
      location_id: z.number().int().nullable().optional(),
      is_active: z.union([z.number(), z.boolean()]).optional(),
      password: z.string().min(6).optional(),
    })
    const body = await parseJson(request)
    const parsed = schema.safeParse(body)
    if (!parsed.success) return jsonError(zodErrorToMessage(parsed.error), 400)

    const updates: Parameters<typeof updateUser>[1] = {}
    if (parsed.data.full_name !== undefined) updates.full_name = parsed.data.full_name
    if (parsed.data.email !== undefined) updates.email = parsed.data.email
    if (parsed.data.role !== undefined) updates.role = parsed.data.role
    if (parsed.data.location_id !== undefined) updates.location_id = parsed.data.location_id
    if (parsed.data.is_active !== undefined) updates.is_active = Number(parsed.data.is_active)
    if (parsed.data.password !== undefined && parsed.data.password !== "") {
      updates.password_hash = await hash(String(parsed.data.password), 10)
    }
    if (Object.keys(updates).length === 0) return jsonOk({ success: true })

    await updateUser(id, updates)
    return jsonOk({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error"
    return jsonError(msg, 500)
  }
}
