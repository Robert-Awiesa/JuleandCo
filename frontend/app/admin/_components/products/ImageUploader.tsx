"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Upload, Images, GripVertical } from "lucide-react";
import { api } from "../../_lib/api";

interface SignResponse {
  timestamp: number;
  signature: string;
  folder: string;
  apiKey: string;
  cloudName: string;
}

interface RecentUpload {
  url: string;
  publicId: string;
}

async function uploadToCloudinary(file: File): Promise<string> {
  const sign = await api.post<SignResponse>("/uploads/sign", {});

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", sign.apiKey);
  formData.append("timestamp", String(sign.timestamp));
  formData.append("signature", sign.signature);
  formData.append("folder", sign.folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error("Image upload failed");
  }

  const data = await res.json();
  return data.secure_url as string;
}

/**
 * Pick from what has already been uploaded. The same shot is often wanted on
 * several colourways of one product, and re-uploading it made a duplicate in
 * Cloudinary for no reason.
 */
function RecentPicker({
  chosen,
  onPick,
  onClose,
}: {
  chosen: string[];
  onPick: (url: string) => void;
  onClose: () => void;
}) {
  const { data: recent = [], isLoading } = useQuery({
    queryKey: ["recent-uploads"],
    queryFn: () => api.get<RecentUpload[]>("/uploads/recent"),
    staleTime: 60_000,
  });

  return (
    <div className="rounded border border-obsidian/15 bg-obsidian/[0.02] p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest2 text-obsidian/60">Recent uploads</p>
        <button type="button" onClick={onClose} className="text-xs text-obsidian/50 hover:text-obsidian">
          Close
        </button>
      </div>

      {isLoading && <p className="text-xs text-obsidian/45">Loading…</p>}
      {!isLoading && recent.length === 0 && (
        <p className="text-xs text-obsidian/45">Nothing uploaded yet.</p>
      )}

      <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
        {recent.map((item) => {
          const used = chosen.includes(item.url);
          return (
            <button
              key={item.publicId}
              type="button"
              onClick={() => onPick(item.url)}
              disabled={used}
              title={used ? "Already used on this product" : "Add to this product"}
              className={
                used
                  ? "h-16 w-16 cursor-not-allowed overflow-hidden rounded border-2 border-gold opacity-40"
                  : "h-16 w-16 overflow-hidden rounded border border-obsidian/10 hover:border-obsidian/50"
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt="" className="h-full w-full object-cover" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ImageUploader({
  images,
  onChange,
  multiple = true,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  multiple?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRecent, setShowRecent] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const urls = await Promise.all(Array.from(files).map(uploadToCloudinary));
      onChange(multiple ? [...images, ...urls] : urls);
      // The picker lists what Cloudinary holds; a shot just uploaded belongs in
      // it immediately, not after its cache window expires.
      queryClient.invalidateQueries({ queryKey: ["recent-uploads"] });
    } catch {
      setError("Upload failed — check your connection and try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeAt(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  /** Reordering matters: the first image is the storefront thumbnail. */
  function moveImage(from: number, to: number) {
    if (from === to) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {images.map((src, i) => (
          <div
            key={src}
            draggable
            onDragStart={() => setDragFrom(i)}
            onDragOver={(e) => {
              // Without preventDefault the drop never fires.
              e.preventDefault();
              setDragOver(i);
            }}
            onDragLeave={() => setDragOver((current) => (current === i ? null : current))}
            onDrop={(e) => {
              e.preventDefault();
              if (dragFrom !== null) moveImage(dragFrom, i);
              setDragFrom(null);
              setDragOver(null);
            }}
            onDragEnd={() => {
              setDragFrom(null);
              setDragOver(null);
            }}
            className={
              dragOver === i && dragFrom !== i
                ? "group relative h-24 w-24 cursor-grab overflow-hidden rounded border-2 border-gold"
                : "group relative h-24 w-24 cursor-grab overflow-hidden rounded border border-obsidian/10"
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />

            <span className="absolute left-1 top-1 rounded bg-obsidian/60 p-0.5 text-alabaster opacity-0 transition-opacity group-hover:opacity-100">
              <GripVertical size={12} />
            </span>

            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label="Remove image"
              className="absolute right-1 top-1 rounded-full bg-obsidian/70 p-1 text-alabaster opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X size={12} />
            </button>

            {i === 0 && (
              <span className="absolute bottom-0 w-full bg-obsidian/70 py-0.5 text-center text-[10px] uppercase text-alabaster">
                Primary
              </span>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded border border-dashed border-obsidian/25 text-obsidian/50 hover:border-obsidian/50 hover:text-obsidian disabled:opacity-50"
        >
          <Upload size={18} />
          <span className="text-[10px] uppercase">{uploading ? "Uploading…" : "Add image"}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowRecent((open) => !open)}
          className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded border border-dashed border-obsidian/25 text-obsidian/50 hover:border-obsidian/50 hover:text-obsidian"
        >
          <Images size={18} />
          <span className="text-center text-[10px] uppercase leading-tight">Reuse a shot</span>
        </button>
      </div>

      {images.length > 1 && (
        <p className="text-xs text-obsidian/45">
          Drag to reorder — the first image is the one customers see on the shop grid.
        </p>
      )}

      {showRecent && (
        <RecentPicker
          chosen={images}
          onPick={(url) => onChange(multiple ? [...images, url] : [url])}
          onClose={() => setShowRecent(false)}
        />
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />
    </div>
  );
}
