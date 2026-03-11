"use client"

import { RiLoader2Fill } from "@remixicon/react"
import { cx } from "@/lib/utils"

export function Spinner({
  className,
  label = "Loading",
}: {
  className?: string
  label?: string
}) {
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <RiLoader2Fill className="size-4 animate-spin" aria-hidden="true" />
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
    </span>
  )
}

export function SkeletonBlock({
  className,
}: {
  className?: string
}) {
  return (
    <div
      className={cx(
        "animate-pulse rounded-md bg-gray-100 dark:bg-gray-900/40",
        className,
      )}
    />
  )
}

export function SkeletonLines({
  count = 6,
  rowClassName = "h-10 w-full",
}: {
  count?: number
  rowClassName?: string
}) {
  return (
    <div className="space-y-2 py-2">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBlock key={i} className={rowClassName} />
      ))}
    </div>
  )
}

