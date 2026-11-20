import { describe, expect, it } from "vitest";
import type { Edition } from "../types";
import { emptySnapshot } from "./backend";
import { currentEdition } from "./selectors";

const ed = (year: number, status: Edition["status"]): Edition =>
  ({ id: String(year), name: `Copa ${year}`, year, status, start_date: null, end_date: null, based_on: null, created_at: "" });

describe("currentEdition", () => {
  const snap = (eds: Edition[]) => ({ ...emptySnapshot(), editions: eds });
  it("prefiere la edición en juego", () => {
    expect(currentEdition(snap([ed(2025, "finalizado"), ed(2026, "en_desarrollo"), ed(2027, "planificacion")]))?.year).toBe(2026);
  });
  it("una edición en planificación no reemplaza a la última finalizada", () => {
    expect(currentEdition(snap([ed(2026, "finalizado"), ed(2027, "planificacion")]))?.year).toBe(2026);
  });
  it("con inscripciones abiertas se muestra la nueva", () => {
    expect(currentEdition(snap([ed(2026, "finalizado"), ed(2027, "inscripcion")]))?.year).toBe(2027);
  });
  it("sin ediciones devuelve null", () => {
    expect(currentEdition(snap([]))).toBeNull();
  });
});
