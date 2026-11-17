import * as React from "react"
import { cn } from "cn"

type ProgressProps = React.ComponentProps<"div"> & {
  value?: number
  max?: number
}

function Progress({ className, value = 0, max = 100, ...props }: ProgressProps) {
  const safeMax = max > 0 ? max : 100
  const percentage = Math.min(safeMax, Math.max(0, value)) / safeMax * 100

  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={Math.min(safeMax, Math.max(0, value))}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-primary/15", className)}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className="h-full rounded-full bg-primary transition-[width] dark:bg-chart-1"
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}

export { Progress }
