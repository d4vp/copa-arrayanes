import { z } from "zod";

/** Validaciones de formularios. Reflejan las restricciones CHECK de la base de datos. */

const name = (min: number, max: number, what: string) =>
  z.string().trim().min(min, `${what}: mínimo ${min} caracteres`).max(max, `${what}: máximo ${max} caracteres`);

export const editionSchema = z.object({
  name: name(3, 80, "Nombre"),
  year: z.coerce.number({ invalid_type_error: "Escribe el año" }).int().min(2000, "Año no válido").max(2100, "Año no válido"),
  start_date: z.string().optional().transform((v) => v || null),
  end_date: z.string().optional().transform((v) => v || null),
}).refine((d) => !d.start_date || !d.end_date || d.end_date >= d.start_date, { path: ["end_date"], message: "La fecha final no puede ser antes del inicio" });

export const teamSchema = z.object({
  name: name(2, 60, "Nombre"),
  short_name: z.string().trim().max(4, "Máximo 4 letras").optional().transform((v) => (v ? v.toUpperCase() : null))
    .refine((v) => v === null || v.length >= 2, "Mínimo 2 letras"),
  vereda_id: z.string().optional().transform((v) => v || null),
  crest_shape: z.enum(["escudo", "circulo", "hexagono", "diamante"]),
  color_primary: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color no válido"),
  color_secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color no válido"),
});

export const playerSchema = z.object({
  full_name: name(3, 80, "Nombre"),
  number: z.union([z.literal(""), z.coerce.number().int().min(0, "Entre 0 y 99").max(99, "Entre 0 y 99")]).transform((v) => (v === "" ? null : v)),
});

export const noticeSchema = z.object({
  title: name(3, 80, "Título"),
  body: z.string().trim().max(280, "Máximo 280 caracteres").optional().transform((v) => v || null),
  kind: z.enum(["comunidad", "ventas", "partido"]),
  ends_at: z.string().optional().transform((v) => v || null),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Escribe un correo válido"),
  password: z.string().min(4, "Escribe tu contraseña"),
});

/** Convierte errores de zod a { campo: mensaje } */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = String(i.path[0] ?? "_");
    out[k] ??= i.message;
  }
  return out;
}
