"use client"

import { useEffect, useMemo, useState } from "react"
import { getToastEventName, type ToastKind, type ToastPayload } from "@/lib/toast"
import { cx } from "@/lib/utils"

export function AppToaster() {
  const [items, setItems] = useState<
    Array<{ id: string; kind: ToastKind; message: string }>
  >([])

  const eventName = useMemo(() => getToastEventName(), [])

  useEffect(() => {
    function onToast(ev: Event) {
      const detail = (ev as CustomEvent<ToastPayload>).detail
      if (!detail?.message) return
      const id = detail.id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
      setItems((prev) => [...prev, { id, kind: detail.kind, message: detail.message }])
      const duration = detail.durationMs ?? 3000
      window.setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id))
      }, duration)
    }
    window.addEventListener(eventName, onToast)
    return () => window.removeEventListener(eventName, onToast)
  }, [eventName])

  return (
    <div className="fixed right-4 top-4 z-[100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={cx(
            "rounded-md border px-3 py-2 text-sm shadow-sm",
            "bg-white text-gray-900 border-gray-200",
            "dark:bg-[#090E1A] dark:text-gray-50 dark:border-gray-800",
            t.kind === "success" &&
              "border-emerald-200 dark:border-emerald-900/60",
            t.kind === "error" && "border-red-200 dark:border-red-900/60",
            t.kind === "info" && "border-blue-200 dark:border-blue-900/60",
          )}
        >
          <p className="font-medium">
            {t.kind === "success"
              ? "Success"
              : t.kind === "error"
                ? "Error"
                : "Info"}
          </p>
          <p className="mt-0.5 text-gray-600 dark:text-gray-400">{t.message}</p>
        </div>
      ))}
    </div>
  )
}

