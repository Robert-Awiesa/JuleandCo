"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/admin-ui/badge";
import { Input } from "@/components/admin-ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/admin-ui/select";
import { api } from "../../_lib/api";
import { formatCurrency } from "../../_lib/format";
import type { AdminOrder, PaginatedResult } from "../../_lib/types";

interface Customer {
  email: string;
  name: string;
  phone: string;
  lastCity?: string;
  lastRegion?: string;
  orders: number;
  cancelled: number;
  spent: number;
  items: number;
  firstOrder: string;
  lastOrder: string;
}

interface CustomerDetail {
  email: string;
  name: string;
  phone: string;
  orders: AdminOrder[];
  summary: { orders: number; cancelled: number; spent: number; firstOrder: string; lastOrder: string };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** The orders behind a row, fetched only when the row is opened. */
function CustomerOrders({ email }: { email: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["customer", email],
    queryFn: () => api.get<CustomerDetail>(`/customers/${encodeURIComponent(email)}`),
  });

  if (isLoading) return <p className="text-sm text-obsidian/45">Loading…</p>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs uppercase tracking-widest2 text-obsidian/50">Orders</p>
        <ul className="space-y-1.5">
          {data.orders.map((order) => (
            <li key={order._id} className="flex flex-wrap justify-between gap-3 text-sm">
              <span className="font-mono text-xs text-obsidian/70">{order.orderNumber}</span>
              <span className="text-obsidian/60">{formatDate(order.createdAt)}</span>
              <span className="capitalize text-obsidian/60">{order.status}</span>
              <span
                className={
                  order.status === "cancelled"
                    ? "numeric text-obsidian/40 line-through"
                    : "numeric text-obsidian"
                }
              >
                {formatCurrency(order.totalPrice)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-obsidian/10 pt-3 text-sm text-obsidian/60">
        Last delivered to {data.orders[0]?.shippingAddress.address},{" "}
        {data.orders[0]?.shippingAddress.city}
      </div>
    </div>
  );
}

function CustomerRow({ customer }: { customer: Customer }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr className="border-b border-obsidian/10">
        <td className="px-4 py-3">
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex items-center gap-2 text-left text-sm text-obsidian hover:text-gold-dark"
          >
            <ChevronDown
              size={14}
              className={open ? "rotate-180 transition-transform" : "transition-transform"}
            />
            <span>
              {customer.name}
              <span className="block text-xs text-obsidian/50">{customer.email}</span>
            </span>
          </button>
        </td>
        <td className="px-4 py-3 text-sm text-obsidian/70">{customer.phone}</td>
        <td className="px-4 py-3 text-sm text-obsidian/70">
          {customer.lastCity || "—"}
          {customer.lastRegion ? `, ${customer.lastRegion}` : ""}
        </td>
        <td className="px-4 py-3 text-sm">
          {customer.orders}
          {customer.cancelled > 0 && (
            <span className="ml-1.5 text-xs text-obsidian/45">
              ({customer.cancelled} cancelled)
            </span>
          )}
        </td>
        <td className="px-4 py-3 numeric text-sm font-medium">{formatCurrency(customer.spent)}</td>
        <td className="px-4 py-3 text-sm text-obsidian/70">{formatDate(customer.lastOrder)}</td>
        <td className="px-4 py-3">
          {customer.orders > 1 ? (
            <Badge tone="in">Returning</Badge>
          ) : (
            <Badge tone="neutral">First order</Badge>
          )}
        </td>
      </tr>

      {open && (
        <tr className="border-b border-obsidian/10 bg-obsidian/[0.02]">
          <td colSpan={7} className="px-4 py-5">
            <CustomerOrders email={customer.email} />
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * Who buys, drawn from the orders they placed.
 *
 * There is no customer account on the storefront — checkout is guest-only — so
 * a person exists here because they bought something. Email is the identity: a
 * name is typed differently each time, but the address a receipt goes to has to
 * be right.
 */
export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("spent");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), limit: "25", sort });
  if (search) params.set("search", search);

  const { data, isLoading } = useQuery({
    queryKey: ["customers", search, sort, page],
    queryFn: () => api.get<PaginatedResult<Customer>>(`/customers?${params}`),
  });

  const customers = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-obsidian">Customers</h1>
        <p className="mt-2 max-w-2xl text-sm text-obsidian/60">
          Everyone who has ordered. There are no accounts to manage — checkout is guest-only, so
          this is built from the orders themselves and cannot drift from what was actually bought.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Name, email or phone…"
          className="max-w-xs"
        />
        <Select
          value={sort}
          onValueChange={(v) => {
            setSort(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="spent">Most spent</SelectItem>
            <SelectItem value="orders">Most orders</SelectItem>
            <SelectItem value="recent">Most recent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-obsidian/10 bg-white">
        <table className="w-full text-left">
          <thead className="border-b border-obsidian/10 bg-obsidian/[0.02] text-xs uppercase tracking-wide text-obsidian/50">
            <tr>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Last delivered to</th>
              <th className="px-4 py-2">Orders</th>
              <th className="px-4 py-2">Spent</th>
              <th className="px-4 py-2">Last order</th>
              <th className="px-4 py-2">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-obsidian/50">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && customers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-14 text-center text-sm text-obsidian/50">
                  {search
                    ? "Nobody matches that."
                    : "No customers yet. Anyone who checks out will appear here."}
                </td>
              </tr>
            )}
            {customers.map((customer) => (
              <CustomerRow key={customer.email} customer={customer} />
            ))}
          </tbody>
        </table>
      </div>

      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-obsidian/50">
            Page {data.page} of {data.pages} · {data.total} customers
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={data.page <= 1}
              className="rounded border border-obsidian/20 px-4 py-2 text-xs uppercase tracking-wide disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={data.page >= data.pages}
              className="rounded border border-obsidian/20 px-4 py-2 text-xs uppercase tracking-wide disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
