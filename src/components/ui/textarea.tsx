import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const Textarea = ({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    data-slot="textarea"
    className={cn(
      "flex min-h-28 w-full rounded-[1.1rem] border border-input/80 bg-input/[0.36] px-3.5 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition-[border-color,background-color,box-shadow,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none placeholder:text-muted-foreground/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:bg-background/85 focus-visible:ring-[4px] focus-visible:ring-ring/[0.18]",
      className,
    )}
    {...props}
  />
);

export { Textarea };
