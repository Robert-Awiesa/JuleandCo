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

/** Product shots and site imagery are separate libraries. */
export type UploadFolder = "products" | "content";

interface RecentUpload {
  url: string;
  publicId: string;
}

/**
 * The file goes straight from the browser to Cloudinary — the API only signs
 * the request and never sees the image itself.
 *
 * That matters on a serverless deployment: an upload routed through the
 * function would hit the platform's request-body limit, which is well below the
 * size of an ordinary photograph off a camera.
 */
async function uploadToCloudinary(file: File, folder: UploadFolder): Promise<string> {
  const sign = await api.post<SignResponse>("/uploads/sign", { folder });

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
    /**
     * Cloudinary says exactly what was wrong; this used to throw away the
     * reason and report "Image upload failed", which is no help at all to
     * someone uploading a real catalogue for the first time.
     *
     * By far the most common rejection is the file being over the account's
     * size limit, so that one is named in plain terms.
     */
    const body = await res.json().catch(() => ({}));
    const reason: string = body?.error?.message || `Cloudinary refused it (${res.status})`;

    const tooBig = /file size|maximum.*bytes|too large/i.test(reason);
    throw new Error(
      tooBig
        ? `"${file.name}" is too large for your Cloudinary plan. Export it around 2400px wide and try again.`
        : `"${file.name}" was not accepted — ${reason}`
    );
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
  folder,
  onPick,
  onClose,
}: {
  chosen: string[];
  folder: UploadFolder;
  onPick: (url: string) => void;
  onClose: () => void;
}) {
  const { data: recent = [], isLoading } = useQuery({
    queryKey: ["recent-uploads", folder],
    queryFn: () => api.get<RecentUpload[]>(`/uploads/recent?folder=${folder}`),
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
  folder = "products",
}: {
  images: string[];
  onChange: (images: string[]) => void;
  multiple?: boolean;
  /** Which Cloudinary library this belongs to. Site imagery is not a product. */
  folder?: UploadFolder;
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
      // Wrapped rather than passed by reference: `map` supplies the index as a
      // second argument, which would arrive here as the folder.
      const urls = await Promise.all(
        Array.from(files).map((file) => uploadToCloudinary(file, folder))
      );
      onChange(multiple ? [...images, ...urls] : urls);
      // The picker lists what Cloudinary holds; a shot just uploaded belongs in
      // it immediately, not after its cache window expires.
      queryClient.invalidateQueries({ queryKey: ["recent-uploads", folder] });
    } catch (err) {
      // Show what actually went wrong. This used to replace every failure with
      // "check your connection", including "that file is too large", which sent
      // people looking at their wifi instead of their photograph.
      setError(
        err instanceof Error
          ? err.message
          : "Upload failed — check your connection and try again."
      );
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
          folder={folder}
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
