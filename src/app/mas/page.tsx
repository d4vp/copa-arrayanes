"use client";

import Link from "next/link";
import { BarChart3, ChevronRight, Download, History, Image as ImageIcon, Info, Shield, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui";

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

export default function MasPage() {
  const [installEvt, setInstallEvt] = useState<InstallEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setStandalone(matchMedia("(display-mode: standalone)").matches);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const h = (e: Event) => { e.preventDefault(); setInstallEvt(e as InstallEvent); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  const items = [
    { href: "/estadisticas", icon: BarChart3, label: "Estadísticas", text: "Goleadores, valla menos vencida y juego limpio" },
    { href: "/historial", icon: History, label: "Historial", text: "Campeones de ediciones anteriores" },
    { href: "/galeria", icon: ImageIcon, label: "Galería", text: "Fotos de la copa" },
    { href: "/favoritos", icon: Star, label: "Favoritos y avisos", text: "Tus equipos y notificaciones" },
    { href: "/admin", icon: Shield, label: "Gestión del campeonato", text: "Solo para el comité organizador" },
    { href: "/acerca", icon: Info, label: "Acerca y privacidad", text: "Quiénes somos y cómo tratamos los datos" },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Más" />
      {!standalone && (
        <section className="card flex items-start gap-3 border-[var(--brand)]/40 p-4">
          <Download className="mt-0.5 size-5 shrink-0 text-[var(--brand)]" aria-hidden />
          <div className="flex-1">
            <h2 className="font-semibold">Instala la app</h2>
            <p className="text-sm text-[var(--muted)]">
              {ios ? "En Safari toca Compartir y luego \"Agregar a pantalla de inicio\"."
                : installEvt ? "Ábrela desde tu pantalla de inicio, sin Play Store y sin ocupar casi espacio."
                : "En Chrome abre el menú ⋮ y elige \"Instalar app\" o \"Agregar a pantalla de inicio\"."}
            </p>
            {installEvt && (
              <button className="btn btn-primary mt-3" onClick={async () => { await installEvt.prompt(); setInstallEvt(null); }}>Instalar</button>
            )}
          </div>
        </section>
      )}
      <nav className="card divide-y divide-[var(--border)]" aria-label="Más secciones">
        {items.map(({ href, icon: Icon, label, text }) => (
          <Link key={href} href={href} className="flex items-center gap-3 p-4 hover:bg-[var(--surface-2)]">
            <Icon className="size-5 text-[var(--brand)]" aria-hidden />
            <span className="flex-1"><span className="block font-semibold">{label}</span><span className="block text-sm text-[var(--muted)]">{text}</span></span>
            <ChevronRight className="size-4 text-[var(--muted)]" aria-hidden />
          </Link>
        ))}
      </nav>
    </div>
  );
}
