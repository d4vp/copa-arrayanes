"use client";

/** Último recurso si falla el diseño principal. Sin dependencias. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="es-CO">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, background: "#f4f7fb", color: "#0f172a", textAlign: "center", padding: 24 }}>
        <div>
          <h1 style={{ fontSize: 24 }}>La aplicación tuvo un problema</h1>
          <p style={{ color: "#5b6b82" }}>No es tu culpa. Intenta recargar.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: "12px 20px", borderRadius: 12, border: 0, background: "#1d4ed8", color: "#fff", fontWeight: 600, fontSize: 16 }}>Recargar</button>
        </div>
      </body>
    </html>
  );
}
