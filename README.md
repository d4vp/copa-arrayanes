# Copa Arrayanes

Aplicación de la Copa Arrayanes, vereda Los Arrayanes, Córdoba, Nariño, Colombia. Sirve para seguir y organizar los campeonatos: partidos, resultados, tablas, estadísticas, historial por edición, favoritos, avisos de la comunidad y galería.

- **App instalable (PWA):** se instala desde el navegador en Android y iPhone, sin Play Store. Funciona sin señal.
- **Público sin cuenta:** cualquiera ve resultados y marca favoritos (★). Solo el comité inicia sesión.
- **Asistente de planilla:** al final de la jornada se dicta o se envía foto de la planilla. La IA llena los resultados y el organizador solo revisa. El dictado funciona gratis sin IA.
- **Costo $0:** Cloudflare Pages + Supabase Free + GitHub. Solo el asistente para leer fotos usa OpenAI, con pago por uso de centavos por jornada.

## Uso local

Necesitas Node.js 20 o superior.

```bash
npm install
npm run dev          # http://localhost:3000
```

Sin `.env.local` la app arranca en **modo demostración**, con datos de prueba guardados en el navegador. Usuarios de prueba, todos con la contraseña `demo`:
`admin@demo.co`, `organizador@demo.co`, `planillero@demo.co`, `delegado@demo.co`.

Para conectarla a Supabase, copia `.env.example` como `.env.local` y completa los valores. Ver [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md).

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Pruebas: lógica deportiva y base de datos con RLS (PostgreSQL en memoria) |
| `npm run check` | Tipos, lint, pruebas y compilación |
| `npm run build` | Genera `out/` para Cloudflare Pages |
| `npm run icons` | Regenera los íconos desde `public/brand/logo-mark.svg` |
| `npm run vapid` | Genera las claves para las notificaciones push |

## Arquitectura

```
src/
  app/                 Páginas (públicas y /admin)
  components/          Interfaz (escudos, tablas, formularios, avisos)
  lib/domain/          Reglas deportivas puras y probadas:
                       tabla 3-1-0, desempates, fixture, llaves, podio, goleadores
  lib/data/            Acceso a datos:
    backend.ts         contrato común
    supabase-backend   producción (RLS)
    local-backend      modo demostración
    store.tsx          caché sin conexión + cola de cambios + tiempo real
  lib/errors.ts        errores 400/401/403/404/409/429/500 en español claro
  lib/assistant.ts     asistente: candidatos, dictado por voz, fotos
supabase/
  migrations/          esquema, RLS, triggers, almacenamiento, cron
  functions/send-push  envío de notificaciones
  functions/asistente-partido  IA (OpenAI) para dictado/fotos → resultados por revisar
  functions/_shared    lógica del asistente compartida con la app (esquema, validación, lector sin IA)
  tests/               pruebas de seguridad RLS
public/
  sw.js                service worker (sin conexión y push)
  manifest.webmanifest
  _headers
```

### Reglas clave
- **Historial protegido:** un trigger en PostgreSQL impide modificar partidos, eventos o podios de una edición finalizada. Solo un administrador puede reabrirla.
- **Nueva edición:** reutiliza la configuración de las categorías, pero **no** copia equipos inscritos, jugadores ni resultados.
- **Planillero opcional:** sus planillas quedan pendientes hasta que un organizador las aprueba. El organizador registra resultados directamente.
- **Sin conexión:** la app muestra los últimos datos descargados. Los cambios del organizador se guardan en el teléfono y se envían al recuperar la señal.
- **Podio 1.° a 4.°:** se calcula desde la final y el tercer puesto, o desde la tabla. Al cerrar la edición queda guardado.

Publicar cambios: [docs/PUBLICAR.md](docs/PUBLICAR.md) · Más información: [principios de UX](docs/UX.md) · [despliegue y límites gratuitos](docs/DESPLIEGUE.md).
