# Publicar cambios (flujo probado)

Desde `~/proyectos/copa-arrayanes`, con `source ~/.nvm/nvm.sh`:

| Paso | Comando | Cuándo |
|---|---|---|
| 1. Verificar | `npm run check` | Siempre: tipos, lint, 48+ pruebas y compilación |
| 2. Guardar | `git add -A && git commit -m "qué cambió"` | Siempre |
| 3. Base de datos | `npx supabase db push --remote --dry-run` y luego `npx supabase db push --remote` | Solo si hay archivos nuevos en `supabase/migrations/` |
| 4. Funciones | `npx supabase functions deploy asistente-partido --use-api` | Solo si cambió `supabase/functions/` |
| 5. App | `npm run deploy` | Siempre (~35 s). Usa `.env.local` |
| 6. Respaldo | `git push origin main` | Siempre |

Notas:
- Los celulares con la app instalada reciben el aviso **"Hay una versión nueva · Actualizar"** automáticamente.
- Orden importante: **base de datos antes que la app**, para que la app nueva no use columnas o funciones que aún no existen.
- Para volver a una versión anterior: Cloudflare → Workers & Pages → copa-arrayanes → Deployments → la versión anterior → **Rollback**.
- `.env.local` no está en GitHub. Si cambias de computador, recréalo desde `.env.example` (URL y clave publicable de Supabase).
