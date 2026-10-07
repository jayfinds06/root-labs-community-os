import { useEffect, useState, type FormEvent } from "react";
import { IconRefresh } from "@tabler/icons-react";
import {
  LoaderCircle,
  LockOpen,
  Settings2,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AdminUser, SyncSettingsResponse } from "@/utils/api";

type SettingsPanelProps = {
  syncSettings: SyncSettingsResponse | null;
  savingSyncSettings: boolean;
  users: AdminUser[];
  usersTotal: number;
  usersLoading: boolean;
  usersError: string;
  usersSearch: string;
  loadingLabel: string;
  onUsersSearchChange: (value: string) => void;
  onRefreshUsers: () => Promise<void>;
  onSaveSyncSettings: (cadenceMinutes: number) => Promise<void>;
  onSaveRawDataAccess: (allowRawDataAccess: boolean) => Promise<void>;
  onCreateUser: (input: {
    name: string;
    email: string;
    password: string;
    role: "admin" | "user";
  }) => Promise<void>;
  onUpdateUser: (input: {
    userId: string;
    name: string;
    email: string;
    role: "admin" | "user";
  }) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
};

type CreateFormState = {
  name: string;
  email: string;
  password: string;
  role: "admin" | "user";
};

type EditFormState = {
  userId: string;
  name: string;
  email: string;
  role: "admin" | "user";
};

type SettingsStatCardProps = {
  label: string;
  value: string;
  detail: string;
};

const defaultCreateForm: CreateFormState = {
  name: "",
  email: "",
  password: "",
  role: "user",
};

const emptyEditForm: EditFormState = {
  userId: "",
  name: "",
  email: "",
  role: "user",
};

const formatTimestamp = (value: number) =>
  new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const SettingsStatCard = ({
  label,
  value,
  detail,
}: SettingsStatCardProps) => (
  <div className="rounded-3xl border border-border/70 bg-background/50 px-4 py-3.5">
    <p className="text-[0.64rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
      {label}
    </p>
    <p className="mt-2 text-[1.55rem] font-semibold tracking-[-0.05em] text-foreground">
      {value}
    </p>
    <p className="mt-1 text-sm leading-5 text-muted-foreground">{detail}</p>
  </div>
);

export const SettingsPanel = ({
  syncSettings,
  savingSyncSettings,
  users,
  usersTotal,
  usersLoading,
  usersError,
  usersSearch,
  loadingLabel,
  onUsersSearchChange,
  onRefreshUsers,
  onSaveSyncSettings,
  onSaveRawDataAccess,
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
}: SettingsPanelProps) => {
  const [cadenceDraft, setCadenceDraft] = useState("10");
  const [createForm, setCreateForm] = useState<CreateFormState>(defaultCreateForm);
  const [editForm, setEditForm] = useState<EditFormState>(emptyEditForm);
  const [creatingUser, setCreatingUser] = useState(false);
  const [updatingUser, setUpdatingUser] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState("");

  useEffect(() => {
    if (!syncSettings) {
      return;
    }

    setCadenceDraft(String(syncSettings.cadenceMinutes));
  }, [syncSettings]);

  useEffect(() => {
    if (!editForm.userId) {
      return;
    }

    const selected = users.find((item) => item.id === editForm.userId);
    if (!selected) {
      setEditForm(emptyEditForm);
      return;
    }

    setEditForm({
      userId: selected.id,
      name: selected.name,
      email: selected.email,
      role: selected.role,
    });
  }, [editForm.userId, users]);

  const selectedUser = editForm.userId
    ? users.find((item) => item.id === editForm.userId) ?? null
    : null;
  const activeUsers = users.filter((item) => !item.banned).length;
  const adminUsers = users.filter((item) => item.role === "admin").length;
  const cadenceValue = syncSettings?.cadenceMinutes ?? null;
  const cadenceLabel =
    cadenceValue === null ? "Not configured" : `Every ${cadenceValue.toLocaleString()} min`;
  const rawDataAccessEnabled = syncSettings?.allowRawDataAccess ?? false;
  const selectedUserStatus = selectedUser?.banned ? "Restricted" : "Active";
  const canShowDetailPane = Boolean(selectedUser);

  const handleCadenceSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const minutes = Number(cadenceDraft);

    if (!Number.isFinite(minutes)) {
      toast.error("Enter a valid cadence in minutes.");
      return;
    }

    try {
      await onSaveSyncSettings(minutes);
      toast.success("Sync cadence updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update sync cadence.");
    }
  };

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      toast.error("Name, email, and password are required.");
      return;
    }

    setCreatingUser(true);
    try {
      await onCreateUser({
        ...createForm,
        name: createForm.name.trim(),
        email: createForm.email.trim(),
      });
      setCreateForm(defaultCreateForm);
      toast.success("User created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create user.");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleUpdateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editForm.userId || !editForm.name.trim() || !editForm.email.trim()) {
      toast.error("Select a user and complete the form.");
      return;
    }

    setUpdatingUser(true);
    try {
      await onUpdateUser({
        userId: editForm.userId,
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
      });
      toast.success("User updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update user.");
    } finally {
      setUpdatingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) {
      toast.error("Select a user to delete.");
      return;
    }

    setDeletingUserId(selectedUser.id);
    try {
      await onDeleteUser(selectedUser.id);
      setEditForm(emptyEditForm);
      toast.success("User deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete user.");
    } finally {
      setDeletingUserId("");
    }
  };

  return (
    <div className="grid gap-5">
      <Card className="overflow-hidden rounded-[28px] border-border/70 bg-card/94 shadow-none">
        <CardHeader className="gap-5 px-5 py-5 md:px-6 md:py-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                <Settings2 className="size-3.5" />
                Settings
              </div>
              <div className="space-y-1.5">
                <CardTitle className="text-[1.75rem] tracking-[-0.05em] md:text-[1.9rem]">
                  Team access
                </CardTitle>
                <CardDescription className="max-w-xl text-sm leading-6 text-muted-foreground">
                  Search, select, review, and update accounts without leaving the settings
                  workspace.
                </CardDescription>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 xl:justify-end">
              <Badge variant="secondary">{usersTotal.toLocaleString()} total</Badge>
              <Badge variant="outline">{activeUsers.toLocaleString()} active</Badge>
              <Badge variant="outline">{cadenceLabel}</Badge>
            </div>
          </div>

          <div className="grid gap-2.5 md:grid-cols-3">
            <SettingsStatCard
              label="Worker status"
              value={loadingLabel}
              detail="Current background refresh cadence and worker state."
            />
            <SettingsStatCard
              label="Admin seats"
              value={adminUsers.toLocaleString()}
              detail="Accounts with elevated permissions."
            />
            <SettingsStatCard
              label="Active access"
              value={activeUsers.toLocaleString()}
              detail="Users currently able to sign in to the dashboard."
            />
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.24fr)_minmax(19rem,0.76fr)] xl:items-start">
        <div className="grid gap-5 xl:order-2">
          <Card className="rounded-[26px] border-border/70 bg-card/94 shadow-none">
            <CardHeader className="px-5 pb-0 pt-5 md:px-6 md:pt-6">
              <div className="space-y-2">
                <CardTitle className="text-lg tracking-[-0.04em]">Sync cadence</CardTitle>
                <CardDescription className="max-w-md text-sm leading-6">
                  Control how often the incremental Discord sync schedule runs.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-4 md:px-6 md:pb-6">
              <form className="grid gap-3.5" onSubmit={handleCadenceSubmit}>
                <div className="grid gap-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground" htmlFor="sync-cadence">
                    Cadence in minutes
                  </Label>
                  <Input
                    className="border-input/80 bg-input/[0.36] focus-visible:bg-background/85"
                    id="sync-cadence"
                    type="number"
                    min={syncSettings?.limits.minMinutes ?? 5}
                    max={syncSettings?.limits.maxMinutes ?? 60}
                    step={1}
                    value={cadenceDraft}
                    onChange={(event) => setCadenceDraft(event.target.value)}
                  />
                  <p className="text-sm leading-5 text-muted-foreground">
                    Use a shorter cadence for tighter ingestion freshness or a longer cadence when
                    you need to reduce load.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                  <div className="font-medium text-foreground">
                    Current cadence: every {syncSettings?.cadenceMinutes ?? "..."} minutes
                  </div>
                  <div className="mt-1">
                    Supported bounds: {syncSettings?.limits.minMinutes ?? 5} to{" "}
                    {syncSettings?.limits.maxMinutes ?? 60} minutes
                  </div>
                </div>
                <div className="flex justify-start pt-1">
                  <Button className="min-w-32 rounded-xl" type="submit" disabled={savingSyncSettings}>
                    {savingSyncSettings ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        Saving cadence...
                      </>
                    ) : (
                      "Save cadence"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border-border/70 bg-card/94 shadow-none">
            <CardHeader className="px-5 pb-0 pt-5 md:px-6 md:pt-6">
              <div className="space-y-2">
                <CardTitle className="text-lg tracking-[-0.04em]">Admin chat data access</CardTitle>
                <CardDescription className="max-w-md text-sm leading-6">
                  Allow the admin assistant to run read-only SQLite queries on Discord-domain
                  tables when the curated dashboard evidence is not enough.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-4 md:px-6 md:pb-6">
              <div className="grid gap-3.5">
                <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <LockOpen className="size-4" />
                    {rawDataAccessEnabled ? "Raw data access enabled" : "Raw data access disabled"}
                  </div>
                  <div className="mt-1">
                    The assistant stays read-only. Writes, schema changes, auth tables, and
                    generic app settings remain blocked.
                  </div>
                </div>
                <div className="flex justify-start">
                  <Button
                    className="min-w-40 rounded-xl"
                    type="button"
                    variant={rawDataAccessEnabled ? "secondary" : "default"}
                    disabled={savingSyncSettings}
                    onClick={() => void onSaveRawDataAccess(!rawDataAccessEnabled)}
                  >
                    {savingSyncSettings ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        Saving access...
                      </>
                    ) : rawDataAccessEnabled ? (
                      "Disable raw access"
                    ) : (
                      "Enable raw access"
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border-border/70 bg-card/94 shadow-none">
            <CardHeader className="px-5 pb-0 pt-5 md:px-6 md:pt-6">
              <div className="space-y-2">
                <CardTitle className="text-lg tracking-[-0.04em]">Create user</CardTitle>
                <CardDescription className="max-w-md text-sm leading-6">
                  Add a new operator or reviewer without leaving the settings workspace.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-4 md:px-6 md:pb-6">
              <form className="grid gap-3.5" onSubmit={handleCreateUser}>
                <div className="grid gap-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground" htmlFor="create-user-name">
                    Name
                  </Label>
                  <Input
                    className="border-input/80 bg-input/[0.36] focus-visible:bg-background/85"
                    id="create-user-name"
                    value={createForm.name}
                    onChange={(event) =>
                      setCreateForm((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <div className="grid gap-2">
                    <Label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground" htmlFor="create-user-email">
                      Email
                    </Label>
                    <Input
                      className="border-input/80 bg-input/[0.36] focus-visible:bg-background/85"
                      id="create-user-email"
                      type="email"
                      value={createForm.email}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, email: event.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground" htmlFor="create-user-role">
                      Role
                    </Label>
                    <Select
                      value={createForm.role}
                      onValueChange={(value: "admin" | "user") =>
                        setCreateForm((current) => ({ ...current, role: value }))
                      }
                    >
                      <SelectTrigger
                        className="border-input/80 bg-input/[0.36] focus-visible:bg-background/85"
                        id="create-user-role"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground" htmlFor="create-user-password">
                    Password
                  </Label>
                  <Input
                    className="border-input/80 bg-input/[0.36] focus-visible:bg-background/85"
                    id="create-user-password"
                    type="password"
                    value={createForm.password}
                    onChange={(event) =>
                      setCreateForm((current) => ({ ...current, password: event.target.value }))
                    }
                  />
                </div>
                <div className="flex justify-start pt-1">
                  <Button className="min-w-32 rounded-xl" type="submit" disabled={creatingUser}>
                    {creatingUser ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        Creating user...
                      </>
                    ) : (
                      "Create user"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-5 xl:order-1">
          <Card className="rounded-[26px] border-border/70 bg-card/94 shadow-none">
            <CardHeader className="gap-4 px-5 pb-0 pt-5 md:px-6 md:pt-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg tracking-[-0.04em]">Directory</CardTitle>
                  <CardDescription className="text-sm leading-6">
                    Search accounts, select a user, and edit access details inline.
                  </CardDescription>
                </div>
                <Button
                  className="rounded-xl"
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void onRefreshUsers()}
                >
                  <IconRefresh className="size-4" />
                  Refresh
                </Button>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <div className="grid gap-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground" htmlFor="users-search">
                    Search users
                  </Label>
                  <Input
                    className="border-input/80 bg-input/[0.36] focus-visible:bg-background/85"
                    id="users-search"
                    value={usersSearch}
                    placeholder="Search by name, email, or role"
                    onChange={(event) => onUsersSearchChange(event.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <Badge variant="secondary">{usersTotal.toLocaleString()} total</Badge>
                  <Badge variant="outline">{activeUsers.toLocaleString()} active</Badge>
                  <Badge variant="outline">{adminUsers.toLocaleString()} admin</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-5 pb-5 pt-4 md:px-6 md:pb-6">
              {usersError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {usersError}
                </div>
              ) : null}

              <div
                className={cn(
                  "grid gap-4",
                  canShowDetailPane
                    ? "xl:grid-cols-[minmax(0,1.18fr)_minmax(20.5rem,0.82fr)]"
                    : "grid-cols-1",
                )}
              >
                <div className="overflow-hidden rounded-[24px] border border-border/70 bg-background/40">
                  <div className="max-h-[36rem] overflow-auto">
                    <table className="min-w-full table-fixed text-sm">
                      <colgroup>
                        <col className={cn(canShowDetailPane ? "w-[50%]" : "w-[54%]")} />
                        <col className={cn(canShowDetailPane ? "w-[18%]" : "w-[16%]")} />
                        <col className={cn(canShowDetailPane ? "w-[22%]" : "w-[18%]")} />
                        <col className="hidden 2xl:table-column w-[14%]" />
                      </colgroup>
                      <thead className="bg-muted/30 text-left text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3.5 font-medium">User</th>
                          <th className="px-3 py-3.5 font-medium">Role</th>
                          <th className="px-3 py-3.5 font-medium">Status</th>
                          <th className="hidden 2xl:table-cell px-3 py-3.5 font-medium">Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usersLoading ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                              Loading users...
                            </td>
                          </tr>
                        ) : users.length ? (
                          users.map((item) => {
                            const isSelected = item.id === selectedUser?.id;

                            return (
                              <tr
                                key={item.id}
                                className={cn(
                                  "cursor-pointer border-t border-border/60 transition-colors hover:bg-muted/25",
                                  isSelected && "bg-muted/40",
                                )}
                                onClick={() =>
                                  setEditForm({
                                    userId: item.id,
                                    name: item.name,
                                    email: item.email,
                                    role: item.role,
                                  })
                                }
                              >
                                <td className="px-4 py-3.5">
                                  <div className="space-y-0.5">
                                    <div className="truncate font-medium text-foreground">{item.name}</div>
                                    <div className="truncate text-muted-foreground">{item.email}</div>
                                  </div>
                                </td>
                                <td className="px-3 py-3.5">
                                  <Badge
                                    className="max-w-full whitespace-nowrap"
                                    variant={item.role === "admin" ? "default" : "secondary"}
                                  >
                                    {item.role}
                                  </Badge>
                                </td>
                                <td className="px-3 py-3.5">
                                  <Badge
                                    className="max-w-full whitespace-nowrap"
                                    variant={item.banned ? "destructive" : "outline"}
                                  >
                                    {item.banned ? "Restricted" : "Active"}
                                  </Badge>
                                </td>
                                <td className="hidden 2xl:table-cell px-3 py-3.5 text-muted-foreground">
                                  {formatTimestamp(item.updatedAt)}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                              No users match the current filter.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {selectedUser ? (
                  <div className="rounded-[24px] border border-border/70 bg-background/40 p-4 md:p-5">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 text-[0.64rem] uppercase tracking-[0.16em] text-muted-foreground">
                          <Shield className="size-3.5" />
                          User detail
                        </div>
                        <p className="max-w-sm text-sm leading-5 text-muted-foreground">
                          Inspect the selected account and update access inline.
                        </p>
                      </div>
                      <Button
                        className="rounded-xl"
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditForm(emptyEditForm)}
                      >
                        Close
                      </Button>
                    </div>

                    <form className="grid gap-3.5" onSubmit={handleUpdateUser}>
                      <div className="space-y-1">
                        <div className="truncate text-lg font-semibold tracking-[-0.04em] text-foreground">
                          {selectedUser.name}
                        </div>
                        <div className="truncate text-sm text-muted-foreground">
                          {selectedUser.email}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1.5">
                          <Badge variant={selectedUser.role === "admin" ? "default" : "secondary"}>
                            {selectedUser.role}
                          </Badge>
                          <Badge variant={selectedUser.banned ? "destructive" : "outline"}>
                            {selectedUserStatus}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-border/70 bg-background/70 px-3.5 py-3">
                          <div className="text-[0.64rem] uppercase tracking-[0.16em] text-muted-foreground">
                            Created
                          </div>
                          <div className="mt-1.5 text-sm text-foreground">
                            {formatTimestamp(selectedUser.createdAt)}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/70 px-3.5 py-3">
                          <div className="text-[0.64rem] uppercase tracking-[0.16em] text-muted-foreground">
                            Last updated
                          </div>
                          <div className="mt-1.5 text-sm text-foreground">
                            {formatTimestamp(selectedUser.updatedAt)}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground" htmlFor="edit-user-name">
                          Name
                        </Label>
                        <Input
                          className="border-input/80 bg-input/[0.36] focus-visible:bg-background/85"
                          id="edit-user-name"
                          value={editForm.name}
                          onChange={(event) =>
                            setEditForm((current) => ({ ...current, name: event.target.value }))
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground" htmlFor="edit-user-email">
                          Email
                        </Label>
                        <Input
                          className="border-input/80 bg-input/[0.36] focus-visible:bg-background/85"
                          id="edit-user-email"
                          type="email"
                          value={editForm.email}
                          onChange={(event) =>
                            setEditForm((current) => ({ ...current, email: event.target.value }))
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground" htmlFor="edit-user-role">
                          Role
                        </Label>
                        <Select
                          value={editForm.role}
                          onValueChange={(value: "admin" | "user") =>
                            setEditForm((current) => ({ ...current, role: value }))
                          }
                        >
                          <SelectTrigger
                            className="border-input/80 bg-input/[0.36] focus-visible:bg-background/85"
                            id="edit-user-role"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <Button className="min-w-32 rounded-xl" type="submit" disabled={updatingUser}>
                          {updatingUser ? (
                            <>
                              <LoaderCircle className="size-4 animate-spin" />
                              Saving changes...
                            </>
                          ) : (
                            "Save user"
                          )}
                        </Button>
                        <Button
                          className="min-w-32 rounded-xl"
                          type="button"
                          variant="destructive"
                          disabled={deletingUserId === selectedUser.id}
                          onClick={() => void handleDeleteUser()}
                        >
                          {deletingUserId === selectedUser.id ? (
                            <>
                              <LoaderCircle className="size-4 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            "Delete user"
                          )}
                        </Button>
                      </div>
                    </form>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
