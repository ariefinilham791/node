export type ApiEnvelope<T> = { data: T | null; error: string | null }

export class ApiClientError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = "ApiClientError"
    this.status = status
  }
}

async function parseEnvelope<T>(res: Response): Promise<ApiEnvelope<T> | null> {
  try {
    return (await res.json()) as ApiEnvelope<T>
  } catch {
    return null
  }
}

export async function apiFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, init)
  const env = await parseEnvelope<T>(res)

  if (!res.ok) {
    const message =
      env?.error ||
      (typeof (env as any)?.message === "string" && (env as any).message) ||
      res.statusText ||
      "Request failed"
    throw new ApiClientError(message, res.status)
  }

  if (env && "data" in env) {
    if (env.error) throw new ApiClientError(env.error, res.status)
    return env.data as T
  }

  // Fallback for endpoints that don't use the envelope (legacy)
  return (env as unknown as T) ?? (null as unknown as T)
}

export async function apiGet<T>(url: string): Promise<T> {
  return apiFetch<T>(url, { method: "GET" })
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export async function apiPut<T>(url: string, body?: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export async function apiDelete<T>(url: string): Promise<T> {
  return apiFetch<T>(url, { method: "DELETE" })
}

