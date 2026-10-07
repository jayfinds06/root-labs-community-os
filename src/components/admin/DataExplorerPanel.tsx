import { ChevronDown, ChevronUp, Database, Filter, Rows3, Search, SlidersHorizontal } from "lucide-react";
import { memo, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { DateRangePicker } from "@/components/admin/DateRangePicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  fetchExplorerDetail,
  fetchExplorerList,
  fetchExplorerResources,
  type ExplorerDetailResponse,
  type ExplorerListResponse,
  type ExplorerResourceDefinition,
  type ExplorerResourceKey,
  type ExplorerValue,
  type ExplorerResourcesResponse,
} from "../../utils/api";

type ResourceState = {
  draftQuery: string;
  draftFilters: Record<string, string>;
  appliedQuery: string;
  appliedFilters: Record<string, string>;
  cursor: string | null;
  cursorStack: string[];
  data: ExplorerListResponse | null;
  loading: boolean;
  error: string;
  selectedRowId: string | null;
  selectedRow: ExplorerDetailResponse["item"] | null;
  loadingDetail: boolean;
};

type ExplorerInitialState = {
  resource?: ExplorerResourceKey;
  rowId?: string;
  query?: string;
  filters?: Record<string, string>;
};

const DEFAULT_LIMIT = 50;
const ROOT_CURSOR = "__root__";
const ALL_FILTER_VALUE = "__all__";
const MAX_VISIBLE_COLUMNS = 5;

const createResourceState = (initial?: {
  query?: string;
  filters?: Record<string, string>;
}): ResourceState => ({
  draftQuery: initial?.query ?? "",
  draftFilters: initial?.filters ?? {},
  appliedQuery: initial?.query ?? "",
  appliedFilters: initial?.filters ?? {},
  cursor: null,
  cursorStack: [],
  data: null,
  loading: false,
  error: "",
  selectedRowId: null,
  selectedRow: null,
  loadingDetail: false,
});

const formatDateTime = (value: number | null): string => {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatRelativeDateTime = (value: number | null): string => {
  if (!value) return "";

  const diffMs = value - Date.now();
  const absDiffMs = Math.abs(diffMs);
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (absDiffMs < hourMs) {
    const minutes = Math.max(1, Math.round(absDiffMs / minuteMs));
    return `${minutes}m ${diffMs >= 0 ? "from now" : "ago"}`;
  }

  if (absDiffMs < dayMs) {
    const hours = Math.max(1, Math.round(absDiffMs / hourMs));
    return `${hours}h ${diffMs >= 0 ? "from now" : "ago"}`;
  }

  const days = Math.max(1, Math.round(absDiffMs / dayMs));
  return `${days}d ${diffMs >= 0 ? "from now" : "ago"}`;
};

const formatValue = (value: ExplorerValue): string => {
  if (value === null) return "-";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1);
  }
  if (value.length > 160) return `${value.slice(0, 157)}...`;
  return value;
};

const formatLabel = (value: string): string => {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());
};

const isLongValue = (value: ExplorerValue): boolean => {
  return typeof value === "string" && value.length > 72;
};

const isTimestampField = (key: string, value: ExplorerValue): boolean => {
  return (
    typeof value === "number" &&
    (key.endsWith("At") || key.endsWith("Start") || value > 1_000_000_000_000)
  );
};

const isNumericIdField = (key: string): boolean => {
  return key === "id" || key.endsWith("Id");
};

const isUrlField = (key: string, value: ExplorerValue): boolean => {
  return (
    typeof value === "string" &&
    (key.toLowerCase().includes("url") ||
      value.startsWith("http://") ||
      value.startsWith("https://"))
  );
};

const renderTableValue = (key: string, value: ExplorerValue): ReactNode => {
  if (isTimestampField(key, value)) {
    return (
      <div className="grid gap-0.5">
        <span className="whitespace-nowrap text-sm text-foreground/88">
          {formatDateTime(value)}
        </span>
        <span className="text-[0.72rem] text-muted-foreground">
          {formatRelativeDateTime(value)}
        </span>
      </div>
    );
  }

  if (typeof value === "boolean") {
    return (
      <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[0.68rem]">
        {value ? "Yes" : "No"}
      </Badge>
    );
  }

  if (isNumericIdField(key)) {
    return (
      <span
        className="block max-w-[12rem] truncate font-mono text-[0.78rem] text-muted-foreground"
        title={String(value ?? "-")}
      >
        {formatValue(value)}
      </span>
    );
  }

  if (isUrlField(key, value)) {
    return (
      <span className="block max-w-full truncate text-sm text-muted-foreground" title={value}>
        {value}
      </span>
    );
  }

  return (
    <span
      className="block max-w-full whitespace-normal break-words text-sm leading-6 text-foreground/88"
      title={String(value ?? "-")}
    >
      {formatValue(value)}
    </span>
  );
};

const renderDetailValue = (key: string, value: ExplorerValue): ReactNode => {
  if (isTimestampField(key, value)) {
    return (
      <div className="grid gap-0.5">
        <div className="text-sm text-foreground">{formatDateTime(value)}</div>
        <div className="text-[0.78rem] text-muted-foreground">{formatRelativeDateTime(value)}</div>
      </div>
    );
  }

  if (typeof value === "boolean") {
    return (
      <Badge variant={value ? "secondary" : "outline"} className="rounded-full">
        {value ? "Yes" : "No"}
      </Badge>
    );
  }

  if (isUrlField(key, value)) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="block break-all text-sm leading-6 text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
      >
        {value}
      </a>
    );
  }

  return (
    <div
      className={cn(
        "text-sm leading-6 text-muted-foreground",
        isNumericIdField(key) && "break-all font-mono text-[0.82rem]",
        typeof value === "string" && value.length > 80 && "break-words",
      )}
    >
      {formatValue(value)}
    </div>
  );
};

const buildListRequest = (resource: ExplorerResourceKey, state: ResourceState) => ({
  resource,
  limit: DEFAULT_LIMIT,
  cursor: state.cursor,
  q: state.appliedQuery || undefined,
  from: state.appliedFilters.from || undefined,
  to: state.appliedFilters.to || undefined,
  guildId: state.appliedFilters.guildId || undefined,
  channelId: state.appliedFilters.channelId || undefined,
  authorId: state.appliedFilters.authorId || undefined,
  sentimentLabel: state.appliedFilters.sentimentLabel || undefined,
  isDeleted: state.appliedFilters.isDeleted || undefined,
  isMonitored: state.appliedFilters.isMonitored || undefined,
  isBot: state.appliedFilters.isBot || undefined,
  granularity: state.appliedFilters.granularity || undefined,
});

const getActiveFilterEntries = (filters: Record<string, string>) =>
  Object.entries(filters).filter(([, value]) => Boolean(value));

const getFilterDisplayValue = (
  definition: ExplorerResourceDefinition,
  key: string,
  value: string,
): string => {
  const filter = definition.filters.find((item) => item.param === key);
  const optionLabel = filter?.options?.find((option) => option.value === value)?.label;
  return optionLabel ?? value;
};

const DetailSection = ({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) => (
  <div className="space-y-2.5">
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className="rounded-full border border-primary/15 bg-primary/10 px-2 py-0.5 text-[0.68rem] text-primary"
        >
          {title}
        </Badge>
      </div>
      <p className="text-[0.82rem] leading-5 text-muted-foreground">{description}</p>
    </div>
    {children}
  </div>
);

const RowDetailPanel = ({
  selectedRowId,
  selectedRow,
  loadingDetail,
}: {
  selectedRowId: string | null;
  selectedRow: ExplorerDetailResponse["item"] | null;
  loadingDetail: boolean;
}) => {
  return (
    <div className="grid gap-4">
      {selectedRowId ? (
        <Badge
          variant="outline"
          className="w-fit rounded-full border-border/70 bg-background/70 px-2 py-0.5 text-[0.68rem] text-muted-foreground"
        >
          Selected {selectedRowId}
        </Badge>
      ) : null}

      {loadingDetail ? (
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/55 px-4 py-6 text-sm text-muted-foreground shadow-sm">
          <Filter className="size-4" />
          Loading detail...
        </div>
      ) : selectedRow ? (
        <>
          <DetailSection
            title="Values"
            description="Base fields returned for the selected record."
          >
            <div className="grid gap-2.5">
              {Object.entries(selectedRow.values).map(([key, value]) => (
                <Card
                  key={key}
                  className="border-border/60 bg-background/55 shadow-sm shadow-black/5"
                >
                  <CardContent className="space-y-1.5 p-3.5">
                    <div className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      {formatLabel(key)}
                    </div>
                    <div className="min-w-0">{renderDetailValue(key, value)}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </DetailSection>

          <DetailSection
            title="Joins"
            description="Related records hydrated by the explorer API."
          >
            <div className="grid gap-2.5">
              {Object.entries(selectedRow.joins).length ? (
                Object.entries(selectedRow.joins).map(([key, value]) => (
                  <Card
                    key={key}
                    className="border-border/60 bg-background/55 shadow-sm shadow-black/5"
                  >
                    <CardContent className="space-y-1.5 p-3.5">
                      <div className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        {formatLabel(key)}
                      </div>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-black/10 p-2.5 text-[0.72rem] leading-5 text-muted-foreground">
                        {JSON.stringify(value, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="border-dashed border-border/60 bg-background/40 shadow-none">
                  <CardContent className="px-4 py-5 text-sm text-muted-foreground">
                    No joined records for this row.
                  </CardContent>
                </Card>
              )}
            </div>
          </DetailSection>
        </>
      ) : (
        <Card className="border-dashed border-border/60 bg-background/40 shadow-none">
          <CardContent className="px-4 py-6 text-sm text-muted-foreground">
            Select a row from the table to inspect detailed values.
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const ResourceFilters = ({
  definition,
  state,
  searchRef,
  onQueryChange,
  onFilterChange,
  onApply,
  onReset,
}: {
  definition: ExplorerResourceDefinition;
  state: ResourceState;
  searchRef: React.RefObject<HTMLInputElement | null>;
  onQueryChange: (value: string) => void;
  onFilterChange: (key: string, value: string) => void;
  onApply: () => void;
  onReset: () => void;
}) => {
  const activeFilterEntries = getActiveFilterEntries(state.appliedFilters);
  const activeFilterCount = activeFilterEntries.length;
  const hasFilterControls = definition.filters.some((filter) => filter.param !== "q");
  const hasDateRangeFilter = definition.filters.some(
    (filter) => filter.param === "from" || filter.param === "to",
  );
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(activeFilterCount > 0);

  return (
    <Card className="border-border/70 bg-card/95 shadow-lg shadow-black/10">
      <CardHeader className="gap-2 border-b border-border/60 px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base tracking-[-0.02em]">Filters</CardTitle>
              <Badge variant="outline" className="rounded-full bg-background/65 px-2 py-0.5 text-[0.68rem]">
                {definition.filters.length} available
              </Badge>
              {activeFilterCount ? (
                <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[0.68rem]">
                  {activeFilterCount} active
                </Badge>
              ) : null}
            </div>
            <CardDescription className="text-[0.82rem] leading-5">
              Search and refine {definition.label.toLowerCase()} in place.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasFilterControls ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-lg bg-background/70 px-3"
                onClick={() => setShowAdvancedFilters((current) => !current)}
              >
                <SlidersHorizontal className="size-4" />
                {showAdvancedFilters ? "Hide filters" : "Show filters"}
                {showAdvancedFilters ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-lg bg-background/70 px-3"
              onClick={onReset}
            >
              Reset
            </Button>
            <Button type="button" size="sm" className="h-8 rounded-lg px-3" onClick={onApply}>
              Apply
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_auto] lg:items-end">
          <div className="grid gap-1.5">
          <Label
            htmlFor="explorer-search"
            className="text-xs uppercase tracking-[0.22em] text-muted-foreground"
          >
            Search
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="explorer-search"
              ref={searchRef}
              placeholder={`Search ${definition.label.toLowerCase()}`}
              value={state.draftQuery}
              className="h-9 border-border/60 bg-background/70 pl-9 text-sm"
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  onApply();
                }
              }}
            />
          </div>
          <p className="text-[0.72rem] leading-5 text-muted-foreground">
            Press `/` to focus. Use Cmd/Ctrl+Enter to apply.
          </p>
          </div>
          <div className="flex flex-wrap gap-1.5 lg:justify-end">
            {activeFilterEntries.length ? (
              activeFilterEntries.map(([key, value]) => (
                <Badge
                  key={key}
                  variant="outline"
                  className="rounded-full bg-background/65 px-2.5 py-0.5 text-[0.68rem]"
                >
                  {formatLabel(key)}: {getFilterDisplayValue(definition, key, value)}
                </Badge>
              ))
            ) : (
              <p className="text-[0.72rem] leading-5 text-muted-foreground">No filters applied.</p>
            )}
          </div>
        </div>

        {hasDateRangeFilter ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/45 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Date range
              </Label>
              <p className="text-[0.78rem] leading-5 text-muted-foreground">
                Filter this dataset by local calendar date.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DateRangePicker
                className="h-9 min-w-[240px] rounded-lg"
                title="Explorer window"
                description="Choose the local date range for the rows shown in this dataset."
                value={{
                  from: state.draftFilters.from ?? "",
                  to: state.draftFilters.to ?? "",
                }}
                onChange={({ from, to }) => {
                  onFilterChange("from", from);
                  onFilterChange("to", to);
                }}
              />
              {(state.draftFilters.from || state.draftFilters.to) ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-lg px-3"
                  onClick={() => {
                    onFilterChange("from", "");
                    onFilterChange("to", "");
                  }}
                >
                  Clear dates
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {showAdvancedFilters ? (
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {definition.filters
              .filter((filter) => filter.param !== "q" && filter.param !== "from" && filter.param !== "to")
              .map((filter) => (
                <div
                  key={filter.key}
                  className="grid gap-1 rounded-lg border border-border/60 bg-background/45 p-2.5"
                >
                  <Label
                    htmlFor={filter.key}
                    className="text-xs uppercase tracking-[0.2em] text-muted-foreground"
                  >
                    {filter.label}
                  </Label>
                  {filter.options ? (
                    <Select
                      value={state.draftFilters[filter.param] || ALL_FILTER_VALUE}
                      onValueChange={(value) =>
                        onFilterChange(
                          filter.param,
                          value === ALL_FILTER_VALUE ? "" : value,
                        )
                      }
                    >
                      <SelectTrigger
                        id={filter.key}
                        className="h-[2.125rem] w-full bg-background/70 text-sm"
                      >
                        <SelectValue placeholder={`All ${filter.label.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_FILTER_VALUE}>All</SelectItem>
                        {filter.options.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={filter.key}
                      value={state.draftFilters[filter.param] ?? ""}
                      placeholder={filter.label}
                      className="h-[2.125rem] border-border/60 bg-background/70 text-sm"
                      onChange={(event) => onFilterChange(filter.param, event.target.value)}
                    />
                  )}
                </div>
              ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

const ResourceSwitcher = ({
  activeDefinition,
  activeResource,
  visibleResources,
  onSelect,
}: {
  activeDefinition: ExplorerResourceDefinition;
  activeResource: ExplorerResourceKey;
  visibleResources: ExplorerResourcesResponse["resources"];
  onSelect: (resource: ExplorerResourceKey) => void;
}) => (
  <div className="grid gap-3">
    <div className="sm:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="h-9 w-full justify-between rounded-lg bg-background/70 px-3"
          >
            <span className="truncate">{activeDefinition.label}</span>
            <Rows3 className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[var(--radix-dropdown-menu-trigger-width)]"
        >
          {visibleResources.map((resource) => (
            <DropdownMenuItem key={resource.key} onClick={() => onSelect(resource.key)}>
              {resource.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <div className="hidden sm:block">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {visibleResources.map((resource) => {
          const isActive = resource.key === activeResource;
          return (
            <Button
              key={resource.key}
              type="button"
              variant="ghost"
              className={cn(
                "h-auto min-w-0 justify-start rounded-lg border px-3 py-2 text-left transition-all duration-200",
                isActive
                  ? "border-primary/25 bg-primary/10 text-foreground shadow-sm shadow-primary/5"
                  : "border-border/40 bg-background/35 text-muted-foreground hover:border-border/70 hover:bg-background/70 hover:text-foreground",
              )}
              onClick={() => onSelect(resource.key)}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">
                  {resource.label}
                </div>
                <div className="line-clamp-2 text-[0.72rem] leading-[1.1rem] text-muted-foreground">
                  {resource.description}
                </div>
              </div>
            </Button>
          );
        })}
      </div>
    </div>
  </div>
);

export const DataExplorerPanel = memo(({
  initialState,
}: {
  initialState?: ExplorerInitialState;
}) => {
  const searchRef = useRef<HTMLInputElement | null>(null);
  const initialDetailOpenedRef = useRef(false);
  const [metadata, setMetadata] = useState<ExplorerResourcesResponse | null>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(true);
  const [metadataError, setMetadataError] = useState("");
  const [activeResource, setActiveResource] = useState<ExplorerResourceKey | null>(null);
  const [resourceState, setResourceState] = useState<Record<string, ResourceState>>({});
  const visibleResources = useMemo(() => metadata?.resources ?? [], [metadata]);

  useEffect(() => {
    let active = true;
    setLoadingMetadata(true);

    fetchExplorerResources()
      .then((response) => {
        if (!active) return;
        setMetadata(response);
        setActiveResource(initialState?.resource ?? response.resources[0]?.key ?? null);
      })
      .catch(() => {
        if (!active) return;
        setMetadataError("Unable to load explorer resources.");
      })
      .finally(() => {
        if (active) setLoadingMetadata(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!visibleResources.length) {
      if (activeResource !== null) setActiveResource(null);
      return;
    }

    if (
      !activeResource ||
      !visibleResources.some((resource) => resource.key === activeResource)
    ) {
      setActiveResource(visibleResources[0]?.key ?? null);
    }
  }, [activeResource, visibleResources]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      searchRef.current?.focus();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const activeDefinition = useMemo(
    () => metadata?.resources.find((item) => item.key === activeResource) ?? null,
    [activeResource, metadata],
  );

  const currentState = activeResource
    ? resourceState[activeResource] ??
      createResourceState(
        activeResource === initialState?.resource
          ? {
              query: initialState?.query,
              filters: initialState?.filters,
            }
          : undefined,
      )
    : createResourceState();

  const visibleColumns = useMemo(
    () =>
      activeDefinition?.columns.filter((column) => column.defaultVisible).slice(0, MAX_VISIBLE_COLUMNS) ?? [],
    [activeDefinition],
  );

  const updateState = (
    resource: ExplorerResourceKey,
    updater: (current: ResourceState) => ResourceState,
  ) => {
    setResourceState((current) => {
      const existing = current[resource] ??
        createResourceState(
          resource === initialState?.resource
            ? {
                query: initialState?.query,
                filters: initialState?.filters,
              }
            : undefined,
        );
      return { ...current, [resource]: updater(existing) };
    });
  };

  const loadList = (resource: ExplorerResourceKey, nextState?: Partial<ResourceState>) => {
    const mergedState = {
      ...(resourceState[resource] ?? createResourceState()),
      ...nextState,
    } as ResourceState;

    updateState(resource, (current) => ({
      ...current,
      ...nextState,
      loading: true,
      error: "",
    }));

    void fetchExplorerList(buildListRequest(resource, mergedState))
      .then((data) => {
        updateState(resource, (current) => ({
          ...current,
          data,
          loading: false,
        }));
      })
      .catch(() => {
        updateState(resource, (current) => ({
          ...current,
          loading: false,
          error: "Unable to load explorer rows.",
        }));
      });
  };

  useEffect(() => {
    if (!activeResource) return;
    const existing = resourceState[activeResource];
    if (existing?.data || existing?.loading) return;
    loadList(
      activeResource,
      activeResource === initialState?.resource
        ? {
            draftQuery: initialState?.query ?? "",
            appliedQuery: initialState?.query ?? "",
            draftFilters: initialState?.filters ?? {},
            appliedFilters: initialState?.filters ?? {},
          }
        : undefined,
    );
  }, [activeResource, initialState, resourceState]);

  useEffect(() => {
    if (
      !activeResource ||
      activeResource !== initialState?.resource ||
      !initialState.rowId ||
      initialDetailOpenedRef.current
    ) {
      return;
    }

    initialDetailOpenedRef.current = true;
    openDetail(initialState.rowId);
  }, [activeResource, initialState]);

  const applyFilters = () => {
    if (!activeResource) return;
    loadList(activeResource, {
      appliedQuery: currentState.draftQuery,
      appliedFilters: currentState.draftFilters,
      cursor: null,
      cursorStack: [],
      selectedRowId: null,
      selectedRow: null,
    });
  };

  const resetFilters = () => {
    if (!activeResource) return;
    loadList(activeResource, {
      draftQuery: "",
      draftFilters: {},
      appliedQuery: "",
      appliedFilters: {},
      cursor: null,
      cursorStack: [],
      selectedRowId: null,
      selectedRow: null,
    });
  };

  const openDetail = (rowId: string) => {
    if (!activeResource) return;

    updateState(activeResource, (current) => ({
      ...current,
      selectedRowId: rowId,
      loadingDetail: true,
    }));

    void fetchExplorerDetail({ resource: activeResource, id: rowId })
      .then((response) => {
        updateState(activeResource, (current) => ({
          ...current,
          selectedRowId: rowId,
          selectedRow: response.item,
          loadingDetail: false,
        }));
      })
      .catch(() => {
        updateState(activeResource, (current) => ({
          ...current,
          loadingDetail: false,
          error: "Unable to load explorer detail.",
        }));
      });
  };

  const closeDetail = () => {
    if (!activeResource) return;
    updateState(activeResource, (current) => ({
      ...current,
      selectedRowId: null,
      selectedRow: null,
      loadingDetail: false,
    }));
  };

  const goToNextPage = () => {
    if (!activeResource || !currentState.data?.pageInfo.nextCursor) return;
    loadList(activeResource, {
      cursorStack: [...currentState.cursorStack, currentState.cursor ?? ROOT_CURSOR],
      cursor: currentState.data.pageInfo.nextCursor,
    });
  };

  const goToPreviousPage = () => {
    if (!activeResource) return;
    const previousCursorToken =
      currentState.cursorStack[currentState.cursorStack.length - 1] ?? null;

    loadList(activeResource, {
      cursor: previousCursorToken === ROOT_CURSOR ? null : previousCursorToken,
      cursorStack: currentState.cursorStack.slice(0, -1),
    });
  };

  if (loadingMetadata) {
    return (
      <Card className="border-border/60 bg-card/80">
        <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
          <Database className="size-4" />
          Loading explorer configuration...
        </CardContent>
      </Card>
    );
  }

  if (metadataError) {
    return (
      <Card className="border-destructive/30 bg-destructive/10 text-destructive">
        <CardContent className="p-6">{metadataError}</CardContent>
      </Card>
    );
  }

  if (!metadata || !activeDefinition || !activeResource) {
    return (
      <Card className="border-border/60 bg-card/80">
        <CardContent className="p-6 text-sm text-muted-foreground">
          No explorer resources are available.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid min-w-0 gap-4">
        <div className="grid min-w-0 gap-4">
          <Card className="border-border/70 bg-card/95 shadow-lg shadow-black/10">
            <CardHeader className="gap-3 border-b border-border/60 px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="rounded-full bg-background/65 px-2 py-0.5 text-[0.68rem]"
                    >
                      Explorer
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="rounded-full border border-primary/15 bg-primary/10 px-2 py-0.5 text-[0.68rem] text-primary"
                    >
                      {(currentState.data?.items.length ?? 0).toLocaleString()} rows
                    </Badge>
                  </div>
                  <div>
                    <CardTitle className="text-base tracking-[-0.03em]">
                      {activeDefinition.label}
                    </CardTitle>
                    <CardDescription className="max-w-3xl text-[0.82rem] leading-5">
                      {activeDefinition.description}
                    </CardDescription>
                  </div>
                </div>
                <div className="grid gap-1 text-sm text-muted-foreground lg:justify-items-end">
                  <Badge
                    variant="outline"
                    className="rounded-full bg-background/65 px-2 py-0.5 text-[0.68rem]"
                  >
                    Updated {formatDateTime(currentState.data?.generatedAt ?? null)}
                  </Badge>
                  <span className="text-[0.78rem]">{DEFAULT_LIMIT} rows per page</span>
                </div>
              </div>
              <ResourceSwitcher
                activeDefinition={activeDefinition}
                activeResource={activeResource}
                visibleResources={visibleResources}
                onSelect={setActiveResource}
              />
            </CardHeader>
          </Card>

          <ResourceFilters
            definition={activeDefinition}
            state={currentState}
            searchRef={searchRef}
            onQueryChange={(value) =>
              updateState(activeResource, (current) => ({ ...current, draftQuery: value }))
            }
            onFilterChange={(key, value) =>
              updateState(activeResource, (current) => ({
                ...current,
                draftFilters: { ...current.draftFilters, [key]: value },
              }))
            }
            onApply={applyFilters}
            onReset={resetFilters}
          />

          <Card className="min-w-0 border-border/70 bg-card/95 shadow-lg shadow-black/10">
            <CardHeader className="gap-2 border-b border-border/60 px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base tracking-[-0.02em]">Rows</CardTitle>
                <CardDescription className="text-[0.82rem] leading-5">
                  Click any row to inspect the full record. The table stays full width.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {currentState.selectedRowId ? (
                  <Badge
                    variant="outline"
                    className="rounded-full bg-background/65 px-2 py-0.5 text-[0.68rem]"
                  >
                    Selected {currentState.selectedRowId}
                  </Badge>
                ) : null}
                <Button
                  variant="outline"
                  className="h-8 rounded-lg bg-background/70 px-3"
                  onClick={goToPreviousPage}
                  disabled={currentState.cursorStack.length === 0 || currentState.loading}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  className="h-8 rounded-lg bg-background/70 px-3"
                  onClick={goToNextPage}
                  disabled={!currentState.data?.pageInfo.hasNextPage || currentState.loading}
                >
                  Next
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-4 sm:p-5">
              {currentState.error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                  {currentState.error}
                </div>
              ) : null}

              <div className="overflow-hidden rounded-xl border border-border/60 bg-background/70 shadow-inner shadow-black/10">
                <Table className="min-w-[720px] table-fixed">
                  <colgroup>
                    {visibleColumns.map((column, index) => (
                      <col
                        key={column.key}
                        className={cn(
                          index === 0 && "w-[16%]",
                          index === 1 && "w-[16%]",
                          index === 2 && "w-[18%]",
                          index === 3 && "w-[12%]",
                          index >= 4 && "w-[38%]",
                        )}
                      />
                    ))}
                  </colgroup>
                  <TableHeader>
                    <TableRow className="border-border/60">
                      {visibleColumns.map((column) => (
                        <TableHead
                          key={column.key}
                          className="h-9 px-3.5 text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground"
                        >
                          {column.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentState.loading ? (
                      <TableRow>
                        <TableCell
                          colSpan={visibleColumns.length}
                          className="h-24 px-3.5 text-center text-sm text-muted-foreground"
                        >
                          Loading rows...
                        </TableCell>
                      </TableRow>
                    ) : currentState.data?.items.length ? (
                      currentState.data.items.map((row) => {
                        const isSelected = currentState.selectedRowId === row.id;
                        return (
                          <TableRow
                            key={row.id}
                            data-state={isSelected ? "selected" : undefined}
                            role="button"
                            tabIndex={0}
                            aria-selected={isSelected}
                            className={cn(
                              "cursor-pointer border-border/60 transition-[background-color,border-color,box-shadow] duration-200 hover:bg-accent/20 focus-visible:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                              isSelected && "bg-primary/7",
                            )}
                            onClick={() => openDetail(row.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                openDetail(row.id);
                              }
                            }}
                          >
                            {visibleColumns.map((column) => {
                              const cellValue = row.values[column.key] ?? null;
                              return (
                                <TableCell
                                  key={column.key}
                                  className="px-3.5 py-2 align-top text-foreground/88"
                                >
                                  <div
                                    className={cn(
                                      "min-w-0 text-[0.82rem] leading-[1.35rem]",
                                      column.type === "datetime"
                                        ? "whitespace-nowrap text-muted-foreground"
                                        : typeof cellValue === "boolean"
                                          ? "text-foreground/88"
                                          : isNumericIdField(column.key)
                                            ? "truncate font-mono text-[0.78rem] text-muted-foreground"
                                            : isUrlField(column.key, cellValue)
                                              ? "truncate text-muted-foreground"
                                              : isLongValue(cellValue)
                                                ? "line-clamp-2 break-all text-muted-foreground"
                                                : "break-words",
                                    )}
                                    title={typeof cellValue === "string" ? cellValue : undefined}
                                  >
                                    {renderTableValue(column.key, cellValue)}
                                  </div>
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={visibleColumns.length}
                          className="h-24 px-3.5 text-center text-sm text-muted-foreground"
                        >
                          No rows found for the current query.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Sheet
        modal={false}
        open={Boolean(currentState.selectedRowId)}
        onOpenChange={(open) => {
          if (!open) closeDetail();
        }}
      >
        <SheetContent
          overlayClassName="pointer-events-none bg-transparent"
          className="w-full gap-0 border-l border-border bg-[linear-gradient(180deg,color-mix(in_oklab,var(--background)_98%,transparent),color-mix(in_oklab,var(--card)_92%,transparent))] p-0 sm:max-w-2xl"
        >
          <SheetHeader className="border-b border-border/60 px-4 py-4">
            <SheetTitle className="text-base">Row detail</SheetTitle>
            <SheetDescription>
              Inspect the selected record without leaving the table.
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto p-4">
            <RowDetailPanel
              selectedRowId={currentState.selectedRowId}
              selectedRow={currentState.selectedRow}
              loadingDetail={currentState.loadingDetail}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
});

DataExplorerPanel.displayName = "DataExplorerPanel";
