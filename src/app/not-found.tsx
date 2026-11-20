import Link from "next/link";
import { LogoMark } from "@/components/brand";

/** 404 · página no encontrada */
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-12 text-center">
      <LogoMark className="size-16 opacity-80" />
      <p className="font-display mt-6 text-6xl font-extrabold text-[var(--brand)]">404</p>
      <h1 className="font-display mt-2 text-2xl font-bold">Esta página se fue fuera de la cancha</h1>
      <p className="mt-2 text-[var(--muted)]">El enlace puede estar mal escrito o la página ya no existe.</p>
      <div className="mt-6 flex gap-2">
        <Link href="/" className="btn btn-primary">Ir al inicio</Link>
        <Link href="/partidos" className="btn btn-outline">Ver partidos</Link>
      </div>
    </div>
  );
}
