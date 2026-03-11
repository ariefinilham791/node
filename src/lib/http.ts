import { NextResponse } from "next/server"
import { z } from "zod"

export type ApiOk<T> = { data: T; error: null }
export type ApiErr = { data: null; error: string }
export type ApiResult<T> = ApiOk<T> | ApiErr

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data, error: null } satisfies ApiOk<T>, init)
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json(
    { data: null, error: message } satisfies ApiErr,
    { status },
  )
}

export function zodErrorToMessage(err: z.ZodError) {
  const first = err.issues?.[0]
  if (!first) return "Invalid request"
  const path = first.path?.length ? first.path.join(".") : undefined
  return path ? `${path}: ${first.message}` : first.message
}

export async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

