import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 py-1 text-[0.68rem] font-semibold whitespace-nowrap uppercase tracking-[0.14em] transition-[background-color,border-color,color,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "border-primary/20 bg-primary/[0.14] text-primary [a&]:hover:bg-primary/20",
        secondary:
          "border-border/60 bg-secondary/[0.86] text-secondary-foreground [a&]:hover:bg-secondary",
        destructive:
          "border-destructive/20 bg-destructive/[0.12] text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/[0.18] dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/[0.16]",
        outline:
          "border-border/80 bg-background/55 text-foreground [a&]:hover:border-primary/24 [a&]:hover:bg-accent/78 [a&]:hover:text-foreground",
        ghost:
          "bg-transparent text-muted-foreground [a&]:hover:bg-accent/70 [a&]:hover:text-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
