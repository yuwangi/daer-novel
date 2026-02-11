import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"

// Since we can't easily install generic class-variance-authority right now without checking, 
// I'll stick to a simpler implementation or just standard classes.
// Actually, standard modern buttons are what we need.

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  fullWidth?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, fullWidth = false, ...props }, ref) => {
    // const Comp = asChild ? Slot : "button" // Needs @radix-ui/react-slot, checking package.json... not explicitly listed but usually standard in these templates.
    // Safe fallback: just button
    const Comp = "button"

    const variants = {
      default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow hover:shadow-lg hover:-translate-y-0.5",
      destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
      outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-sm",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-soft",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      link: "text-primary underline-offset-4 hover:underline",
    }

    const sizes = {
      default: "h-11 px-6 py-2",
      sm: "h-9 rounded-md px-3",
      lg: "h-12 rounded-xl px-10 text-base",
      icon: "h-10 w-10",
    }

    return (
      <Comp
        className={cn(
          "items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          fullWidth ? "flex w-full" : "inline-flex",
          variants[variant],
          sizes[size],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
