"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import type { AdminOrder, OrderStatus, PaginatedResult } from "../../_lib/types";

const STATUSES: OrderStatus[] = ["pending", "processing", "shipped", "delivered", "cancelled"];

/** Reuses the stock badge tones rather than introducing a fourth colour scheme. */
const STATUS_TONE: Record<OrderStatus, "in" | "low" | "out" | "neutral"> = {
  pending: "low",
  processing: "low",
  shipped: "neutral",
  delivered: "in",
  cancelled: "out",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function describeLine(item: AdminOrder["items"][number]) {
  return [...Object.values(item.options ?? {}), ...Object.values(item.selections ?? {})]
    .filter(Boolean)
    .join(" / ");
}

function OrderRow({ order }: { order: AdminOrder }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tracking, setTracking] = useState(order.trackingNumber ?? "");

  const remove = useMutation({
    mutationFn: () => api.del(`/orders/${order._id}`),
    onSuccess: () => {
      toast.success(`${order.orderNumber} deleted`);
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-stats"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const update = useMutation({
    mutationFn: (patch: { status?: OrderStatus; trackingNumber?: string }) =>
      api.put<AdminOrder>(`/orders/${order._id}/status`, patch),
    onSuccess: (_data, patch) => {
      toast.success(patch.status ? `Marked ${patch.status}` : "Tracking saved");
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-stats"] });
      // Cancelling returns stock, so the catalogue figures move too.
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <tr className="border-b border-obsidian/10">
        <td className="px-4 py-3">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 font-mono text-xs text-obsidian hover:text-gold-dark"
            aria-expanded={open}
          >
            <ChevronDown
              size={14}
              className={open ? "rotate-180 transition-transform" : "transition-transform"}
            />
            {order.orderNumber}
          </button>
        </td>
        <td className="px-4 py-3 text-sm">
          <p className="text-obsidian">{order.customer.name}</p>
          <p className="text-xs text-obsidian/50">{order.customer.email}</p>
        </td>
        <td className="px-4 py-3 text-sm text-obsidian/70">{formatDate(order.createdAt)}</td>
        <td className="px-4 py-3 text-sm text-obsidian/70">
          {order.items.reduce((n, i) => n + i.quantity, 0)}
        </td>
        <td className="px-4 py-3 text-sm font-medium">{formatCurrency(order.totalPrice)}</td>
        <td className="px-4 py-3">
          <Badge tone={STATUS_TONE[order.status]}>{order.status}</Badge>
        </td>
        <td className="px-4 py-3">
          <Select
            value={order.status}
            onValueChange={(status) => update.mutate({ status: status as OrderStatus })}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>
      </tr>

      {open && (
        <tr className="border-b border-obsidian/10 bg-obsidian/[0.02]">
          <td colSpan={7} className="px-4 py-5">
            <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
              <div>
                <p className="mb-3 text-xs uppercase tracking-widest2 text-obsidian/50">Items</p>
                <ul className="space-y-2">
                  {order.items.map((item, i) => (
                    <li key={`${item.product}-${i}`} className="flex justify-between gap-4 text-sm">
                      <span className="text-obsidian">
                        {item.quantity} × {item.name}
                        {describeLine(item) && (
                          <span className="text-obsidian/50"> — {describeLine(item)}</span>
                        )}
                      </span>
                      <span className="shrink-0 text-obsidian/70">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 space-y-1 border-t border-obsidian/10 pt-3 text-sm">
                  <div className="flex justify-between text-obsidian/70">
                    <span>Items</span>
                    <span>{formatCurrency(order.itemsPrice)}</span>
                  </div>
                  <div className="flex justify-between text-obsidian/70">
                    <span>Shipping</span>
                    <span>
                      {order.shippingPrice === 0 ? "Free" : formatCurrency(order.shippingPrice)}
                    </span>
                  </div>
                  <div className="flex justify-between font-medium text-obsidian">
                    <span>Total</span>
                    <span>{formatCurrency(order.totalPrice)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-5 text-sm">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-widest2 text-obsidian/50">
                    Deliver to
                  </p>
                  <p className="text-obsidian">{order.shippingAddress.fullName}</p>
                  <p className="text-obsidian/70">
                    {order.shippingAddress.address}, {order.shippingAddress.city},{" "}
                    {order.shippingAddress.region}
                  </p>
                  <p className="text-obsidian/70">{order.shippingAddress.phone}</p>
                </div>

                <div>
                  <p className="mb-1 text-xs uppercase tracking-widest2 text-obsidian/50">Payment</p>
                  <p className="capitalize text-obsidian/70">
                    {order.paymentMethod.replace("_", " ")} · {order.paymentStatus}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor={`tracking-${order._id}`}
                    className="mb-1 block text-xs uppercase tracking-widest2 text-obsidian/50"
                  >
                    Tracking number
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id={`tracking-${order._id}`}
                      value={tracking}
                      onChange={(e) => setTracking(e.target.value)}
                      placeholder="Add a tracking reference"
                    />
                    <button
                      onClick={() => update.mutate({ trackingNumber: tracking })}
                      disabled={update.isPending || tracking === (order.trackingNumber ?? "")}
                      className="shrink-0 rounded bg-obsidian px-4 text-xs uppercase tracking-wide text-alabaster hover:bg-gold hover:text-obsidian disabled:opacity-40"
                    >
                      Save
                    </button>
                  </div>
                </div>

                {/* Only offered once cancelled: cancelling is what returns the
                    stock, so deleting straight from live would strand it. */}
                {order.status === "cancelled" && (
                  <div className="border-t border-obsidian/10 pt-4">
                    <button
                      onClick={() => {
                        if (confirm(`Permanently delete ${order.orderNumber}?`)) remove.mutate();
                      }}
                      disabled={remove.isPending}
                      className="text-xs uppercase tracking-wide text-obsidian/50 hover:text-red-600 disabled:opacity-40"
                    >
                      Delete this order
                    </button>
                    <p className="mt-1 text-xs text-obsidian/45">
                      Its stock has already been returned to the catalogue.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function OrdersPage() {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), limit: "25" });
  if (status !== "all") params.set("status", status);
  if (search) params.set("search", search);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders", status, search, page],
    queryFn: () => api.get<PaginatedResult<AdminOrder>>(`/orders?${params}`),
  });

  const orders = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-obsidian">Orders</h1>
        <p className="mt-2 max-w-2xl text-sm text-obsidian/60">
          Every order placed through checkout. Changing the status to Cancelled returns its stock to
          the catalogue automatically.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Order number, name or email…"
          className="max-w-xs"
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-obsidian/10 bg-white">
        <table className="w-full text-left">
          <thead className="border-b border-obsidian/10 bg-obsidian/[0.02] text-xs uppercase tracking-wide text-obsidian/50">
            <tr>
              <th className="px-4 py-2">Order</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Placed</th>
              <th className="px-4 py-2">Items</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Update</th>
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
            {!isLoading && orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-14 text-center text-sm text-obsidian/50">
                  {search || status !== "all"
                    ? "No orders match these filters."
                    : "No orders yet. They will appear here the moment a customer checks out."}
                </td>
              </tr>
            )}
            {orders.map((order) => (
              <OrderRow key={order._id} order={order} />
            ))}
          </tbody>
        </table>
      </div>

      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-obsidian/50">
            Page {data.page} of {data.pages} · {data.total} orders
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
