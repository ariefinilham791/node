import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getSchedulesList } from "@/lib/queries"

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get("locationId")
    const status = searchParams.get("status")
    const schedules = await getSchedulesList({
      locationId: locationId ? Number(locationId) : undefined,
      status: status ?? undefined,
    })
    return NextResponse.json(schedules)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
