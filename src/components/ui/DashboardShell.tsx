"use client"

import { Sidebar, SidebarContent } from "./Sidebar"
import { DropdownUserProfile } from "./UserProfile"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/Drawer"
import { Button } from "@/components/Button"
import { useState } from "react"
import { RiMenuLine } from "@remixicon/react"
import { usePathname } from "next/navigation"

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar />
      <div className="md:pl-56">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-gray-200 bg-white px-4 md:px-6 dark:border-gray-800 dark:bg-gray-950">
          <div className="flex items-center gap-2 md:hidden">
            <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
              <DrawerTrigger asChild>
                <Button variant="secondary" className="aspect-square p-2">
                  <RiMenuLine className="size-5" aria-hidden="true" />
                </Button>
              </DrawerTrigger>
              <DrawerContent className="max-w-[18rem] sm:max-w-sm">
                <DrawerHeader>
                  <DrawerTitle>Menu</DrawerTitle>
                </DrawerHeader>
                <SidebarContent
                  pathname={pathname}
                  onNavigate={() => setDrawerOpen(false)}
                  className="w-full border-r-0"
                />
              </DrawerContent>
            </Drawer>
          </div>
          <div className="ml-auto flex items-center">
            <DropdownUserProfile />
          </div>
        </header>
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
