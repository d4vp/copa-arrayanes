/**
 * Patrocinadores que aparecen al pie de la app.
 * Logos recortados de los afiches oficiales de la 5ta Copa (public/patrocinadores).
 * Para agregar uno: pon su logo cuadrado en public/patrocinadores y añádelo aquí.
 */
export interface Sponsor { name: string; role: string; logo: string }

export const SPONSORS: Sponsor[] = [
  { name: "Edwin Cerón", role: "Alcalde de Córdoba 2024-2027", logo: "/patrocinadores/edwin-ceron.webp" },
  { name: "Gloria Cerón", role: "Gestora social · Córdoba, Nariño", logo: "/patrocinadores/gloria-ceron.webp" },
  { name: "RDECB", role: "Innovación que nos conecta", logo: "/patrocinadores/rdeco.webp" },
  { name: "JAC Los Arrayanes", role: "Junta de Acción Comunal", logo: "/patrocinadores/jac-los-arrayanes.webp" },
  { name: "Mg. Vladimir Leitón", role: "Promotor del deporte local", logo: "/patrocinadores/vladimir-leiton.webp" },
  { name: "Mora Suprema", role: "Andrés Jácome", logo: "/patrocinadores/mora-suprema.webp" },
  { name: "Diego Díaz", role: "Coordinador del campeonato", logo: "/patrocinadores/diego-diaz.webp" },
];

/** Crédito opcional de quien desarrolló la app. `null` = no se muestra. */
export const DEVELOPER: { name: string; url?: string } | null = { name: "πnchao · d4vp", url: "https://d4vp.github.io/blogger" };
