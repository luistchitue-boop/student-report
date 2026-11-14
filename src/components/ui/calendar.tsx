"use client"

import * as React from "react"
import { DayPicker, type DayPickerProps } from "react-day-picker"
import { pt } from "react-day-picker/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "cn"
import { buttonVariants } from "@/components/ui/button"

function Calendar({ className, classNames, components, locale = pt, ...props }: DayPickerProps) {
  return (
    <DayPicker
      showOutsideDays
      locale={locale}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col gap-4",
        month: "flex flex-col gap-4",
        month_caption: "relative flex items-center justify-center pt-1",
        caption_label: "text-sm font-medium",
        nav: "flex items-center gap-1",
        button_previous: buttonVariants({ variant: "outline", size: "icon", className: "size-7 bg-transparent p-0 opacity-60 hover:opacity-100" }),
        button_next: buttonVariants({ variant: "outline", size: "icon", className: "size-7 bg-transparent p-0 opacity-60 hover:opacity-100" }),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-8 rounded-md text-center text-[0.8rem] font-normal text-muted-foreground",
        weeks: "flex flex-col",
        week: "mt-2 flex w-full",
        day: "relative size-8 p-0 text-center text-sm focus-within:z-20",
        day_button: buttonVariants({ variant: "ghost", size: "icon", className: "size-8 p-0 font-normal aria-selected:opacity-100" }),
        selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        range_start: "rounded-l-md bg-accent",
        range_end: "rounded-r-md bg-accent",
        today: "bg-accent text-accent-foreground",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-50",
        range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName, ...chevronProps }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("size-4", chevronClassName)} {...chevronProps} />
          ) : (
            <ChevronRight className={cn("size-4", chevronClassName)} {...chevronProps} />
          ),
        ...components,
      }}
      {...props}
    />
  )
}

export { Calendar }
