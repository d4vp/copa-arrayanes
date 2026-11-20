import type { Metadata } from "next";
import { LogoMark } from "@/components/brand";

export const metadata: Metadata = { title: "Acerca y privacidad" };

export default function AcercaPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-5 text-[0.95rem] leading-relaxed">
      <header className="flex items-center gap-4">
        <LogoMark className="size-16" />
        <div>
          <h1 className="font-display text-3xl font-extrabold">Copa Arrayanes</h1>
          <p className="text-sm text-[var(--muted)]">Vereda Los Arrayanes · Córdoba, Nariño, Colombia</p>
        </div>
      </header>
      <p>Aplicación comunitaria para organizar y seguir los campeonatos de la vereda: partidos, resultados, tablas, estadísticas e historial de cada edición.</p>

      <section className="card space-y-3 p-4">
        <h2 className="font-display text-xl font-bold">Política de privacidad</h2>
        <p className="text-sm text-[var(--muted)]">Conforme a la Ley 1581 de 2012 de protección de datos personales en Colombia.</p>
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li><b>Visitantes:</b> no pedimos cuenta ni datos personales. Tus favoritos y preferencias se guardan solo en tu teléfono.</li>
          <li><b>Notificaciones:</b> si las activas, guardamos un identificador técnico del navegador y tus equipos favoritos, solo para enviarte avisos. Puedes desactivarlas cuando quieras y se borra.</li>
          <li><b>Deportistas:</b> se publica el nombre, número de camiseta y equipo, con autorización del deportista al momento de la inscripción. No se publican documentos de identidad, teléfonos ni direcciones.</li>
          <li><b>Fotos:</b> la galería muestra momentos de la copa. Si apareces en una foto y quieres que se retire, pídelo al comité organizador.</li>
          <li><b>Personal del comité:</b> su correo se usa solo para iniciar sesión.</li>
          <li><b>Asistente de planilla:</b> cuando el comité usa dictado o fotos de la planilla, ese contenido se envía a un servicio de IA (OpenAI) solo para leer los resultados. La app no guarda las fotos, y el servicio no las usa para entrenar sus modelos según sus condiciones para empresas.</li>
          <li>Los datos se alojan en Supabase (PostgreSQL) con acceso restringido por roles. No vendemos ni compartimos datos con terceros.</li>
        </ul>
        <p className="text-sm">Para consultar, corregir o eliminar tus datos, comunícate con el comité organizador de la Copa Arrayanes.</p>
      </section>
    </article>
  );
}
