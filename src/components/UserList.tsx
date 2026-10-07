import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type UserListProps = {
  visits: Visit[];
  loading: boolean;
  error: string | null;
};

type Visit = {
  id: number | string;
  path: string;
  createdAt: string | number | Date;
};

export function UserList({ visits, loading, error }: UserListProps) {
  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader>
        <CardTitle>Visit history</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        ) : loading ? (
          <p className="text-sm text-muted-foreground">Loading visit history...</p>
        ) : visits.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No visits yet. Click &quot;Track Current Route&quot; to create your first row.
          </p>
        ) : (
          <ul className="space-y-3">
            {visits.map((visit) => (
              <li
                key={visit.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm"
              >
                <span className="font-mono text-foreground/88">{visit.path}</span>
                <span className="text-muted-foreground">
                  {new Date(visit.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default UserList;
