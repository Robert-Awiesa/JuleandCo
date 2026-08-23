"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { api } from "../../_lib/api";
import { FieldEditor, type FieldSpec } from "../../_components/content/FieldEditor";
import { useInvalidate } from "../../_lib/invalidate";

interface SlotDescriptor {
  slot: string;
  label: string;
  description: string;
  kind: "list" | "group";
  itemLabel?: string;
  itemTitle?: string;
  fields: FieldSpec[];
  updatedAt: string | null;
  updatedBy: string | null;
}

/** Where each slot shows up, so you can go and look at what you changed. */
const PREVIEW: Record<string, string> = {
  "hero.slides": "/",
  "home.collections": "/",
  "home.testimonials": "/",
  "nav.megaMenu": "/",
  "layout.footer": "/",
  "page.ethos": "/ethos",
  "site.seo": "/",
};

function SlotEditor({ descriptor }: { descriptor: SlotDescriptor }) {
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

export default function ContentPage() {
  const { data: slots = [], isLoading } = useQuery({
    queryKey: ["content-slots"],
    queryFn: () => api.get<SlotDescriptor[]>("/content/meta/slots"),
  });

  const [active, setActive] = useState<string | null>(null);
  const current = slots.find((s) => s.slot === active) ?? slots[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-obsidian">Content</h1>
        <p className="mt-2 max-w-2xl text-sm text-obsidian/60">
          The words and photographs on the public site — the hero, the homepage edits, client
          quotes, the menu, the footer and the ethos page. Saving puts a change live immediately;
          there is nothing to publish or deploy.
        </p>
      </div>

      {isLoading && <p className="text-sm text-obsidian/45">Loading…</p>}

      {slots.length > 0 && (
        <div className="flex flex-col gap-6 lg:flex-row">
          <nav className="w-full shrink-0 lg:w-64">
            <ul className="space-y-1">
              {slots.map((slot) => {
                const isActive = current?.slot === slot.slot;
                return (
                  <li key={slot.slot}>
                    <button
                      onClick={() => setActive(slot.slot)}
                      className={
                        isActive
                          ? "w-full rounded bg-obsidian px-3 py-2 text-left text-sm text-alabaster"
                          : "w-full rounded px-3 py-2 text-left text-sm text-obsidian/70 hover:bg-obsidian/5 hover:text-obsidian"
                      }
                    >
                      {slot.label}
                      {!slot.updatedAt && (
                        <span
                          className={
                            isActive
                              ? "ml-2 text-[10px] uppercase text-alabaster/60"
                              : "ml-2 text-[10px] uppercase text-obsidian/35"
                          }
                        >
                          original
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {current && (
            <section className="min-w-0 flex-1 rounded-lg border border-obsidian/10 bg-white p-5">
              <div className="mb-5 border-b border-obsidian/10 pb-4">
                <h2 className="font-serif text-xl text-obsidian">{current.label}</h2>
                <p className="mt-1.5 text-sm text-obsidian/60">{current.description}</p>
              </div>

              <SlotEditor key={current.slot} descriptor={current} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
