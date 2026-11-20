# Despliegue de Copa Arrayanes (100 % gratis)

Tiempo estimado: 45–60 minutos la primera vez. No necesitas tarjeta de crédito.

```
Celulares / computadores
        │  (app instalable desde el navegador, sin Play Store)
        ▼
Cloudflare Pages  ──  sirve la app (archivos estáticos de /out)
        │
        ▼
Supabase  ──  PostgreSQL + RLS · Auth · Realtime · Storage · Edge Function (push)
```

---

## 1. GitHub (código)

1. Crea una cuenta en <https://github.com> (idealmente a nombre del comité, no personal).
2. Crea un repositorio **privado** llamado `copa-arrayanes`.
3. En tu equipo, dentro de la carpeta del proyecto:
   ```bash
   git remote add origin https://github.com/<usuario>/copa-arrayanes.git
   git push -u origin main
   ```

## 2. Supabase (base de datos)

1. Crea una cuenta en <https://supabase.com> → **New project**.
   - Nombre: `copa-arrayanes` · Región: **East US (North Virginia)** (la más cercana con plan gratis) · Guarda la contraseña de la base de datos en un lugar seguro.
2. **SQL Editor** → pega y ejecuta, en orden:
   1. `supabase/migrations/20261119000001_schema.sql`
   2. `supabase/migrations/20261119000002_storage.sql`
3. **Authentication → Sign In / Providers → Email**: deja activo *Email*, **desactiva "Allow new users to sign up"** (solo se entra por invitación).
4. **Authentication → URL Configuration**: *Site URL* = la dirección de Cloudflare (paso 3), y agrega `https://<tu-sitio>/admin/clave` en *Redirect URLs*.
5. **Project Settings → API**: copia *Project URL* y la clave **anon public**.
   ⚠️ La clave `service_role` **nunca** va en el código ni en Cloudflare.

### Primer administrador
1. **Authentication → Users → Invite user** con tu correo. Acepta la invitación y crea tu contraseña en `/admin/clave`.
2. En **SQL Editor**:
   ```sql
   update profiles set role = 'admin', full_name = 'Tu nombre'
   where id = (select id from auth.users where email = 'tu-correo@ejemplo.com');
   ```
3. Desde ahí, los demás usuarios se invitan igual y les asignas el rol en la app (**Gestión → Usuarios**).

## 3. Cloudflare Pages (publicar la app)

> **Así quedó configurado (carga directa con Wrangler).** Para publicar una versión nueva, desde tu equipo y con `.env.local` completo:
> ```bash
> npm run deploy
> ```
> Cloudflare no permite convertir un proyecto de carga directa en uno conectado a Git. Si más adelante quieres despliegue automático con cada `git push`, crea otro proyecto conectado a GitHub con estos pasos.

1. Cuenta en <https://dash.cloudflare.com> → **Workers & Pages → Create → Pages → Connect to Git** → elige el repositorio.
2. Configuración de compilación:
   | Campo | Valor |
   |---|---|
   | Framework preset | *None* |
   | Build command | `npm run build` |
   | Build output directory | `out` |
   | Variable `NODE_VERSION` | `22` |
3. **Environment variables** (Production):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` = `https://copa-arrayanes.pages.dev` (o tu dominio)
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (paso 4)
4. **Save and Deploy**. Cada `git push` a `main` publica una versión nueva automáticamente.

## 4. Notificaciones push (opcional, también gratis)

1. Genera las claves: `npm run vapid`.
2. Supabase → **Edge Functions → Secrets**: crea
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (=`mailto:correo-del-comite@...`) y `CRON_SECRET` (una frase larga aleatoria).
3. Publica la función (requiere la CLI: `npx supabase login`, `npx supabase link --project-ref <ref>`):
   ```bash
   npx supabase functions deploy send-push --no-verify-jwt
   ```
4. **Database → Extensions**: activa `pg_cron` y `pg_net`.
5. SQL Editor:
   ```sql
   select vault.create_secret('<mismo valor de CRON_SECRET>', 'cron_secret');
   ```
   Luego ejecuta `supabase/optional/cron_notificaciones.sql` reemplazando `<PROJECT_REF>`.
6. Agrega `NEXT_PUBLIC_VAPID_PUBLIC_KEY` en Cloudflare y vuelve a desplegar.

Qué se notifica:
- **Recordatorio** ~1 hora antes de cada partido (a quienes siguen esos equipos o su vereda).
- **Resultado final** al publicarlo.
- Sin internet: el resultado queda guardado en el teléfono del organizador; al recuperar señal se sube y **entonces** se notifica.

## 4b. Asistente de planilla con IA (opcional, de pago por uso)

Permite **dictar** o **enviar foto** de la planilla al final de la jornada. La IA llena el formulario y el organizador solo revisa y publica.

> **Sin configurar esto, el asistente igual funciona con dictado**, usando el lector gratuito sin IA, que entiende frases simples. Las **fotos** sí necesitan la IA.

1. Crea una cuenta en <https://platform.openai.com>, compra crédito (mínimo ~5 USD) y en **Limits** fija un **tope de gasto mensual** (ej. 5 USD).
2. Crea una **API key** de proyecto.
3. Supabase → **Edge Functions → Secrets**:
   - `OPENAI_API_KEY` = la clave (⚠️ solo aquí, nunca en Cloudflare ni en el código)
   - `OPENAI_MODEL` = `gpt-4o-mini` (opcional; cualquier modelo con visión y *structured outputs*)
   - `AI_DAILY_LIMIT` = `40` (consultas por persona cada 24 h)
   - `ALLOWED_ORIGIN` = `https://copa-arrayanes.pages.dev`
4. Ejecuta `supabase/migrations/20261120000004_asistente.sql` en el SQL Editor.
5. Publica la función:
   ```bash
   npx supabase functions deploy asistente-partido
   ```
   (esta función **sí** verifica la sesión; no uses `--no-verify-jwt`).

**Costo estimado** (precios publicados de `gpt-4o-mini` a la fecha; verifica en <https://openai.com/api/pricing>):
| Uso | Aproximado |
|---|---|
| Dictado de una jornada | menos de 0,1 centavos de dólar |
| Una foto de planilla | ~0,5 centavos de dólar |
| Temporada completa (15 jornadas, 2 fotos c/u) | menos de 0,50 USD |

Consumo visible para el administrador en SQL Editor: `select * from ai_usage_monthly;`

**Seguridad del asistente:** la clave de OpenAI vive solo en la Edge Function. Solo pueden usar el asistente los roles admin, organizador y planillero, con un límite diario por persona. La IA solo puede elegir partidos, equipos y jugadores que existen, porque el formato de respuesta va cerrado con listas de IDs válidos, y además el servidor vuelve a validar todo lo que devuelve. **Nada se guarda sin la revisión humana.**

## 5. Instalar la app en los celulares

- **Android (Chrome):** abrir la dirección → menú ⋮ → *Instalar app*. Queda con ícono propio, pantalla de inicio y funciona sin señal.
- **iPhone (Safari):** Compartir → *Agregar a pantalla de inicio* (iOS 16.4+ para notificaciones).
- Comparte el enlace por WhatsApp: se ve con la imagen de la copa.

---

## Límites de los planes gratuitos

> Valores publicados por cada proveedor a la fecha de este documento (nov-2026). Pueden cambiar: revisa las páginas de precios antes de cada edición.

### Supabase Free
| Recurso | Límite | Uso estimado de la copa |
|---|---|---|
| Base de datos | 500 MB | < 20 MB por edición (miles de partidos caben) |
| Almacenamiento de archivos | 1 GB | Escudos ~20 KB c/u; fotos ~150 KB → ~6.000 fotos |
| Transferencia (egress) | 5 GB / mes | Cada visita descarga ~50–150 KB de datos → ~35.000 visitas/mes |
| Usuarios con cuenta (MAU) | 50.000 | Solo el comité (< 20) |
| Conexiones Realtime simultáneas | 200 | Visitantes con la app abierta a la vez |
| Edge Functions | 500.000 invocaciones / mes | Cron cada 5 min ≈ 8.700 / mes |
| Proyectos activos | 2 | 1 |
| **Pausa por inactividad** | **Se pausa tras ~7 días sin actividad** | Ver abajo |

**Pausa por inactividad:** entre ediciones el proyecto puede pausarse. Los datos **no se pierden**; se reactiva con un clic en el panel de Supabase (*Restore project*). El flujo `.github/workflows/keepalive.yml` hace una consulta liviana dos veces por semana para evitarlo (configura los secretos `SUPABASE_URL` y `SUPABASE_ANON_KEY` en GitHub → Settings → Secrets → Actions).

**Copias de seguridad:** el plan gratis no incluye respaldos descargables. Al cerrar cada edición, exporta desde *Database → Backups* o con `npx supabase db dump -f respaldo-AAAA.sql` y guárdalo en Drive.

### Cloudflare Pages Free
| Recurso | Límite |
|---|---|
| Tráfico y visitas | Ilimitado para archivos estáticos |
| Compilaciones | 500 / mes |
| Archivos por sitio | 20.000 (usamos ~100) |
| Tamaño por archivo | 25 MB |
| Dominio | `*.pages.dev` gratis; dominio propio opcional (~USD 10/año, no obligatorio) |

### GitHub Free
- Repositorios privados ilimitados.
- GitHub Actions: 2.000 minutos/mes en repos privados (cada verificación usa ~2 min).

### Notificaciones Web Push
- Gratuitas (las entregan Google, Mozilla y Apple). Sin límite práctico para este volumen.
- iPhone: solo con la app agregada a la pantalla de inicio.

### Lo que **no** es gratis (y no es necesario)
- Asistente con IA para fotos (OpenAI): pago por uso, centavos por jornada. Opcional; el dictado funciona gratis sin IA.
- Google Play: USD 25 único pago, más prueba cerrada con 12 testers por 14 días para cuentas personales nuevas. **No se usa**: la app se instala desde el navegador.
- Dominio propio: opcional.

---

## Seguridad: lista de verificación

- [ ] Solo la clave **anon** está en Cloudflare. La `service_role` y la clave de OpenAI viven únicamente dentro de Supabase.
- [ ] Tope de gasto mensual configurado en OpenAI (si usas el asistente).
- [ ] Registro público desactivado en Supabase Auth.
- [ ] RLS activo en todas las tablas (lo hace la migración; verifícalo en *Table Editor*: candado "RLS enabled").
- [ ] Cada persona tiene el rol mínimo (planillero ≠ organizador).
- [ ] Contraseñas de al menos 8 caracteres; no se comparten cuentas.
- [ ] `.env.local` nunca se sube a GitHub (ya está en `.gitignore`).
- [ ] Cabeceras de seguridad activas (`public/_headers`).
