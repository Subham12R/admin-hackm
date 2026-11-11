"use client"

import { useState } from "react"

import { Badge, Button, ConfirmButton, Field, FieldAction, Notice, PageHeader, Panel, Select, StatusBadge, TextInput } from "@/components/admin/kit"
import { Bones } from "@/components/admin/bones"
import { FlushPanel } from "@/components/admin/flush-panel"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, dateTime, errorMessage } from "@/lib/api"
import { can, keys, useAdminMutation, useAdminQuery, useMe, useRoles } from "@/lib/queries"
import { notify } from "@/lib/notify"

type StaffMember = { id: string; email: string; display_name: string; status: string; roles: string[]; owner?: boolean }
type Invite = { id: string; email: string; role: string; expires_at: string; created_at: string }
type StaffPage = { staff: StaffMember[]; invites: Invite[]; roles: string[] }

const ROLE_HELP: Record<string, string> = {
  SUPER_ADMIN: "Everything, including refunds and staff",
  EVENT_ADMIN: "Schedule, challenge, announcements, results",
  REGISTRATION_ADMIN: "Team and ACM review",
  EVALUATION_ADMIN: "Rounds, rubric, judge assignment",
  SUPPORT_ADMIN: "Contacts inbox",
  JUDGE: "Scores assigned anonymous projects only",
  VIEWER: "Read-only",
}

export default function SettingsPage() {
  const me = useMe()
  const roles = useRoles()
  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 rounded-2xl p-2 font-pixel-square leading-tighter">
      <PageHeader title="Settings" description="Your account, and staff access for super admins." />
      <PasswordPanel email={me.data?.user.email} roles={roles} />
      {can.superAdmin(roles) ? <StaffPanel selfId={me.data?.user.id} /> : null}
      {me.data?.user.is_owner ? <FlushPanel /> : null}
    </div>
  )
}

function PasswordPanel({ email, roles }: { email?: string; roles: string[] }) {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" })
  const [pending, setPending] = useState(false)
  const valid = form.current && form.next.length >= 8 && form.next === form.confirm

  async function submit() {
    setPending(true)
    try {
      await notify(api("/api/auth/password", { method: "POST", body: { current_password: form.current, new_password: form.next } }),
        "Password changed. Other signed-in devices were signed out.", () => setForm({ current: "", next: "", confirm: "" }))
    } finally {
      setPending(false)
    }
  }

  return (
    <Panel title="Your account" description={email ? `${email} · ${roles.map((role) => role.replaceAll("_", " ").toLowerCase()).join(", ")}` : undefined}>
      <form method="post" className="grid gap-3" onSubmit={(event) => { event.preventDefault(); if (valid) void submit() }}>
        <div className="grid gap-3 sm:grid-cols-3 sm:items-start">
          <Field label="Current password"><TextInput type="password" autoComplete="current-password" value={form.current} onChange={(event) => setForm({ ...form, current: event.target.value })} /></Field>
          <Field label="New password" hint="At least 8 characters" error={form.next && form.next.length < 8 ? "At least 8 characters" : undefined}>
            <TextInput type="password" autoComplete="new-password" value={form.next} onChange={(event) => setForm({ ...form, next: event.target.value })} />
          </Field>
          <Field label="Repeat new password" error={form.confirm && form.confirm !== form.next ? "Passwords do not match" : undefined}>
            <TextInput type="password" autoComplete="new-password" value={form.confirm} onChange={(event) => setForm({ ...form, confirm: event.target.value })} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" tone="green" disabled={!valid || pending}>{pending ? "Saving…" : "Change password"}</Button>
        </div>
      </form>
    </Panel>
  )
}

function StaffPanel({ selfId }: { selfId?: string }) {
  const staff = useAdminQuery<StaffPage>(keys.staff, "/api/admin/staff")
  const update = useAdminMutation<{ id: string; roles?: string[]; status?: string }>(({ id, ...body }) => ({ path: `/api/admin/staff/${id}`, method: "PATCH", body }), [["staff"]])
  const invite = useAdminMutation<{ email: string; role: string }>((body) => ({ path: "/api/auth/invites", body }), [["staff"]])
  const revoke = useAdminMutation<string>((id) => ({ path: `/api/admin/invites/${id}/revoke` }), [["staff"]])
  const [inviteForm, setInviteForm] = useState({ email: "", role: "JUDGE" })
  const [editing, setEditing] = useState<{ id: string; roles: string[] } | null>(null)

  function run(promise: Promise<unknown>, success: string, after?: () => void) {
    void notify(promise, success, after)
  }

  if (staff.isError) return <Notice tone="red">{errorMessage(staff.error, "Staff could not be loaded.")}</Notice>
  if (!staff.data) return <Bones name="settings-staff" loading>{null}</Bones>
  const roleOptions = staff.data.roles

  return (
    <Bones name="settings-staff" loading={false}>
    <div className="flex flex-col gap-4">
      <Panel title="Invite staff" description="The invite link is emailed and expires after 7 days.">
        <form className="grid gap-3 sm:grid-cols-[minmax(16rem,1fr)_14rem_auto] sm:items-start" onSubmit={(event) => {
          event.preventDefault()
          const email = inviteForm.email.trim()
          run(invite.mutateAsync({ email, role: inviteForm.role }), `Invite sent to ${email}.`, () => setInviteForm({ ...inviteForm, email: "" }))
        }}>
          <Field label="Email"><TextInput type="email" required value={inviteForm.email} placeholder="name@example.com" onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })} /></Field>
          <Field label="Role" hint={ROLE_HELP[inviteForm.role]}>
            <Select value={inviteForm.role} onChange={(event) => setInviteForm({ ...inviteForm, role: event.target.value })}>
              {roleOptions.map((role) => <option key={role} value={role}>{role.replaceAll("_", " ").toLowerCase()}</option>)}
            </Select>
          </Field>
          <FieldAction>
            <Button type="submit" tone="green" disabled={!inviteForm.email.includes("@") || invite.isPending}>{invite.isPending ? "Sending…" : "Send invite"}</Button>
          </FieldAction>
        </form>
        {staff.data.invites.length ? (
          <ul className="admin-stagger mt-4 divide-y divide-border text-sm">
            {staff.data.invites.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{item.email} <Badge>{item.role.replaceAll("_", " ").toLowerCase()}</Badge> <span className="text-xs text-muted-foreground">expires {dateTime(item.expires_at)}</span></span>
                <ConfirmButton confirmLabel="Revoke invite" disabled={revoke.isPending} onConfirm={() => run(revoke.mutateAsync(item.id), "Invite revoked.")}>Revoke</ConfirmButton>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>
      <Panel title="Staff" description="Roles take effect on the person's next request. Disabling signs them out everywhere.">
        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow>{["Name", "Roles", "Status", ""].map((label) => <TableHead key={label} className="h-10 normal-case tracking-tighter">{label}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>
            {staff.data.staff.map((user) => {
              const isSelf = user.id === selfId
              const isEditing = editing?.id === user.id
              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">{user.display_name}{user.owner ? <Badge tone="amber">owner</Badge> : null}</span>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {isEditing ? (
                      <div className="flex flex-wrap gap-2">
                        {roleOptions.map((role) => (
                          <label key={role} className="flex items-center gap-1 text-xs" title={ROLE_HELP[role]}>
                            <input type="checkbox" checked={editing.roles.includes(role)}
                              onChange={(event) => setEditing({ ...editing, roles: event.target.checked ? [...editing.roles, role] : editing.roles.filter((item) => item !== role) })} />
                            {role.replaceAll("_", " ").toLowerCase()}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <span className="flex flex-wrap gap-1">{user.roles.map((role) => <Badge key={role}>{role.replaceAll("_", " ").toLowerCase()}</Badge>)}</span>
                    )}
                  </TableCell>
                  <TableCell><StatusBadge status={user.status} /></TableCell>
                  <TableCell className="text-right">
                    {isSelf ? <span className="text-xs text-muted-foreground">you</span> : user.owner ? (
                      <span className="text-xs text-muted-foreground" title="Only the owner can change this account">protected</span>
                    ) : isEditing ? (
                      <span className="flex justify-end gap-1">
                        <Button tone="green" disabled={!editing.roles.length || update.isPending} onClick={() => run(update.mutateAsync({ id: user.id, roles: editing.roles }), "Roles updated.", () => setEditing(null))}>Save</Button>
                        <Button onClick={() => setEditing(null)}>Cancel</Button>
                      </span>
                    ) : (
                      <span className="flex justify-end gap-1">
                        <Button onClick={() => setEditing({ id: user.id, roles: user.roles })}>Edit roles</Button>
                        {user.status === "ACTIVE" ? (
                          <ConfirmButton confirmLabel="Disable and sign out" disabled={update.isPending} onConfirm={() => run(update.mutateAsync({ id: user.id, status: "DISABLED" }), `${user.display_name} disabled.`)}>Disable</ConfirmButton>
                        ) : (
                          <Button tone="green" disabled={update.isPending} onClick={() => run(update.mutateAsync({ id: user.id, status: "ACTIVE" }), `${user.display_name} re-enabled.`)}>Enable</Button>
                        )}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Panel>
    </div>
    </Bones>
  )
}
