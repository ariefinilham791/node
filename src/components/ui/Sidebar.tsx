"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  RiHomeLine,
  RiCalendarLine,
  RiServerLine,
  RiCpuLine,
  RiMapPinLine,
  RiUserLine,
  RiDownloadLine,
} from "@remixicon/react"
import { cx } from "@/lib/utils"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: RiHomeLine },
  { href: "/monitoring", label: "Weekly Monitoring", icon: RiCalendarLine },
  { href: "/servers", label: "Servers", icon: RiServerLine },
  { href: "/export", label: "Export", icon: RiDownloadLine },
]

const adminOnlyItems = [
  { href: "/component-types", label: "Component Types", icon: RiCpuLine },
  { href: "/locations", label: "Locations", icon: RiMapPinLine },
  { href: "/users", label: "Users", icon: RiUserLine },
]

export function Sidebar() {
  const pathname = usePathname()
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUserRole(data?.user?.role ?? null))
      .catch(() => {})
  }, [])

  const isAdmin = userRole === "admin"

  return (
    <aside className="fixed left-0 top-0 z-10 hidden h-screen md:flex">
      <SidebarContent pathname={pathname} isAdmin={isAdmin} />
    </aside>
  )
}

export function SidebarContent({
  pathname,
  isAdmin,
  onNavigate,
  className,
}: {
  pathname: string
  isAdmin: boolean
  onNavigate?: () => void
  className?: string
}) {
  return (
    <aside
      className={cx(
        "flex h-full w-56 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950",
        className,
      )}
    >
      <div className="flex h-14 items-center border-b border-gray-200 px-4 dark:border-gray-800">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-50">
          <RiServerLine className="size-5 text-blue-500" />
          DC Monitoring
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cx(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              )}
            >
              <Icon className="size-5 shrink-0" />
              {item.label}
            </Link>
          )
        })}
        {isAdmin && (
          <>
            <div className="my-2 border-t border-gray-200 dark:border-gray-800" />
            <p className="px-3 py-1 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Admin
            </p>
            {adminOnlyItems.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href || pathname.startsWith(item.href + "/")
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cx(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  )}
                >
                  <Icon className="size-5 shrink-0" />
                  {item.label}
                </Link>
              )
            })}
          </>
        )}
      </nav>
    </aside>
  )
}
