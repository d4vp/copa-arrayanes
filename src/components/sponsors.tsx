/**
 * Pie de página con los patrocinadores: una cinta que avanza despacio
 * (se detiene al pasar el dedo o el mouse) y queda quieta con "reducir movimiento".
 */
import { DEVELOPER, SPONSORS, type Sponsor } from "@/lib/sponsors";

function SponsorItem({ s }: { s: Sponsor }) {
  return (
    <li className="flex w-44 shrink-0 items-center gap-2.5" title={`${s.name} · ${s.role}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- sitio estático, sin optimizador de imágenes */}
      <img src={s.logo} alt="" width={48} height={48} loading="lazy" decoding="async"
        className="size-12 shrink-0 rounded-full bg-white object-cover ring-1 ring-[var(--border)]" />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-xs font-semibold">{s.name}</span>
        <span className="block truncate text-[0.68rem] text-[var(--muted)]">{s.role}</span>
      </span>
    </li>
  );
}

export function SponsorsFooter() {
  if (!SPONSORS.length && !DEVELOPER) return null;
  return (
    <footer className="mt-6 border-t border-[var(--border)] bg-[var(--surface)] pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-4 md:pb-6">
      {SPONSORS.length > 0 && (
        <section aria-labelledby="patrocinadores-titulo" className="mx-auto max-w-6xl">
          <h2 id="patrocinadores-titulo" className="px-4 text-center text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Patrocinadores
          </h2>
          <div className="sponsor-marquee mt-3 overflow-hidden">
            <div className="sponsor-track flex w-max gap-6 px-3">
              <ul className="flex gap-6">{SPONSORS.map((s) => <SponsorItem key={s.name} s={s} />)}</ul>
              {/* copia para que la cinta sea continua; los lectores de pantalla la ignoran */}
              <ul aria-hidden className="sponsor-copy flex gap-6">{SPONSORS.map((s) => <SponsorItem key={s.name} s={s} />)}</ul>
            </div>
          </div>
        </section>
      )}
      <p className="mt-4 px-4 text-center text-[0.7rem] text-[var(--muted)]">
        Copa Arrayanes · Vereda Los Arrayanes, Córdoba (Nariño)
        {DEVELOPER && (
          <> · Desarrollado por {DEVELOPER.url
            ? <a href={DEVELOPER.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline-offset-2 hover:underline">{DEVELOPER.name}</a>
            : <span className="font-semibold">{DEVELOPER.name}</span>}</>
        )}
      </p>
    </footer>
  );
}
