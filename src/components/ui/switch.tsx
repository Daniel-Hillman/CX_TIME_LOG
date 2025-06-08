"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    aria-label={props['aria-label']}
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      // Checked state (Green)
      "data-[state=checked]:bg-green-500",        // Using direct Tailwind green
      "data-[state=checked]:border-green-600",    // Using direct Tailwind darker green for border
      // Unchecked state
      "data-[state=unchecked]:bg-slate-200",      // Light mode: light gray track
      "data-[state=unchecked]:border-slate-300",  // Light mode: slightly darker gray border
      "dark:data-[state=unchecked]:bg-slate-700", // Dark mode: medium-dark gray track
      "dark:data-[state=unchecked]:border-slate-600",// Dark mode: slightly distinct border
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
        "bg-slate-600 dark:bg-white" // Light mode: dark gray thumb. Dark mode: white thumb.
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
