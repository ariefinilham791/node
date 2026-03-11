export type ToastKind = "success" | "error" | "info"

export type ToastPayload = {
  kind: ToastKind
  message: string
  id?: string
  durationMs?: number
}

const EVENT_NAME = "app-toast"

function emit(payload: ToastPayload) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload }))
}

export const toast = {
  success(message: string, opts?: Omit<ToastPayload, "kind" | "message">) {
    emit({ kind: "success", message, ...opts })
  },
  error(message: string, opts?: Omit<ToastPayload, "kind" | "message">) {
    emit({ kind: "error", message, ...opts })
  },
  info(message: string, opts?: Omit<ToastPayload, "kind" | "message">) {
    emit({ kind: "info", message, ...opts })
  },
}

export function getToastEventName() {
  return EVENT_NAME
}

