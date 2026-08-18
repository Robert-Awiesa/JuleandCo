"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { logoutAdmin } from "../_lib/auth";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await logoutAdmin();
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-obsidian/70 hover:text-obsidian">
      <LogOut size={16} />
      Log out
    </button>
  );
}
