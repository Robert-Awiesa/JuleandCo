"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { api } from "../../_lib/api";

interface Admin {
  _id: string;
  name: string;
  email: string;
  createdAt: string;
}

const inputClass =
  "w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40";
const labelClass = "text-xs uppercase tracking-widest2 text-obsidian/60";

/**
 * Who can get into the dashboard, and changing your own password.
 *
 * There was one administrator, created by the seed, and the only way to change
 * its password was a script on the server. Fine for one person setting a shop
 * up; wrong the moment anyone else needs access, or someone leaves.
 */
export function Administrators() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", email: "", password: "" });
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ["admins"],
    queryFn: () => api.get<Admin[]>("/auth/admins"),
  });

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<{ _id: string; email: string }>("/auth/me"),
  });

  const add = useMutation({
    mutationFn: () => api.post<Admin>("/auth/admins", draft),
    onSuccess: (created) => {
      toast.success(`${created.email} can now sign in`);
      queryClient.invalidateQueries({ queryKey: ["admins"] });
      setDraft({ name: "", email: "", password: "" });
      setAdding(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del<{ message: string }>(`/auth/admins/${id}`),
    onSuccess: (result) => {
      toast.success(result.message);
      queryClient.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const changePassword = useMutation({
    mutationFn: () => api.put<{ message: string }>("/auth/password", passwords),
    onSuccess: () => {
      toast.success("Password changed");
      setPasswords({ currentPassword: "", newPassword: "" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-medium text-obsidian">Who can sign in</h3>
          {!adding && (
            <button
              onClick={() => setAdding(true)}
              className="text-xs uppercase tracking-wide text-gold-dark hover:underline"
            >
              + Add administrator
            </button>
          )}
        </div>

        {isLoading && <p className="text-sm text-obsidian/45">Loading…</p>}

        <ul className="divide-y divide-obsidian/10 rounded border border-obsidian/15">
          {admins.map((admin) => {
            const isMe = admin._id === me?._id;
            return (
              <li key={admin._id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-obsidian">
                    {admin.name}
                    {isMe && <span className="ml-2 text-xs text-obsidian/45">(you)</span>}
                  </p>
                  <p className="truncate text-xs text-obsidian/50">{admin.email}</p>
                </div>

                <button
                  onClick={() => {
                    if (confirm(`Remove ${admin.email}'s access to the dashboard?`)) {
                      remove.mutate(admin._id);
                    }
                  }}
                  // Removing yourself, or the only administrator, would lock the
                  // shop out of its own dashboard with no way back in.
                  disabled={isMe || admins.length <= 1 || remove.isPending}
                  title={
                    isMe
                      ? "Another administrator has to remove your access"
                      : admins.length <= 1
                        ? "Add another administrator before removing this one"
                        : `Remove ${admin.email}`
                  }
                  aria-label={`Remove ${admin.email}`}
                  className="shrink-0 rounded p-2 text-obsidian/40 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-obsidian/40"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            );
          })}
        </ul>

        {adding && (
          <div className="mt-3 space-y-3 rounded border border-obsidian/15 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="admin-name" className={labelClass}>
                  Name
                </label>
                <input
                  id="admin-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="admin-email" className={labelClass}>
                  Email
                </label>
                <input
                  id="admin-email"
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label htmlFor="admin-password" className={labelClass}>
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-obsidian/45">
                At least 8 characters. Tell them to change it once they are in.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => add.mutate()}
                disabled={add.isPending || !draft.name || !draft.email || !draft.password}
                className="rounded bg-obsidian px-4 py-2 text-xs uppercase tracking-wide text-alabaster hover:bg-gold hover:text-obsidian disabled:opacity-40"
              >
                {add.isPending ? "Adding…" : "Add"}
              </button>
              <button
                onClick={() => setAdding(false)}
                className="text-xs uppercase tracking-wide text-obsidian/50 hover:text-obsidian"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="border-t border-obsidian/10 pt-6">
        <h3 className="mb-3 text-sm font-medium text-obsidian">Change your password</h3>
        <div className="grid max-w-md gap-3">
          <div>
            <label htmlFor="current-password" className={labelClass}>
              Current password
            </label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={passwords.currentPassword}
              onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="new-password" className={labelClass}>
              New password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={passwords.newPassword}
              onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <button
              onClick={() => changePassword.mutate()}
              disabled={
                changePassword.isPending || !passwords.currentPassword || !passwords.newPassword
              }
              className="rounded bg-obsidian px-4 py-2 text-xs uppercase tracking-wide text-alabaster hover:bg-gold hover:text-obsidian disabled:opacity-40"
            >
              {changePassword.isPending ? "Changing…" : "Change password"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
