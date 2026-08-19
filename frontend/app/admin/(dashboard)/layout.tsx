import Image from "next/image";
import { Sidebar } from "../_components/Sidebar";
import { LogoutButton } from "../_components/LogoutButton";

export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="relative flex-1 overflow-hidden">
        <Image
          src="/images/brand/watermark-mark.png"
          alt=""
          aria-hidden="true"
          width={1200}
          height={374}
          priority
          className="pointer-events-none fixed right-[-8vw] top-1/3 w-[45vw] max-w-xl select-none"
        />
        <header className="relative flex items-center justify-between border-b border-obsidian/10 bg-alabaster/90 px-8 py-4 backdrop-blur-sm">
          <span className="text-sm uppercase tracking-widest2 text-obsidian/50">Store Management</span>
          <LogoutButton />
        </header>
        <main className="relative p-8">{children}</main>
      </div>
    </div>
  );
}
