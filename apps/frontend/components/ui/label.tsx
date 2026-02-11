import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cn } from "@/lib/utils"

// Needs @radix-ui/react-label but user has @radix-ui/react-dialog etc.
// Assuming it's installed or we can use basic version if not.
// Let's assume basic span for now to avoid dependency errors if not installed.
// ACTUALLY, checking package.json earlier, it wasn't listed.
// Safe fallback: standard label.

const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground/80 mb-2 block",
      className
    )}
    {...props}
  />
))
Label.displayName = "Label"

export { Label }
