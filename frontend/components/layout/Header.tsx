"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { Heart, Menu, Search, ShoppingBag, X } from "lucide-react";
import { primaryNav, megaMenu } from "@/lib/navigation";
import { MegaMenu } from "./MegaMenu";
import { SearchModal } from "./SearchModal";
import { useCartStore } from "@/store/useCartStore";
import { useWishlistStore } from "@/store/useWishlistStore";
import { cn } from "@/lib/utils";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [activeMega, setActiveMega] = useState<keyof typeof megaMenu | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const cartOpen = useCartStore((s) => s.open);
  const itemCount = useCartStore((s) => s.itemCount());
  const wishlistCount = useWishlistStore((s) => s.productIds.length);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        onMouseLeave={() => setActiveMega(null)}
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-500",
          scrolled || activeMega
            ? "bg-alabaster/80 backdrop-blur-md shadow-soft border-b border-obsidian/5"
            : "bg-transparent"
        )}
      >
        <div className="container-elevated flex h-20 items-center justify-between">
          <Link href="/" className="font-serif text-2xl tracking-tight">
            Aura &amp; Optic
          </Link>

          <nav className="hidden items-center gap-9 lg:flex">
            {primaryNav.map((item) => (
              <div
                key={item.label}
                onMouseEnter={() => setActiveMega(item.mega ?? null)}
                className="relative"
              >
                <Link
                  href={item.href}
                  className="text-sm uppercase tracking-wide text-obsidian/80 transition-colors hover:text-obsidian"
                >
                  {item.label}
                </Link>
              </div>
            ))}
          </nav>

          <div className="flex items-center gap-5">
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="text-obsidian/80 hover:text-obsidian"
            >
              <Search size={19} />
            </button>
            <Link
              href="/account/wishlist"
              aria-label="Wishlist"
              className="relative hidden text-obsidian/80 hover:text-obsidian sm:block"
            >
              <Heart size={19} />
              {wishlistCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center bg-gold text-[10px] text-obsidian">
                  {wishlistCount}
                </span>
              )}
            </Link>
            <button
              onClick={cartOpen}
              aria-label="Open cart"
              className="relative text-obsidian/80 hover:text-obsidian"
            >
              <ShoppingBag size={19} />
              {itemCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center bg-gold text-[10px] text-obsidian">
                  {itemCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="text-obsidian/80 hover:text-obsidian lg:hidden"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {activeMega && <MegaMenu section={megaMenu[activeMega]} onNavigate={() => setActiveMega(null)} />}
        </AnimatePresence>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-[90] bg-obsidian/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              className="fixed right-0 top-0 z-[91] h-full w-[85%] max-w-sm bg-alabaster p-6"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="mb-8 flex items-center justify-between">
                <span className="font-serif text-xl">Menu</span>
                <button onClick={() => setMobileOpen(false)} aria-label="Close menu">
                  <X size={20} />
                </button>
              </div>
              <ul className="space-y-5">
                {primaryNav.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className="text-lg font-serif"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
