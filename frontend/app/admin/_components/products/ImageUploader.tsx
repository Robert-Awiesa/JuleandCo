"use client";

import { useRef, useState } from "react";
import { X, Upload } from "lucide-react";
import { api } from "../../_lib/api";

interface SignResponse {
  timestamp: number;
  signature: string;
  folder: string;
  apiKey: string;
  cloudName: string;
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
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const urls = await Promise.all(Array.from(files).map(uploadToCloudinary));
      onChange(multiple ? [...images, ...urls] : urls);
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {images.map((src, i) => (
          <div key={src} className="group relative h-24 w-24 overflow-hidden rounded border border-obsidian/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removeAt(i)}
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
      </div>
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
