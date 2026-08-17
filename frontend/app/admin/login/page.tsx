"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { loginAdmin } from "../_lib/auth";
import { ApiError } from "../_lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const session = await loginAdmin(email, password);
      if (session.role !== "admin") {
        setError("This account does not have admin access.");
        return;
      }
      router.push("/admin/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-alabaster px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-lg border border-obsidian/10 bg-white p-8"
      >
        <div>
          <h1 className="font-serif text-2xl text-obsidian">Aura & Optic</h1>
          <p className="mt-1 text-xs uppercase tracking-widest2 text-obsidian/50">Admin sign in</p>
        </div>

        {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="space-y-1">
          <label htmlFor="email" className="text-xs uppercase tracking-widest2 text-obsidian/60">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-xs uppercase tracking-widest2 text-obsidian/60">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-obsidian/15 px-3 py-2 text-sm outline-none focus:border-obsidian/40"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-obsidian px-5 py-3 text-xs uppercase tracking-wide text-alabaster hover:bg-gold hover:text-obsidian disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
