import { DashboardShell } from "@/components/ui/DashboardShell"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <DashboardShell>{children}</DashboardShell>
}
