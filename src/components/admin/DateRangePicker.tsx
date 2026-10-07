import { CalendarRange } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  type CalendarDateRange,
} from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DateRangeValue = {
  from: string;
  to: string;
};

type DateRangePickerProps = {
  className?: string;
  description?: string;
  title?: string;
  onChange: (value: DateRangeValue) => void;
  value: DateRangeValue;
};

const formatDateInputValue = (value: Date): string => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateInputValue = (value: string): Date | undefined => {
  if (!value) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return undefined;
  }

  return new Date(year, month - 1, day, 12);
};

const formatRangeLabel = (value: DateRangeValue): string => {
  const from = parseDateInputValue(value.from);
  const to = parseDateInputValue(value.to);
  if (!from || !to) {
    return "Pick a date range";
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: from.getFullYear() === to.getFullYear() ? undefined : "numeric",
  });
  const fromLabel = formatter.format(from);
  const toLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(to);

  return `${fromLabel} - ${toLabel}`;
};

export const DateRangePicker = ({
  className,
  description = "Choose the date range for dashboard metrics and review queues.",
  onChange,
  title = "Overview window",
  value,
}: DateRangePickerProps) => {
  const [open, setOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<CalendarDateRange>({
    from: parseDateInputValue(value.from),
    to: parseDateInputValue(value.to),
  });

  useEffect(() => {
    if (!open) {
      setDraftRange({
        from: parseDateInputValue(value.from),
        to: parseDateInputValue(value.to),
      });
    }
  }, [open, value.from, value.to]);

  const hasCompleteRange = !!draftRange.from && !!draftRange.to;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-10 min-w-[248px] justify-start rounded-xl border-border/70 bg-background/72 px-3 text-left font-normal",
            !value.from && "text-muted-foreground",
            className,
          )}
        >
          <CalendarRange className="size-4 text-muted-foreground" />
          <span className="truncate">{formatRangeLabel(value)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-3">
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-[0.66rem] uppercase tracking-[0.18em] text-muted-foreground">
              {title}
            </p>
            <p className="text-sm text-foreground">
              {description}
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/52 p-2">
            <Calendar
              mode="range"
              numberOfMonths={2}
              selected={draftRange}
              onSelect={(next) => setDraftRange(next ?? {})}
            />
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
            <div className="text-xs text-muted-foreground">
              {hasCompleteRange
                ? formatRangeLabel({
                    from: formatDateInputValue(draftRange.from!),
                    to: formatDateInputValue(draftRange.to!),
                  })
                : "Select a start and end date."}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraftRange({
                    from: parseDateInputValue(value.from),
                    to: parseDateInputValue(value.to),
                  });
                  setOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!hasCompleteRange}
                onClick={() => {
                  if (!draftRange.from || !draftRange.to) {
                    return;
                  }

                  onChange({
                    from: formatDateInputValue(draftRange.from),
                    to: formatDateInputValue(draftRange.to),
                  });
                  setOpen(false);
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
