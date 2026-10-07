import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CalendarDateRange = {
  from?: Date;
  to?: Date;
};

type CalendarProps = {
  className?: string;
  disabled?: (date: Date) => boolean;
  mode: "range";
  numberOfMonths?: number;
  onSelect?: (value: CalendarDateRange | undefined) => void;
  selected?: CalendarDateRange;
};

const weekdayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const startOfDay = (value: Date): Date =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate());

const addDays = (value: Date, amount: number): Date => {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return startOfDay(next);
};

const addMonths = (value: Date, amount: number): Date =>
  new Date(value.getFullYear(), value.getMonth() + amount, 1);

const startOfMonth = (value: Date): Date =>
  new Date(value.getFullYear(), value.getMonth(), 1);

const isSameDay = (left?: Date, right?: Date): boolean =>
  !!left &&
  !!right &&
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const isBeforeDay = (left: Date, right: Date): boolean =>
  startOfDay(left).getTime() < startOfDay(right).getTime();

const isWithinRange = (value: Date, range?: CalendarDateRange): boolean => {
  if (!range?.from || !range.to) {
    return false;
  }

  const target = startOfDay(value).getTime();
  return (
    target > startOfDay(range.from).getTime() &&
    target < startOfDay(range.to).getTime()
  );
};

const buildMonthGrid = (month: Date): Date[][] => {
  const firstVisibleDay = addDays(startOfMonth(month), -startOfMonth(month).getDay());
  return Array.from({ length: 6 }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) =>
      addDays(firstVisibleDay, weekIndex * 7 + dayIndex),
    ),
  );
};

const getNextRange = (
  current: CalendarDateRange | undefined,
  selectedDay: Date,
): CalendarDateRange => {
  if (!current?.from || current.to) {
    return { from: selectedDay, to: undefined };
  }

  if (isBeforeDay(selectedDay, current.from)) {
    return { from: selectedDay, to: current.from };
  }

  return { from: current.from, to: selectedDay };
};

export const Calendar = ({
  className,
  disabled,
  mode,
  numberOfMonths = 1,
  onSelect,
  selected,
}: CalendarProps) => {
  const [month, setMonth] = useState<Date>(() => startOfMonth(selected?.from ?? new Date()));

  useEffect(() => {
    if (selected?.from) {
      setMonth(startOfMonth(selected.from));
    }
  }, [selected?.from]);

  if (mode !== "range") {
    return null;
  }

  const months = Array.from({ length: numberOfMonths }, (_, index) =>
    addMonths(month, index),
  );

  return (
    <div className={cn("grid gap-4", className)}>
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setMonth((current) => addMonths(current, -1))}
        >
          <ChevronLeft className="size-4" />
          <span className="sr-only">Previous month</span>
        </Button>
        <div className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Select range
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setMonth((current) => addMonths(current, 1))}
        >
          <ChevronRight className="size-4" />
          <span className="sr-only">Next month</span>
        </Button>
      </div>

      <div
        className={cn(
          "grid gap-4",
          numberOfMonths > 1 && "md:grid-cols-2",
        )}
      >
        {months.map((visibleMonth) => (
          <div key={`${visibleMonth.getFullYear()}-${visibleMonth.getMonth()}`} className="space-y-3">
            <div className="text-center text-sm font-medium text-foreground">
              {monthFormatter.format(visibleMonth)}
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">
              {Array.from({ length: 7 }, (_, dayIndex) => (
                <span key={dayIndex}>
                  {weekdayFormatter.format(addDays(new Date(2026, 0, 4), dayIndex)).slice(0, 2)}
                </span>
              ))}
            </div>

            <div className="grid gap-1">
              {buildMonthGrid(visibleMonth).map((week, weekIndex) => (
                <div key={weekIndex} className="grid grid-cols-7 gap-1">
                  {week.map((day) => {
                    const isOutsideMonth = day.getMonth() !== visibleMonth.getMonth();
                    const isDisabled = disabled?.(day) ?? false;
                    const isRangeStart = isSameDay(day, selected?.from);
                    const isRangeEnd = isSameDay(day, selected?.to);
                    const isSelected = isRangeStart || isRangeEnd;
                    const isInRange = isWithinRange(day, selected);

                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        disabled={isDisabled}
                        aria-selected={isSelected || isInRange}
                        className={cn(
                          "flex aspect-square items-center justify-center rounded-xl text-sm transition-[background-color,color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] outline-hidden",
                          "focus-visible:ring-2 focus-visible:ring-ring/50",
                          isOutsideMonth
                            ? "text-muted-foreground/45"
                            : "text-foreground/88",
                          isDisabled && "pointer-events-none opacity-25",
                          isInRange &&
                            "rounded-none bg-primary/[0.12] text-foreground first:rounded-l-xl last:rounded-r-xl",
                          isSelected &&
                            "bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_96%,white_4%),color-mix(in_oklab,var(--primary)_72%,black_28%))] font-medium text-primary-foreground shadow-[0_10px_24px_rgba(34,92,67,0.26)]",
                          !isInRange &&
                            !isSelected &&
                            "hover:bg-white/[0.06] hover:text-foreground",
                        )}
                        onClick={() => onSelect?.(getNextRange(selected, day))}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
