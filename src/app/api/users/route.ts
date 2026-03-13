import { hash } from "bcryptjs"
import { getSession } from "@/lib/auth"
import { getUsersByRole, getUsersList, createUser } from "@/lib/queries"
import { jsonError, jsonOk, parseJson, zodErrorToMessage } from "@/lib/http"
import { z } from "zod"

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session) return jsonError("Unauthorized", 401)

    const { searchParams } = new URL(request.url)
    const list = searchParams.get("list") === "1"
    if (list) {
      const users = await getUsersList()
      return jsonOk(users)
    }

    const role = searchParams.get("role")
    const roles = role ? [role] : ["supervisor", "dept_head"]
    const users = await getUsersByRole(roles)
    return jsonOk(users)
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
      username: z.string().min(1),
      full_name: z.string().min(1),
      email: z.string().email().optional().or(z.literal("")),
      password: z.string().min(6),
      role: z.string().optional(),
      location_id: z.number().int().nullable().optional(),
    })
    const body = await parseJson(request)
    const parsed = schema.safeParse(body)
    if (!parsed.success) return jsonError(zodErrorToMessage(parsed.error), 400)

    const password_hash = await hash(parsed.data.password, 10)
    const id = await createUser({
      username: parsed.data.username.trim(),
      full_name: parsed.data.full_name.trim(),
      email: (parsed.data.email ?? "").trim(),
      password_hash,
      role: (parsed.data.role || "technician").trim(),
      location_id: parsed.data.location_id ?? null,
    })
    return jsonOk(
      {
        id,
        username: parsed.data.username.trim(),
        full_name: parsed.data.full_name.trim(),
        email: (parsed.data.email ?? "").trim(),
        role: (parsed.data.role || "technician").trim(),
        location_id: parsed.data.location_id ?? null,
      },
      { status: 201 },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error"
    return jsonError(msg, 500)
  }
}
