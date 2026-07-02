"use client";

import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLES, type Role } from "@/lib/auth/roles";

import { setMemberRoleAction } from "./team-actions";

const SELECT_CLASS =
  "border-input bg-background h-9 rounded-md border px-2 text-sm";

/** Inline role picker for an existing member (admin only). */
export function RoleSelect({
  clerkUserId,
  role,
}: {
  clerkUserId: string;
  role: Role;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      className={SELECT_CLASS}
      defaultValue={role}
      disabled={pending}
      aria-label={`Role for ${clerkUserId}`}
      onChange={(event) => {
        const nextRole = event.target.value;
        startTransition(async () => {
          try {
            await setMemberRoleAction({ clerkUserId, role: nextRole });
            toast.success("Role updated.");
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Could not update role.",
            );
          }
        });
      }}
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  );
}

/** Add a member (or set a role) by Clerk user id (admin only). */
export function AddMemberForm() {
  const [clerkUserId, setClerkUserId] = useState("");
  const [role, setRole] = useState<Role>("creator");
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const id = clerkUserId.trim();
    if (!id) {
      toast.error("Enter a user id.");
      return;
    }
    startTransition(async () => {
      try {
        await setMemberRoleAction({ clerkUserId: id, role });
        toast.success("Member saved.");
        setClerkUserId("");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not save member.",
        );
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
      <div className="flex-1 space-y-1">
        <label htmlFor="memberId" className="text-xs font-medium">
          Clerk user id
        </label>
        <Input
          id="memberId"
          value={clerkUserId}
          onChange={(event) => setClerkUserId(event.target.value)}
          placeholder="user_…"
        />
      </div>
      <select
        className={SELECT_CLASS}
        value={role}
        aria-label="Role"
        onChange={(event) => setRole(event.target.value as Role)}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save member"}
      </Button>
    </form>
  );
}
