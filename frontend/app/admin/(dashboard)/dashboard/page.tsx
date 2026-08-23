"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, PackageX, Clock, Star, Truck } from "lucide-react";
import { api } from "../../_lib/api";
import { formatCurrency } from "../../_lib/format";
import type { OrderStats } from "../../_lib/types";

interface ProductStats {
  total: number;
  published: number;
  drafts: number;
  outOfStock: number;
  lowStock: number;
  retailValue: number;
  costValue: number;
  productsWithCost: number;
}

interface CustomerStats {
  customers: number;
  returning: number;
  averageSpend: number;
}

type Reason = "outOfStock" | "lowStock" | "readyToPublish" | "incomplete";

interface AttentionItem {
  _id: string;
  name: string;
  stock: number;
  reason: Reason;
  detail: string;
}

const REASON_STYLE: Record<Reason, { tone: string; label: string }> = {
  outOfStock: { tone: "text-red-600", label: "Sold out" },
  lowStock: { tone: "text-amber-600", label: "Low stock" },
  readyToPublish: { tone: "text-green-700", label: "Ready" },
  incomplete: { tone: "text-red-600", label: "Incomplete" },
};

/**
 * One figure.
 *
 * `loading` is per tile rather than shared: the three queries land at different
 * times, and a shared flag meant Revenue rendered "GH₵0.00" while its own
 * request was still in flight — a wrong number presented as fact.
 *
 * `href` is not decoration. Every figure here is a question whose answer lives
 * on another screen, and reading "Out of stock: 3" then navigating and
 * re-finding those three by hand is work the number should have saved.
 */
function Tile({
  label,
  value,
  href,
  loading,
  hint,
  trend,
}: {
  label: string;
  value: string;
  href?: string;
  loading?: boolean;
  hint?: string;
  trend?: { direction: "up" | "down"; text: string } | null;
}) {
  const body = (
    <>
      <p className="text-xs uppercase tracking-widest2 text-obsidian/50">{label}</p>
      <p className="mt-2 font-serif text-2xl text-obsidian">{loading ? "…" : value}</p>
      {trend && !loading && (
        <p
          className={
            trend.direction === "up"
              ? "mt-1 flex items-center gap-1 text-xs text-green-700"
              : "mt-1 flex items-center gap-1 text-xs text-obsidian/50"
          }
        >
          {trend.direction === "up" ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {trend.text}
        </p>
      )}
      {hint && !loading && !trend && <p className="mt-1 text-xs text-obsidian/45">{hint}</p>}
    </>
  );

  const className =
    "block rounded-lg border border-obsidian/10 bg-white p-5 transition-colors" +
    (href ? " hover:border-obsidian/30" : "");

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xs uppercase tracking-widest2 text-obsidian/45">{title}</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{children}</div>
    </section>
  );
}

export default function DashboardPage() {
  // Figures are counted by the database. This page used to fetch the whole
  // catalogue and count it in the browser, which was fine at two dozen products
  // and silently wrong past the page limit.
  const products = useQuery({
    queryKey: ["product-stats"],
    queryFn: () => api.get<ProductStats>("/products/stats"),
  });

  const orders = useQuery({
    queryKey: ["order-stats"],
    queryFn: () => api.get<OrderStats>("/orders/stats"),
  });

  const customers = useQuery({
    queryKey: ["customer-stats"],
    queryFn: () => api.get<CustomerStats>("/customers/stats"),
  });

  const attention = useQuery({
    queryKey: ["product-attention"],
    queryFn: () => api.get<AttentionItem[]>("/products/attention"),
  });

  const reviews = useQuery({
    queryKey: ["reviews", "pending-count"],
    queryFn: () => api.get<{ pending: number }>("/reviews?status=pending&limit=1"),
  });

  const p = products.data;
  const o = orders.data;

  /** This month against last, so revenue is a figure you can act on. */
  const trend = (() => {
    if (!o) return null;
    const now = o.month.revenue;
    const before = o.lastMonth.revenue;
    if (before === 0) return now > 0 ? { direction: "up" as const, text: "first month of sales" } : null;
    const change = Math.round(((now - before) / before) * 100);
    return {
      direction: change >= 0 ? ("up" as const) : ("down" as const),
      text: `${change >= 0 ? "+" : ""}${change}% on last month`,
    };
  })();

  const pendingReviews = reviews.data?.pending ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl text-obsidian">Dashboard</h1>
        <p className="mt-2 text-sm text-obsidian/60">
          Every figure here links to the screen that does something about it.
        </p>
      </div>

      <Section title="Trade">
        <Tile
          label="Revenue this month"
          value={formatCurrency(o?.month.revenue ?? 0)}
          loading={orders.isLoading}
          trend={trend}
          href="/admin/orders"
        />
        <Tile
          label="Orders this month"
          value={String(o?.month.orders ?? 0)}
          loading={orders.isLoading}
          hint={`${o?.orders ?? 0} all time`}
          href="/admin/orders"
        />
        <Tile
          label="Avg. order"
          value={formatCurrency(o?.averageOrderValue ?? 0)}
          loading={orders.isLoading}
          hint="all time"
        />
        <Tile
          label="To fulfil"
          value={String(o?.unfulfilled ?? 0)}
          loading={orders.isLoading}
          href="/admin/orders"
        />
      </Section>

      <Section title="Catalogue">
        <Tile
          label="Live on the shop"
          value={String(p?.published ?? 0)}
          loading={products.isLoading}
          href="/admin/products"
        />
        <Tile
          label="Drafts"
          value={String(p?.drafts ?? 0)}
          loading={products.isLoading}
          hint="not visible to customers"
          href="/admin/products"
        />
        <Tile
          label="Out of stock"
          value={String(p?.outOfStock ?? 0)}
          loading={products.isLoading}
          hint="live but unbuyable"
          href="/admin/products"
        />
        <Tile
          label="Stock at retail"
          value={formatCurrency(p?.retailValue ?? 0)}
          loading={products.isLoading}
          hint={
            p && p.productsWithCost > 0
              ? `${formatCurrency(p.costValue)} at cost`
              : "add cost prices to see what it cost you"
          }
        />
      </Section>

      <Section title="Customers">
        <Tile
          label="Customers"
          value={String(customers.data?.customers ?? 0)}
          loading={customers.isLoading}
          href="/admin/customers"
        />
        <Tile
          label="Returning"
          value={String(customers.data?.returning ?? 0)}
          loading={customers.isLoading}
          hint="bought more than once"
          href="/admin/customers"
        />
        <Tile
          label="Avg. spend"
          value={formatCurrency(customers.data?.averageSpend ?? 0)}
          loading={customers.isLoading}
          hint="per customer"
        />
        <Tile
          label="Reviews to read"
          value={String(pendingReviews)}
          loading={reviews.isLoading}
          hint={pendingReviews > 0 ? "not on the site yet" : undefined}
          href="/admin/reviews"
        />
      </Section>

      {/* Queues: things waiting on a person, each a link to the work itself. */}
      {(o?.awaitingDelivery ?? 0) > 0 && (
        <Link
          href="/admin/orders"
          className="flex items-center gap-3 rounded-lg border border-gold/40 bg-gold/5 px-5 py-4 text-sm text-obsidian transition-colors hover:border-gold"
        >
          <Truck size={16} className="shrink-0 text-gold-dark" />
          <span>
            <strong>{o?.awaitingDelivery}</strong>{" "}
            {o?.awaitingDelivery === 1 ? "order needs" : "orders need"} a delivery charge agreeing
            with the customer.
          </span>
        </Link>
      )}

      <section className="rounded-lg border border-obsidian/10 bg-white">
        <div className="flex items-center justify-between border-b border-obsidian/10 px-5 py-4">
          <h2 className="text-sm font-medium text-obsidian">Needs attention</h2>
          {attention.data && attention.data.length > 0 && (
            <span className="text-xs text-obsidian/45">{attention.data.length} items</span>
          )}
        </div>

        <div className="divide-y divide-obsidian/10">
          {attention.isLoading && (
            <p className="px-5 py-6 text-sm text-obsidian/50">Loading…</p>
          )}

          {attention.data?.map((item) => {
            const style = REASON_STYLE[item.reason];
            return (
              <Link
                key={`${item.reason}-${item._id}`}
                href={`/admin/products/${item._id}/edit`}
                className="flex items-center justify-between gap-4 px-5 py-3 text-sm hover:bg-obsidian/5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-obsidian">{item.name}</span>
                  <span className="block text-xs text-obsidian/45">{item.detail}</span>
                </span>
                <span className={`shrink-0 text-xs uppercase tracking-wide ${style.tone}`}>
                  {style.label}
                </span>
              </Link>
            );
          })}

          {!attention.isLoading && attention.data?.length === 0 && (
            <p className="px-5 py-6 text-sm text-obsidian/50">
              Nothing needs doing — everything live is in stock and complete.
            </p>
          )}
        </div>
      </section>

      {/* Quick paths to the two queues that are not products. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/admin/orders"
          className="flex items-center gap-3 rounded-lg border border-obsidian/10 bg-white px-5 py-4 text-sm text-obsidian/70 hover:border-obsidian/30 hover:text-obsidian"
        >
          <Clock size={15} /> Orders to fulfil
        </Link>
        <Link
          href="/admin/reviews"
          className="flex items-center gap-3 rounded-lg border border-obsidian/10 bg-white px-5 py-4 text-sm text-obsidian/70 hover:border-obsidian/30 hover:text-obsidian"
        >
          <Star size={15} /> Reviews to read
        </Link>
        <Link
          href="/admin/products/new"
          className="flex items-center gap-3 rounded-lg border border-obsidian/10 bg-white px-5 py-4 text-sm text-obsidian/70 hover:border-obsidian/30 hover:text-obsidian"
        >
          <PackageX size={15} /> Add a product
        </Link>
      </div>
    </div>
  );
}
