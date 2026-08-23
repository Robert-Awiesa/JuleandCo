"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { api } from "../../_lib/api";
import { useInvalidate } from "../../_lib/invalidate";
import { FieldEditor, type FieldSpec } from "./FieldEditor";

/**
 * One slot's editor, shared by /admin/content and /admin/settings.
 *
 * It lived in the Content route file until Next refused the build: a route
 * module may only export the handful of names the framework recognises, so
 * anything two screens share has to live in a component of its own.
 */

export interface SlotDescriptor {
  slot: string;
  label: string;
  description: string;
  kind: "list" | "group";
  itemLabel?: string;
  itemTitle?: string;
  group: "content" | "settings";
  fields: FieldSpec[];
  updatedAt: string | null;
  updatedBy: string | null;
}

/** Where each slot shows up, so you can go and look at what you changed. */
export const PREVIEW: Record<string, string> = {
  "hero.slides": "/",
  "home.collections": "/",
  "home.testimonials": "/",
  "nav.megaMenu": "/",
  "layout.footer": "/",
  "page.ethos": "/ethos",
  "site.seo": "/",
  "store.shipping": "/checkout",
  "store.contact": "/",
};

export function SlotEditor({ descriptor }: { descriptor: SlotDescriptor }) {
  const invalidate = useInvalidate();
  const [draft, setDraft] = useState<unknown>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["content", descriptor.slot],
    queryFn: () => api.get<{ slot: string; data: unknown }>(`/content/${descriptor.slot}`),
  });

  // The editor is uncontrolled from the query after the first load, so typing
  // is not thrown away by a background refetch.
  useEffect(() => {
    if (data) setDraft(data.data);
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.put(`/content/${descriptor.slot}`, { data: draft }),
    onSuccess: () => {
      toast.success(`${descriptor.label} saved — live on the site now`);
      invalidate.content();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reset = useMutation({
    mutationFn: () => api.del(`/content/${descriptor.slot}`),
    onSuccess: () => {
      toast.success(`${descriptor.label} restored to the original content`);
      invalidate.content();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || draft === null) {
    return <p className="text-sm text-obsidian/45">Loading…</p>;
  }

  const listSpec: FieldSpec = {
    key: descriptor.slot,
    label: descriptor.label,
    type: "list",
    fields: descriptor.fields,
    itemLabel: descriptor.itemLabel,
    itemTitle: descriptor.itemTitle,
  };

  return (
    <div className="space-y-5">
      {descriptor.kind === "list" ? (
        <FieldEditor spec={listSpec} value={draft} onChange={setDraft} />
      ) : (
        <div className="space-y-4">
          {descriptor.fields.map((field) => (
            <FieldEditor
              key={field.key}
              spec={field}
              value={(draft as Record<string, unknown>)?.[field.key]}
              onChange={(next) =>
                setDraft({ ...(draft as Record<string, unknown>), [field.key]: next })
              }
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-obsidian/10 pt-4">
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="rounded bg-obsidian px-6 py-2.5 text-xs uppercase tracking-wide text-alabaster hover:bg-gold hover:text-obsidian disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : "Save changes"}
        </button>

        <a
          href={PREVIEW[descriptor.slot] || "/"}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide text-obsidian/60 hover:text-obsidian"
        >
          View on the site <ExternalLink size={13} />
        </a>

        {descriptor.updatedAt && (
          <button
            onClick={() => {
              if (confirm(`Discard your edits to ${descriptor.label} and restore the original?`)) {
                reset.mutate();
              }
            }}
            disabled={reset.isPending}
            className="ml-auto text-xs uppercase tracking-wide text-obsidian/50 hover:text-red-600 disabled:opacity-40"
          >
            Restore original
          </button>
        )}
      </div>
    </div>
  );
}

