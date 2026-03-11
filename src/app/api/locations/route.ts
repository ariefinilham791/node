import { getSession } from "@/lib/auth"
import { getLocationsList, getLocationsListAll, createLocation } from "@/lib/queries"
import { jsonError, jsonOk, parseJson, zodErrorToMessage } from "@/lib/http"
import { z } from "zod"

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session) return jsonError("Unauthorized", 401)

    const { searchParams } = new URL(request.url)
    const all = searchParams.get("all") === "1"
    const locations =
      all && session.role === "admin"
        ? await getLocationsListAll()
        : await getLocationsList()
    return jsonOk(locations)
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
      address: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
    })
    const body = await parseJson(request)
    const parsed = schema.safeParse(body)
    if (!parsed.success) return jsonError(zodErrorToMessage(parsed.error), 400)

    const id = await createLocation({
      name: parsed.data.name.trim(),
      address: parsed.data.address ?? null,
      description: parsed.data.description ?? null,
    })
    return jsonOk(
      {
        id,
        name: parsed.data.name.trim(),
        address: parsed.data.address ?? null,
        description: parsed.data.description ?? null,
      },
      { status: 201 },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error"
    return jsonError(msg, 500)
  }
}
