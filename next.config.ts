import type { NextConfig } from "next";

/**
 * Exportación estática: el resultado (carpeta out/) se publica gratis en Cloudflare Pages.
 * Toda la lógica de datos corre en el navegador contra Supabase (protegido con RLS).
 */
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: false,
  poweredByHeader: false,
};

export default nextConfig;
