import { describe, expect, it } from "vitest";
import { toAppError } from "./errors";

describe("toAppError", () => {
  it("fallo de red envuelto por supabase-js → sin_conexion", () => {
    expect(toAppError({ message: "TypeError: Failed to fetch", status: 0 }).kind).toBe("sin_conexion");
  });
  it("RLS → no_autorizado; único → conflicto; edición cerrada", () => {
    expect(toAppError({ code: "42501", message: "row-level security" }).kind).toBe("no_autorizado");
    expect(toAppError({ code: "23505", message: "duplicate" }).kind).toBe("conflicto");
    expect(toAppError({ code: "P0001", message: "EDICION_CERRADA: la edición está finalizada" }).kind).toBe("edicion_cerrada");
  });
  it("HTTP 429 y 500", () => {
    expect(toAppError({ status: 429, message: "x" }).kind).toBe("limite");
    expect(toAppError({ status: 503, message: "x" }).kind).toBe("servidor");
  });
});
