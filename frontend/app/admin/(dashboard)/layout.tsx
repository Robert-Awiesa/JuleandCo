import { Sidebar } from "../_components/Sidebar";
import { LogoutButton } from "../_components/LogoutButton";

export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-obsidian/10 bg-alabaster px-8 py-4">
          <span className="text-sm uppercase tracking-widest2 text-obsidian/50">Store Management</span>
          <LogoutButton />
        </header>
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
