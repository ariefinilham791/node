"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/Button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/Dialog"

type Reminder = {
  schedule_id: number
  location_name: string
  week_number: number
  year: number
  due_date: string
  days_remaining: number
  urgency: string
  status: string
}

export function ReminderPopup() {
  const router = useRouter()
  const [reminder, setReminder] = useState<Reminder | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch("/api/reminder/check")
      .then((r) => r.json())
      .then((data) => {
        if (data.reminder) {
          setReminder(data.reminder)
          setOpen(true)
        }
      })
      .catch(() => {})
  }, [])

  async function handleDismiss() {
    if (!reminder) return
    await fetch("/api/reminder/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schedule_id: reminder.schedule_id }),
    })
    setReminder(null)
    setOpen(false)
  }

  function goToForm() {
    if (!reminder) return
    setOpen(false)
    router.push(`/monitoring/${reminder.schedule_id}`)
  }

  if (!reminder) return null

  const isOverdue = reminder.urgency === "OVERDUE"
  const dueDateStr = new Date(reminder.due_date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  const statusLine =
    reminder.days_remaining < 0
      ? "OVERDUE"
      : reminder.days_remaining === 0
        ? "TODAY"
        : `${reminder.days_remaining} days remaining`

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle
            className={isOverdue ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}
          >
            {isOverdue ? "🔴 Monitoring Overdue" : "⚠️ Monitoring Due Soon"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <p>
            Weekly monitoring for <strong>{reminder.location_name}</strong> (Week {reminder.week_number}, {reminder.year}) is due on <strong>{dueDateStr}</strong>. {statusLine}.
          </p>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={handleDismiss}>
            Dismiss
          </Button>
          <Button onClick={goToForm}>Go to Monitoring Form</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
