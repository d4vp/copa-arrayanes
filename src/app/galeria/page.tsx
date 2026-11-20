"use client";

import { Image as ImageIcon, X } from "lucide-react";
import { useMemo, useState } from "react";
import { usePublic } from "@/components/public-hooks";
import { EmptyState, ListSkeleton, PageHeader } from "@/components/ui";
import { getBackend } from "@/lib/data/store";
import type { GalleryPhoto } from "@/lib/types";

export default function GaleriaPage() {
  const { data, ready, edition } = usePublic();
  const [open, setOpen] = useState<GalleryPhoto | null>(null);
  const photos = useMemo(() => data.gallery_photos.filter((p) => p.edition_id === edition?.id).sort((a, b) => b.created_at.localeCompare(a.created_at)), [data.gallery_photos, edition]);
  const url = (p: GalleryPhoto) => getBackend().publicUrl("galeria", p.storage_path);

  if (!ready) return <ListSkeleton />;
  return (
    <div className="space-y-4">
      <PageHeader title="Galería" subtitle={edition?.name} />
      {photos.length === 0 ? <EmptyState icon={<ImageIcon className="size-8" />} title="Aún no hay fotos" text="El comité irá subiendo fotos de la copa." /> : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id}>
              <button onClick={() => setOpen(p)} className="block aspect-square w-full overflow-hidden rounded-xl bg-[var(--surface-2)]" aria-label={p.caption ?? "Ver foto"}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url(p)} alt={p.caption ?? ""} loading="lazy" className="size-full object-cover transition-transform hover:scale-105" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Foto" className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4" onClick={() => setOpen(null)}>
          <button className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] rounded-full p-2 text-white hover:bg-white/10" aria-label="Cerrar"><X className="size-6" /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url(open)} alt={open.caption ?? ""} className="max-h-[80vh] max-w-full rounded-lg object-contain" />
          {open.caption && <p className="mt-3 text-center text-sm text-white">{open.caption}</p>}
        </div>
      )}
    </div>
  );
}
