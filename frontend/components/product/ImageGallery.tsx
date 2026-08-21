"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface ImageGalleryProps {
  images: string[];
  name: string;
}

export function ImageGallery({ images, name }: ImageGalleryProps) {
  const [active, setActive] = useState(0);
  const [zoomStyle, setZoomStyle] = useState<React.CSSProperties>({});
  const [zooming, setZooming] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomStyle({ transformOrigin: `${x}% ${y}%` });
  };

  return (
    <div className="flex flex-col-reverse gap-4 sm:flex-row">
      <div className="flex shrink-0 gap-3 sm:sticky sm:top-28 sm:h-fit sm:flex-col">
        {images.map((img, i) => (
          <button
            key={img + i}
            onClick={() => setActive(i)}
            className={cn(
              "relative h-20 w-16 shrink-0 overflow-hidden border transition-colors",
              active === i ? "border-line-strong" : "border-line hover:border-ink/40"
            )}
          >
            <Image src={img} alt={`${name} thumbnail ${i + 1}`} fill sizes="64px" className="object-cover" />
          </button>
        ))}
      </div>

      <div
        className="relative aspect-[3/4] flex-1 cursor-zoom-in overflow-hidden bg-surface-tile"
        onMouseEnter={() => setZooming(true)}
        onMouseLeave={() => setZooming(false)}
        onMouseMove={handleMouseMove}
      >
        <Image
          src={images[active]}
          alt={name}
          fill
          priority
          sizes="(min-width: 768px) 50vw, 100vw"
          className={cn("object-cover transition-transform duration-300", zooming && "scale-[1.8]")}
          style={zoomStyle}
        />
      </div>
    </div>
  );
}
