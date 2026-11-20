import { appError } from "./errors";

/**
 * Reduce y comprime imágenes en el teléfono antes de subirlas (WebP).
 * Ahorra datos móviles y el almacenamiento gratuito (1 GB en Supabase Free).
 */
export async function compressImage(file: File, maxSide: number, quality = 0.8, type: "image/webp" | "image/jpeg" = "image/webp"): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw appError("validacion", "El archivo no es una imagen.");
  if (file.size > 15 * 1024 * 1024) throw appError("validacion", "La imagen es muy pesada (máximo 15 MB).");
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw appError("validacion", "No se pudo abrir la imagen. Prueba con una foto JPG o PNG.");
  }
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, quality));
  if (!blob) throw appError("validacion", "No se pudo procesar la imagen.");
  return blob;
}
