"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-alabaster px-4">
      <Image
        src="/images/brand/watermark-mark.png"
        alt=""
        aria-hidden="true"
        width={1200}
        height={374}
        className="pointer-events-none absolute left-1/2 top-1/2 w-[130vw] max-w-none -translate-x-1/2 -translate-y-1/2 select-none sm:w-[70vw]"
      />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm space-y-5 rounded-lg border border-obsidian/10 bg-white p-8 shadow-soft"
      >
        <div className="flex flex-col items-center text-center">
          <Image
            src="/images/brand/logo-header.png"
            alt="JULES & CO"
            width={599}
            height={320}
            priority
            className="h-14 w-auto"
          />
          <p className="mt-3 text-xs uppercase tracking-widest2 text-obsidian/50">Admin sign in</p>
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
