"use client";

import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { logError, toAppError } from "@/lib/errors";

/** Error en una página (equivalente a 500): la app sigue funcionando. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { logError("pagina", error); }, [error]);
  const e = toAppError(error);
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center py-12 text-center">
      <TriangleAlert className="size-12 text-[var(--danger)]" aria-hidden />
      <h1 className="font-display mt-4 text-2xl font-bold">{e.kind === "desconocido" ? "Algo salió mal en esta pantalla" : e.message}</h1>
      <p className="mt-2 text-[var(--muted)]">{e.hint ?? "Puedes intentarlo de nuevo. Tus datos están a salvo."}</p>
      <div className="mt-6 flex gap-2">
        <button onClick={reset} className="btn btn-primary"><RotateCw className="size-4" />Reintentar</button>
        <Link href="/" className="btn btn-outline">Ir al inicio</Link>
      </div>
      {error.digest && <p className="mt-6 text-xs text-[var(--muted)]">Código: {error.digest}</p>}
    </div>
  );
}
