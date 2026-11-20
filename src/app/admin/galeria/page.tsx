"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmButton } from "@/components/form";
import { usePublic } from "@/components/public-hooks";
import { useToast } from "@/components/toast";
import { EmptyState, PageHeader } from "@/components/ui";
import { getBackend, useStore } from "@/lib/data/store";
import { compressImage } from "@/lib/image";

/** Galería: fotos comprimidas a 1280 px (~150 KB) para cuidar el plan gratuito. */
export default function GaleriaAdmin() {
  const { data, edition } = usePublic();
  const store = useStore();
  const toast = useToast();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const photos = data.gallery_photos.filter((p) => p.edition_id === edition?.id);

  const upload = async (files: FileList | null) => {
    if (!files?.length || !edition) return;
    const list = [...files].slice(0, 20);
    setProgress({ done: 0, total: list.length });
    let ok = 0;
    for (const file of list) {
      try {
        const blob = await compressImage(file, 1280, 0.78);
        const path = `${edition.year}/${crypto.randomUUID()}.webp`;
        const url = await getBackend().uploadImage("galeria", blob, path);
        await store.insert("gallery_photos", [{ edition_id: edition.id, storage_path: store.mode === "local" ? url : path, caption: null }], "Foto");
        ok++;
      } catch (e) { toast.error(e, file.name); }
      setProgress((p) => p && { ...p, done: p.done + 1 });
    }
    setProgress(null);
    if (ok) toast.show({ tone: "exito", title: `${ok} foto${ok > 1 ? "s" : ""} subida${ok > 1 ? "s" : ""}` });
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Galería" subtitle={edition?.name} action={
        <label className={`btn btn-primary cursor-pointer ${progress ? "pointer-events-none opacity-60" : ""}`}>
          <ImagePlus className="size-4" />{progress ? `Subiendo ${progress.done}/${progress.total}` : "Subir fotos"}
          <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => void upload(e.target.files)} />
        </label>} />
      <p className="text-sm text-[var(--muted)]">Máximo 20 fotos por vez. Se reducen automáticamente para ahorrar datos.</p>
      {photos.length === 0 ? <EmptyState title="Sin fotos en esta edición" /> : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getBackend().publicUrl("galeria", p.storage_path)} alt={p.caption ?? ""} className="aspect-square w-full rounded-xl object-cover" loading="lazy" />
              <div className="absolute right-1 top-1">
                <ConfirmButton className="bg-black/50 px-2 text-white" confirmText="Borrar" onConfirm={() => store.remove("gallery_photos", { id: p.id }, "Foto").then(() => undefined).catch((e) => toast.error(e))}>
                  <Trash2 className="size-4" aria-label="Eliminar foto" />
                </ConfirmButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
