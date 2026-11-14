import { Loader2Icon } from "lucide-react"
import { cn } from "cn"

function Spinner({ className, ...props }: React.ComponentProps<typeof Loader2Icon>) {
  return <Loader2Icon aria-hidden="true" className={cn("size-4 animate-spin motion-reduce:animate-none", className)} {...props} />
}

export { Spinner }