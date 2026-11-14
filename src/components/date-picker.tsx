"use client"

import { useState } from "react"
import { format } from "date-fns"
import { pt } from "date-fns/locale"
import { CalendarDays } from "lucide-react"
import type { DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type DateRangePickerProps = {
  id: string
  fromName: string
  toName: string
  defaultFrom?: string
  defaultTo?: string
  placeholder: string
}

function parseDate(value?: string) {
  if (!value) return undefined
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return undefined
  const date = new Date(year, month - 1, day, 12)
  if (Number.isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return undefined
  }
  return date
}

function toDateInputValue(date?: Date) {
  if (!date) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function DateRangePicker({ id, fromName, toName, defaultFrom, defaultTo, placeholder }: DateRangePickerProps) {
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(() => {
    const from = parseDate(defaultFrom)
    const to = parseDate(defaultTo)
    return from || to ? { from, to } : undefined
  })
  const [open, setOpen] = useState(false)

  function selectRange(range: DateRange | undefined) {
    setSelectedRange(range)
    if (range?.from && range.to) setOpen(false)
  }

  const label = selectedRange?.from && selectedRange.to
    ? `${format(selectedRange.from, "P", { locale: pt })} – ${format(selectedRange.to, "P", { locale: pt })}`
    : selectedRange?.from
      ? `Desde ${format(selectedRange.from, "P", { locale: pt })} – selecione o fim`
      : selectedRange?.to
        ? `Até ${format(selectedRange.to, "P", { locale: pt })}`
        : placeholder;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              className="h-10 w-full justify-start gap-2 overflow-hidden text-left font-normal"
              aria-label={label}
            />
          }
        >
          <CalendarDays className="text-muted-foreground" />
          <span className="truncate">{label}</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar mode="range" selected={selectedRange} onSelect={selectRange} defaultMonth={selectedRange?.from ?? selectedRange?.to} />
        </PopoverContent>
      </Popover>
      <input type="hidden" name={fromName} value={toDateInputValue(selectedRange?.from)} />
      <input type="hidden" name={toName} value={toDateInputValue(selectedRange?.to)} />
    </>
  )
}
