"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../_lib/api";
import { SlotEditor, type SlotDescriptor } from "../../_components/content/SlotEditor";

export default function ContentPage() {
  const { data: slots = [], isLoading } = useQuery({
    queryKey: ["content-slots"],
    queryFn: () => api.get<SlotDescriptor[]>("/content/meta/slots"),
    select: (all) => all.filter((slot) => slot.group !== "settings"),
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
